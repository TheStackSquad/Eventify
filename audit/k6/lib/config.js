//audit/k6/lib/config.

export const BASE = __ENV.BASE_URL || "http://localhost:8081";
export const STUB = __ENV.STUB_URL || "http://localhost:9099";
export const SECRET = __ENV.WEBHOOK_SECRET || "sk_test_local_loadtest_only";
const SPOOF = __ENV.SPOOF_IP !== "0"; // see finding E: each fake IP gets its own limiter bucket

export const PATHS = {
  events: "/events",
  eventSearch: "/events/search",
  eventById: (id) => `/events/${id}`,
  vendors: "/api/v1/vendors",
  lbCategories: "/api/v1/leaderboard/top-by-categories",
  csrf: "/api/csrf-token",
  orderInit: "/api/orders/initialize",
  verify: (ref) => `/api/payments/verify/${ref}`,
  webhook: "/api/webhooks/paystack",
};

// p95 targets in ms; starting points, tune after the baseline
export const SLO = {
  events: 300,
  event_detail: 300,
  search: 500,
  order_init: 800,
  webhook: 500,
  verify: 800,
};

export function th(names) {
  const t = { http_req_failed: ["rate<0.01"], checks: ["rate>0.99"] };
  for (const n of names) {
    t[`http_req_duration{endpoint:${n}}`] = [
      `p(95)<${SLO[n]}`,
      `p(99)<${SLO[n] * 3}`,
    ];
  }
  return t;
}

const rnd = (n) => Math.floor(Math.random() * n);
export function hdrs() {
  const h = { "Content-Type": "application/json" };
  if (SPOOF)
    h["X-Forwarded-For"] = `10.${rnd(256)}.${rnd(256)}.${1 + rnd(254)}`;
  return h;
}