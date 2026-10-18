//audit/k6/verify.js


import http from "k6/http";
import crypto from "k6/crypto";
import { Counter } from "k6/metrics";
import { sleep } from "k6";
import { BASE, STUB, SECRET, PATHS, hdrs } from "./lib/config.js";
import { compactSummary, summaryTrendStats } from "./lib/summary.js";

http.setResponseCallback(
  http.expectedStatuses({ min: 200, max: 299 }, 402, 404, 409),
);

const targets = JSON.parse(open("./data/targets.json"));
const N = Number(__ENV.ORDERS || 40); // keep it even: half run each scenario

const initFailed = new Counter("pay_init_failed");
const raceOk = new Counter("pay_race_verify_ok");
const raceOther = new Counter("pay_race_verify_other");
const raceBad = new Counter("pay_race_final_bad");
const earlyPending = new Counter("pay_early_pending");
const earlyUnprotected = new Counter("pay_early_unprotected");
const earlyBad = new Counter("pay_early_final_bad");

export const options = {
  summaryTrendStats,
  scenarios: {
    v: {
      executor: "per-vu-iterations",
      vus: N,
      iterations: 1,
      maxDuration: "2m",
    },
  },
  thresholds: {
    pay_init_failed: ["count==0"],
    pay_race_verify_other: ["count==0"],
    pay_race_final_bad: ["count==0"],
    pay_early_unprotected: ["count==0"],
    pay_early_final_bad: ["count==0"],
  },
};

const statusOf = (r) => {
  try {
    const o = r.json("data");
    return String(o.status || o.Status || "");
  } catch (e) {
    return "";
  }
};
const codeOf = (r) => {
  try {
    return r.json("code");
  } catch (e) {
    return "";
  }
};

export default function () {
  const t = targets[(__VU * 7) % targets.length];
  const ir = http.post(
    `${BASE}${PATHS.orderInit}`,
    JSON.stringify({
      email: `vr+${__VU}@example.com`,
      firstName: "Verify",
      lastName: "Test",
      phone: "08000000000",
      items: [{ eventId: t.eventId, ticketTierId: t.tierId, quantity: 1 }],
    }),
    { headers: hdrs(), tags: { endpoint: "init" } },
  );
  if (ir.status !== 201) {
    initFailed.add(1);
    console.warn(`init failed status=${ir.status}`);
    return;
  }

  const d = ir.json("data");
  const gc = ir.cookies["guest_id"];
  const gid = gc && gc.length ? gc[0].value : null;
  const vp = () => ({
    headers: hdrs(),
    cookies: gid ? { guest_id: gid } : {},
    tags: { endpoint: "verify" },
  });
  const VERIFY = `${BASE}${PATHS.verify(d.reference)}`;
  const pay = () =>
    http.post(`${STUB}/__pay/${d.reference}`, null, {
      tags: { endpoint: "stub" },
    });

  const body = JSON.stringify({
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
  const wh = {
    headers: Object.assign(hdrs(), {
      "x-paystack-signature": crypto.hmac("sha512", SECRET, body, "hex"),
    }),
    tags: { endpoint: "webhook" },
  };

  if (__VU % 2 === 1) {
    // Scenario 1: the webhook and the return page arrive together
    pay();
    const [w, v] = http.batch([
      ["POST", `${BASE}${PATHS.webhook}`, body, wh],
      ["GET", VERIFY, null, vp()],
    ]);
    (v.status === 200 ? raceOk : raceOther).add(1);
    sleep(0.5);
    const f = http.get(VERIFY, vp());
    if (!(f.status === 200 && statusOf(f) === "success")) raceBad.add(1);
  } else {
    // Scenario 2: customer reaches the return page BEFORE paying, then pays
    const e = http.get(VERIFY, vp());
    (e.status === 402 && codeOf(e) === "PAYMENT_PENDING"
      ? earlyPending
      : earlyUnprotected
    ).add(1);
    sleep(0.2);
    pay();
    http.post(`${BASE}${PATHS.webhook}`, body, wh);
    sleep(0.4);
    const f = http.get(VERIFY, vp());
    if (!(f.status === 200 && statusOf(f) === "success")) earlyBad.add(1);
  }
}

export function handleSummary(data) {
  return compactSummary(data, "verify");
}
