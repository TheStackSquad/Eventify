import http from "k6/http";
import crypto from "k6/crypto";
import { Counter } from "k6/metrics";
import { BASE, SECRET, PATHS, hdrs } from "./lib/config.js";
import { compactSummary, summaryTrendStats } from "./lib/summary.js";

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 401));

const targets = JSON.parse(open("./data/targets.json"));
const N = Number(__ENV.ORDERS || 40); // keep it a multiple of 4
const REPLAYS = Number(__ENV.REPLAYS || 5);

const replayOk = new Counter("wh_replay_body_success");
const replayErr = new Counter("wh_replay_body_error");
const replayBad = new Counter("wh_replay_http_unexpected");
const sigRejected = new Counter("wh_badsig_rejected");
const sigAccepted = new Counter("wh_badsig_accepted");

export const options = {
  summaryTrendStats,
  scenarios: {
    matrix: {
      executor: "per-vu-iterations",
      vus: N,
      iterations: 1,
      maxDuration: "2m",
    },
  },
  thresholds: {
    wh_badsig_accepted: ["count==0"],
    wh_replay_http_unexpected: ["count==0"],
  },
};

export function setup() {
  const orders = [];
  for (let i = 0; i < N; i++) {
    const t = targets[i % targets.length];
    const r = http.post(
      `${BASE}${PATHS.orderInit}`,
      JSON.stringify({
        email: `wh+${i}@example.com`,
        firstName: "Hook",
        lastName: "Test",
        phone: "08000000000",
        items: [
          { eventId: t.eventId, ticketTierId: t.tierId, quantity: 1 + (i % 2) },
        ],
      }),
      { headers: hdrs(), tags: { endpoint: "setup_init" } },
    );
    if (r.status !== 201)
      throw new Error(`setup order ${i} failed: ${r.status} ${r.body}`);
    const d = r.json("data");
    orders.push({ ref: d.reference, amount: d.amount_kobo });
  }
  return { orders };
}

const URL = `${BASE}${PATHS.webhook}`;
const sign = (b, key) => crypto.hmac("sha512", key || SECRET, b, "hex");
const make = (o, event, over) =>
  JSON.stringify({
    event,
    data: Object.assign(
      {
        reference: o.ref,
        status: "success",
        amount: o.amount,
        fees: 1000,
        channel: "card",
        currency: "NGN",
        paid_at: new Date().toISOString(),
      },
      over || {},
    ),
  });
const prm = (sig) => ({
  headers: { "Content-Type": "application/json", "x-paystack-signature": sig },
  tags: { endpoint: "webhook" },
});
const state = (r) => {
  try {
    return JSON.parse(r.body).status;
  } catch (e) {
    return "unparsed";
  }
};

export default function (data) {
  const i = __VU - 1;
  const o = data.orders[i];
  switch (i % 4) {
    case 0: {
      // replay: the same valid webhook delivered REPLAYS times at once
      const b = make(o, "charge.success"),
        s = sign(b);
      const rs = http.batch(
        Array.from({ length: REPLAYS }, () => ["POST", URL, b, prm(s)]),
      );
      rs.forEach((r) => {
        if (r.status !== 200) replayBad.add(1);
        else if (state(r) === "success") replayOk.add(1);
        else replayErr.add(1);
      });
      break;
    }
    case 1: {
      // tampered amount, valid signature: should become 'fraud' and release stock
      const b = make(o, "charge.success", { amount: o.amount - 100 });
      http.post(URL, b, prm(sign(b)));
      break;
    }
    case 2: {
      // payment failed upstream: should become 'failed' and release stock
      const b = make(o, "charge.failed", { status: "failed" });
      http.post(URL, b, prm(sign(b)));
      break;
    }
    default: {
      // forged signature first (must be refused), then the real one
      const b = make(o, "charge.success");
      const bad = http.post(URL, b, prm(sign(b, "wrong-secret")));
      (bad.status === 401 ? sigRejected : sigAccepted).add(1);
      http.post(URL, b, prm(sign(b)));
    }
  }
}

export function handleSummary(data) {
  return compactSummary(data, "webhook");
}
