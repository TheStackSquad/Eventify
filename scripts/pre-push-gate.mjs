#!/usr/bin/env node
// Pre-push quality gate. Fast checks only; heavy layers (E2E, visual, Lighthouse, k6, mutation) belong in CI.
//   git push                              runs from .githooks/pre-push and reads the refs being pushed
//   node scripts/pre-push-gate.mjs        manual run against origin/main..HEAD
//   node scripts/pre-push-gate.mjs --all  every check, whatever changed
// Per-check override: GATE_<NAME>=block|warn|off  (names: tracked, secrets, tests, audit, lint, gobuild, gotests)
// Emergency bypass: SKIP_GATE=1 git push   (logged to <git dir>/gate-bypass.log)

import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

// "block" fails the push, "warn" only reports. Flip lint to "block" once `npm run lint` is clean.
const POLICY = {
  tracked: "block",
  secrets: "block",
  tests: "block",
  audit: "block",
  lint: "block",
  gobuild: "block",
  gotests: "block",
};

const isWin = process.platform === "win32";
const ZERO = /^0+$/;
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const ALL = process.argv.includes("--all");

function run(cmd, args, { cwd, shell = false, env = {} } = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    shell,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  return {
    status: r.status ?? 1,
    out: `${r.stdout || ""}${r.stderr || ""}`,
    stdout: r.stdout || "",
    error: r.error,
  };
}

const ROOT = run("git", ["rev-parse", "--show-toplevel"]).stdout.trim();
const FRONT = path.join(ROOT, "frontend");
const BACK = path.join(ROOT, "backend");
const git = (...args) => run("git", args, { cwd: ROOT });

const tail = (text, n = 20) =>
  text.split("\n").filter((l) => l.trim()).slice(-n).join("\n");
const failureLines = (text) =>
  [...new Set(text.split("\n").filter((l) => /^(FAIL |\s+● |Tests:|Test Suites:)/.test(l)))]
    .slice(0, 40)
    .join("\n");
const summaryLine = (text) => text.split("\n").find((l) => l.startsWith("Tests:")) || "";

// ── Emergency bypass (always logged) ─────────────────────────────────────────
if (process.env.SKIP_GATE === "1") {
  const gitDir = path.resolve(ROOT, git("rev-parse", "--git-dir").stdout.trim());
  const who = git("config", "user.name").stdout.trim();
  const sha = git("rev-parse", "HEAD").stdout.trim();
  appendFileSync(path.join(gitDir, "gate-bypass.log"), `${new Date().toISOString()} ${who} ${sha}\n`);
  console.log("⚠️  Pre-push gate SKIPPED (SKIP_GATE=1). Logged to gate-bypass.log");
  process.exit(0);
}

// ── What is being pushed? ────────────────────────────────────────────────────
function readPushRefs() {
  if (process.stdin.isTTY) return [];
  try {
    return readFileSync(0, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [localRef, localSha, remoteRef, remoteSha] = l.split(/\s+/);
        return { localRef, localSha, remoteRef, remoteSha };
      });
  } catch {
    return [];
  }
}

function toRange({ localSha, remoteSha }) {
  if (!localSha || ZERO.test(localSha)) return null; // deleting a remote branch
  let base = !remoteSha || ZERO.test(remoteSha) ? "" : remoteSha;
  if (base && git("cat-file", "-e", `${base}^{commit}`).status !== 0) base = ""; // not known locally
  if (!base) base = git("merge-base", localSha, "origin/main").stdout.trim();
  return { base: base || EMPTY_TREE, head: localSha };
}

const refs = readPushRefs();
let ranges;
if (refs.length) {
  ranges = refs.map(toRange).filter(Boolean);
  if (ranges.length === 0) {
    console.log("Pre-push gate: nothing to check (branch deletion).");
    process.exit(0);
  }
} else {
  const mb = git("merge-base", "HEAD", "origin/main").stdout.trim();
  ranges = [{ base: mb || EMPTY_TREE, head: "HEAD" }];
}

const changed = new Set();
const addedLines = [];
for (const { base, head } of ranges) {
  git("diff", "--name-only", "--diff-filter=ACMR", base, head)
    .stdout.split("\n")
    .filter(Boolean)
    .forEach((f) => changed.add(f));

  let file = "";
  for (const line of git("diff", "-U0", "--no-color", "--diff-filter=ACMR", base, head).stdout.split("\n")) {
    if (line.startsWith("+++ b/")) file = line.slice(6);
    else if (line.startsWith("+") && !line.startsWith("+++")) addedLines.push({ file, text: line.slice(1) });
  }
}

const touches = (prefix) => ALL || [...changed].some((f) => f.startsWith(prefix));
const touchesFrontend = touches("frontend/");
const touchesBackend = touches("backend/");

console.log(
  `Pre-push gate: ${changed.size} changed file(s)  frontend=${touchesFrontend ? "yes" : "no"}  backend=${touchesBackend ? "yes" : "no"}\n`,
);

// ── Step runner ──────────────────────────────────────────────────────────────
const results = [];
function step(name, key, fn) {
  const mode = process.env[`GATE_${key.toUpperCase()}`] || POLICY[key];
  if (mode === "off") return;
  process.stdout.write(`▶ ${name} ... `);
  const t0 = Date.now();
  const r = fn();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  let state = "PASS";
  if (!r.ok) state = mode === "block" ? "FAIL" : "WARN";
  else if (r.warn) state = "WARN";

  console.log(`${state} (${secs}s)`);
  if (r.detail) console.log(r.detail.split("\n").map((l) => `    ${l}`).join("\n"));
  results.push({ name, state });
}

// 1. Tests must be tracked (they were ignored by .gitignore for weeks)
step("tests are tracked in git", "tracked", () => {
  const count = (p) => git("ls-files", p).stdout.split("\n").filter(Boolean).length;
  const tests = count("frontend/src/__tests__");
  const fixtures = count("frontend/src/__fixtures__");
  const cfg = count("frontend/jest.config.js");
  const ok = tests > 0 && fixtures > 0 && cfg > 0;
  return {
    ok,
    detail: ok
      ? `${tests} test files, ${fixtures} fixtures`
      : "frontend tests, fixtures or jest.config.js are not tracked (check frontend/.gitignore)",
  };
});

// 2. Secrets in the lines being pushed
const SECRET_PATTERNS = [
  ["FastCAC API key", /fc_(?:test|live)_[A-Za-z0-9_-]{20,}/],
  ["Stripe/Paystack secret key", /sk_(?:test|live)_[A-Za-z0-9]{20,}/],
  ["private key block", /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
  ["AWS access key id", /AKIA[0-9A-Z]{16}/],
  ["Slack token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
];
const SECRET_SKIP_PATH = /(^|\/)(__tests__|__fixtures__)\/|^audit\/results\/|package-lock\.json$|\.(example|sample)$/;

step("no secrets in the pushed changes", "secrets", () => {
  const hits = [];
  for (const f of changed) {
    if (/(^|\/)\.env(\.[^/]*)?$/.test(f) && !/\.(example|sample)$/.test(f)) hits.push(`${f}: environment file`);
  }
  for (const { file, text } of addedLines) {
    if (SECRET_SKIP_PATH.test(file) || text.includes("gate-allow-secret")) continue;
    for (const [label, re] of SECRET_PATTERNS) {
      const m = re.exec(text);
      if (m) hits.push(`${file}: ${label} (${m[0].slice(0, 8)}…)`);
    }
  }
  const shown = hits.slice(0, 10).join("\n");
  return {
    ok: hits.length === 0,
    detail: hits.length ? `${shown}\n(rotate anything real; a harmless fixture line can carry "gate-allow-secret")` : "",
  };
});

// 3. Frontend
if (touchesFrontend) {
  step("eslint (frontend)", "lint", () => {
    const r = run("npm", ["run", "lint", "--silent"], { cwd: FRONT, shell: isWin });
    return { ok: r.status === 0, detail: r.status === 0 ? "" : tail(r.out, 25) };
  });

  step("unit tests (jest)", "tests", () => {
    const r = run("npm", ["test", "--", "--ci", "--silent"], { cwd: FRONT, shell: isWin });
    return r.status === 0
      ? { ok: true, detail: summaryLine(r.out) }
      : { ok: false, detail: failureLines(r.out) || tail(r.out, 25) };
  });

  step("dependency audit (production, high and critical)", "audit", () => {
    const r = run("npm", ["audit", "--omit=dev", "--audit-level=high"], {
      cwd: FRONT,
      shell: isWin,
      env: { NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --dns-result-order=ipv4first`.trim() },
    });
    if (r.status === 0) return { ok: true, detail: "0 high or critical vulnerabilities" };
    if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|audit endpoint returned an error|ENOLOCK/i.test(r.out)) {
      return { ok: true, warn: true, detail: "registry unreachable: the audit could not run (NOT verified)" };
    }
    return { ok: false, detail: tail(r.out, 30) };
  });
}

// 4. Backend
if (touchesBackend) {
  const noGo = (r) => r.error && r.error.code === "ENOENT";

  step("go build and go vet", "gobuild", () => {
    const b = run("go", ["build", "./..."], { cwd: BACK });
    if (noGo(b)) return { ok: false, detail: "go is not on PATH" };
    if (b.status !== 0) return { ok: false, detail: tail(b.out, 25) };
    const v = run("go", ["vet", "./..."], { cwd: BACK });
    return { ok: v.status === 0, detail: v.status === 0 ? "" : tail(v.out, 25) };
  });

  step("go unit tests (models, vendor handlers)", "gotests", () => {
    const t = run("go", ["test", "./pkg/models/...", "./pkg/handlers/vendor/..."], { cwd: BACK });
    return { ok: t.status === 0, detail: t.status === 0 ? "" : tail(t.out, 25) };
  });
}

// ── Summary ──────────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.state === "FAIL");
const warned = results.filter((r) => r.state === "WARN");
const passed = results.length - failed.length - warned.length;
console.log(
  `\n${failed.length ? "❌ Push blocked" : "✅ Gate passed"}: ${passed} passed, ${warned.length} warning(s), ${failed.length} failed`,
);
if (failed.length) console.log("Fix the failures above. In an emergency: SKIP_GATE=1 git push (it is logged).");
process.exit(failed.length ? 1 : 0);