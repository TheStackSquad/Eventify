// audit/k6/lib/summary.js

export const summaryTrendStats = [
  "avg",
  "med",
  "p(90)",
  "p(95)",
  "p(99)",
  "max",
];

export function compactSummary(data, name) {
  const m = data.metrics,
    d = m.http_req_duration.values,
    prof = __ENV.PROFILE || "smoke";
  const out = [
    `# ${name} profile=${prof} base=${__ENV.BASE_URL || "localhost:18081"}`,
    `reqs=${m.http_reqs.values.count} rps=${m.http_reqs.values.rate.toFixed(1)}`,
    `overall p50=${d.med.toFixed(0)} p95=${d["p(95)"].toFixed(0)} p99=${d["p(99)"].toFixed(0)} max=${d.max.toFixed(0)} (ms)`,
    `failed=${(m.http_req_failed.values.rate * 100).toFixed(2)}%` +
      (m.checks ? ` checks=${(m.checks.values.rate * 100).toFixed(1)}%` : ""),
  ];
  const failed = [];
  for (const k of Object.keys(m)) {
    if (k.startsWith("http_req_duration{endpoint:")) {
      const v = m[k].values;
      out.push(
        `  ${k.slice(27, -1)}: p95=${v["p(95)"].toFixed(0)}ms p99=${v["p(99)"].toFixed(0)}ms`,
      );
    }
    if (/^(orders|pay|rl|browse)_/.test(k))
      out.push(`  ${k}=${m[k].values.count}`);
    for (const [expr, r] of Object.entries(m[k].thresholds || {}))
      if (!r.ok) failed.push(`${k} ${expr}`);
  }
  out.push(
    failed.length
      ? `THRESHOLDS FAILED:\n  ${failed.join("\n  ")}`
      : "THRESHOLDS: all passed",
  );
  const text = out.join("\n") + "\n";
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return { stdout: text, [`audit/results/${name}-${prof}-${stamp}.txt`]: text };
}
