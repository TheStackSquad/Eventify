//audit/k6/auth-flow.js

import http from "k6/http";
import { check, sleep } from "k6";
import { BASE, PATHS, th } from "./lib/config.js";
import { compactSummary, summaryTrendStats } from "./lib/summary.js";

export const options = {
  summaryTrendStats,
  scenarios: {
    main: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 3),
      duration: "1m",
    },
  },
  thresholds: th(["login"]),
};

export default function () {
  const jar = http.cookieJar();
  http.get(`${BASE}${PATHS.csrf}`); // double-submit cookie is set here
  const c = jar.cookiesForURL(BASE).csrf_token;
  const res = http.post(
    `${BASE}${PATHS.login}`,
    JSON.stringify({ email: __ENV.TEST_EMAIL, password: __ENV.TEST_PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": c ? c[0] : "",
      },
      tags: { endpoint: "login" },
    },
  );
  check(res, { "login 200": (r) => r.status === 200 });
  sleep(1);
}

export function handleSummary(data) {
  return compactSummary(data, "auth-flow");
}