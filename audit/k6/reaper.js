import http from "k6/http";
import crypto from "k6/crypto";
import { Counter } from "k6/metrics";
import { sleep } from "k6";
import { BASE, STUB, SECRET, PATHS, hdrs } from "./lib/config.js";
import { compactSummary, summaryTrendStats } from "./lib/summary.js";

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409));

const N = Number(__ENV.ORDERS || 100);
const SPREAD = Number(__ENV.SPREAD_S || 70); // seconds over which payments arrive
const orders = JSON.parse(open("./data/targets.json"));

const initFailed = new Counter("pay_init_failed");
const whHttp = new Counter("wh_http_unexpected");

export const options = {
  summaryTrendStats,
  scenarios: {
    r: {
      executor: "per-vu-iterations",
      vus: N,
      iterations: 1,
      maxDuration: "4m",
    },
  },
  thresholds: {
    pay_init_failed: ["count==0"],
    wh_http_unexpected: ["count==0"],
  },
};

// setup(): create N pending orders and print their references; the PowerShell wrapper ages them
export function setup() {
  const refs = [];
  for (let i = 0; i < N; i++) {
    const t = orders[(i * 3) % orders.length];
    const r = http.post(
      `${BASE}${PATHS.orderInit}`,
      JSON.stringify({
        email: `rp+${i}@example.com`,
        firstName: "Reap",
        lastName: "Test",
        phone: "08000000000",
        items: [{ eventId: t.eventId, ticketTierId: t.tierId, quantity: 1 }],
      }),
      { headers: hdrs(), tags: { endpoint: "setup_init" } },
    );
    if (r.status !== 201) {
      initFailed.add(1);
      continue;
    }
    const d = r.json("data");
    http.post(`${STUB}/__pay/${d.reference}`, null, {
      tags: { endpoint: "stub" },
    });
    refs.push({ ref: d.reference, amount: d.amount_kobo });
  }
  return { refs };
}

export default function (data) {
  const o = data.refs[__VU - 1];
  if (!o) return;
  sleep(Math.random() * SPREAD); // payments arrive across the reaper tick
  const b = JSON.stringify({
    event: "charge.success",
    data: {
      reference: o.ref,
      status: "success",
      amount: o.amount,
      fees: 1000,
      channel: "card",
      currency: "NGN",
      paid_at: new Date().toISOString(),
    },
  });
  const r = http.post(`${BASE}${PATHS.webhook}`, b, {
    headers: Object.assign(hdrs(), {
      "x-paystack-signature": crypto.hmac("sha512", SECRET, b, "hex"),
    }),
    tags: { endpoint: "webhook" },
  });
  if (r.status !== 200) whHttp.add(1);
}

export function handleSummary(data) {
  return compactSummary(data, "reaper");
}
