// audit/k6/mixed.js

import http from "k6/http";
import crypto from "k6/crypto";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import { SharedArray } from "k6/data";
import { BASE, STUB, SECRET, PATHS, th, hdrs } from "./lib/config.js";
import { compactSummary, summaryTrendStats } from "./lib/summary.js";

http.setResponseCallback(
  http.expectedStatuses({ min: 200, max: 299 }, 402, 409),
);

const targets = new SharedArray("targets", () =>
  JSON.parse(open("./data/targets.json")),
);
const INCLUDE_VENDOR = __ENV.INCLUDE_VENDOR === "1";
const CATS = [
  "Music & concerts",
  "Tech & business",
  "Food & drink",
  "Arts & culture",
  "Fashion & lifestyle",
];
const CITIES = ["Lagos", "Abuja", "Ibadan", "Port Harcourt"];
const TERMS = [
  "music",
  "tech",
  "food",
  "art",
  "gospel",
  "startup",
  "fashion",
  "comedy",
  "lagos",
  "zzzznomatch",
];

// browse = requests/second, checkout = orders/minute (about 5% of browse)
const PROFILES = {
  smoke: { browse: 3, checkout: 20, hold: "30s", ramp: "10s" },
  baseline: { browse: 30, checkout: 120, hold: "4m", ramp: "1m" },
  target: { browse: 100, checkout: 300, hold: "5m", ramp: "1m" },
  stress: { browse: 200, checkout: 600, hold: "5m", ramp: "1m" },
};
const p = PROFILES[__ENV.PROFILE || "smoke"];
const arrival = (rate, unit, fn) => ({
  executor: "ramping-arrival-rate",
  exec: fn,
  startRate: 1,
  timeUnit: unit,
  preAllocatedVUs: 50,
  maxVUs: 1000,
  stages: [
    { duration: p.ramp, target: rate },
    { duration: p.hold, target: rate },
    { duration: "20s", target: 0 },
  ],
});

export const options = {
  summaryTrendStats,
  scenarios: {
    browse: arrival(p.browse, "1s", "browse"),
    checkout: arrival(p.checkout, "1m", "checkout"),
  },
  thresholds: Object.assign(
    th(["events", "event_detail", "search", "order_init", "webhook", "verify"]),
    {
      orders_5xx: ["count==0"],
      pay_final_not_success: ["count==0"],
      pay_webhook_http_err: ["count==0"],
    },
  ),
};

const created = new Counter("orders_created"),
  conflict = new Counter("orders_conflict");
const err5xx = new Counter("orders_5xx"),
  other = new Counter("orders_other");
const abandoned = new Counter("orders_abandoned"),
  rl429 = new Counter("rl_429");
const whOk = new Counter("pay_webhook_ok"),
  whBody = new Counter("pay_webhook_body_err"),
  whHttp = new Counter("pay_webhook_http_err");
const vOk = new Counter("pay_verify_ok"),
  v402 = new Counter("pay_verify_402"),
  v404 = new Counter("pay_verify_404"),
  vOther = new Counter("pay_verify_other");
const browseFail = new Counter("browse_fail");
const finalBad = new Counter("pay_final_not_success");

let gid = null; // guest_id cookie, kept per VU (the Secure flag can make k6 drop it over http)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function remember(r) {
  const c = r.cookies && r.cookies["guest_id"];
  if (c && c.length) gid = c[0].value;
}
function prm(name) {
  const o = { headers: hdrs(), tags: { endpoint: name } };
  if (gid) o.cookies = { guest_id: gid };
  return o;
}
function get(path, name) {
  const r = http.get(`${BASE}${path}`, prm(name));
  remember(r);
  if (r.status === 429) rl429.add(1);
  check(r, { [`${name} 200`]: (x) => x.status === 200 });
  if (r.status !== 200) {
    browseFail.add(1);
    console.warn(
      `BROWSE_FAIL ${name} status=${r.status} err=${r.error || "-"} code=${r.error_code} ms=${Math.round(r.timings.duration)}`,
    );
  }
  return r;
}

export function browse() {
  const r = Math.random();
  if (r < 0.35) {
    let q = `limit=20&offset=${20 * Math.floor(Math.random() * 12)}`;
    if (Math.random() < 0.4) q += `&category=${encodeURIComponent(pick(CATS))}`;
    if (Math.random() < 0.3) q += `&city=${pick(CITIES)}`;
    get(`${PATHS.events}?${q}`, "events");
  } else if (r < 0.6) {
    get(PATHS.eventById(pick(targets).eventId), "event_detail");
  } else if (r < 0.85) {
    get(`${PATHS.eventSearch}?q=${encodeURIComponent(pick(TERMS))}`, "search");
  } else if (r < 0.95 || !INCLUDE_VENDOR) {
    get(PATHS.csrf, "csrf");
  } else {
    get(PATHS.lbCategories, "leaderboard");
    get(PATHS.vendors, "vendors");
  }
}

export function checkout() {
  const t = pick(targets);
  const body = {
    email: `lt+${__VU}-${__ITER}@example.com`,
    firstName: "Load",
    lastName: "Test",
    phone: "08000000000",
    items: [{ eventId: t.eventId, ticketTierId: t.tierId, quantity: 1 }],
  };
  const init = http.post(
    `${BASE}${PATHS.orderInit}`,
    JSON.stringify(body),
    prm("order_init"),
  );
  remember(init);
  if (init.status === 429) {
    rl429.add(1);
    return;
  }
  if (init.status === 409) {
    conflict.add(1);
    return;
  }
  if (init.status >= 500) {
    err5xx.add(1);
    return;
  }
  if (init.status !== 201) {
    other.add(1);
    return;
  }
  created.add(1);

  const d = init.json("data");
  if (Math.random() < 0.3) {
    abandoned.add(1);
    return;
  } // left pending for the reaper (15 min)

  // customer pays; the webhook and the return-page /verify then arrive together
  http.post(`${STUB}/__pay/${d.reference}`, null, {
    tags: { endpoint: "stub" },
  });
  const wb = JSON.stringify({
    event: "charge.success",
    data: {
      reference: d.reference,
      status: "success",
      amount: d.amount_kobo,
      fees: 1000,
      channel: "card",
      currency: "NGN",
      paid_at: new Date().toISOString(),
    },
  });
  const sig = crypto.hmac("sha512", SECRET, wb, "hex");
  const wh = prm("webhook");
  wh.headers["x-paystack-signature"] = sig;

  const vp = prm("verify");
  vp.responseCallback = http.expectedStatuses({ min: 200, max: 299 }, 402, 404);
  const [w, v] = http.batch([
    ["POST", `${BASE}${PATHS.webhook}`, wb, wh],
    ["GET", `${BASE}${PATHS.verify(d.reference)}`, null, vp],
  ]);

  if (w.status === 200) {
    let ok = false;
    try {
      ok = w.json("status") === "success";
    } catch (e) {}
    (ok ? whOk : whBody).add(1);
  } else whHttp.add(1);
  if (v.status === 200) vOk.add(1);
  else if (v.status === 402) v402.add(1);
  else if (v.status === 404) v404.add(1);
  else vOther.add(1);

  sleep(0.3); // let the race settle, then read the real order state
  const fin = http.get(
    `${BASE}${PATHS.verify(d.reference)}`,
    prm("verify_final"),
  );
  let st = "";
  try {
    const o = fin.json("data");
    st = String(o.status || o.Status || "");
  } catch (e) {}
  if (st !== "success") finalBad.add(1);
}

export function handleSummary(data) {
  return compactSummary(data, "mixed");
}
