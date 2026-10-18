import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { BASE, PATHS, hdrs } from "./lib/config.js";
import { compactSummary, summaryTrendStats } from "./lib/summary.js";

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409));

const race = JSON.parse(open("./data/race.json"));
const MODE = __ENV.MODE || "race"; // race | deadlock
const STOCK = race.stock;
const VUS = Number(__ENV.VUS || (MODE === "race" ? STOCK * 5 : 40));
const ITERS = Number(__ENV.ITERS || (MODE === "race" ? 1 : 25));

const accepted = new Counter("orders_accepted");
const soldout = new Counter("orders_soldout");
const limited = new Counter("orders_ratelimited");
const badreq = new Counter("orders_badrequest");
const err5xx = new Counter("orders_5xx");
const other = new Counter("orders_other");

export const options = {
  summaryTrendStats,
  scenarios: {
    race: {
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: ITERS,
      maxDuration: "3m",
    },
  },
  thresholds: Object.assign(
    {
      orders_5xx: ["count==0"],
      orders_badrequest: ["count==0"],
      orders_ratelimited: ["count==0"],
      orders_other: ["count==0"],
    },
    MODE === "race"
      ? { orders_accepted: [`count==${STOCK}`] }
      : { orders_soldout: ["count==0"] },
  ),
};

export default function () {
  const items =
    MODE === "race"
      ? [{ eventId: race.eventId, ticketTierId: race.lowTierId, quantity: 1 }]
      : [
          { eventId: race.eventId, ticketTierId: race.tierA, quantity: 1 },
          { eventId: race.eventId, ticketTierId: race.tierB, quantity: 1 },
        ];
  if (MODE !== "race" && Math.random() < 0.5) items.reverse();

  const body = {
    email: `${MODE}+${__VU}-${__ITER}@example.com`,
    firstName: "Race",
    lastName: "Test",
    phone: "08000000000",
    items,
  };
  const r = http.post(`${BASE}${PATHS.orderInit}`, JSON.stringify(body), {
    headers: hdrs(),
    tags: { endpoint: "order_init" },
  });

  if (r.status === 201 || r.status === 200) accepted.add(1);
  else if (r.status === 409) soldout.add(1);
  else if (r.status === 429) limited.add(1);
  else if (r.status === 400) badreq.add(1);
  else if (r.status >= 500) err5xx.add(1);
  else { other.add(1); console.warn(`OTHER status=${r.status} err=${r.error || '-'} ms=${Math.round(r.timings.duration)}`); }
  check(r, { "no 5xx": (x) => x.status < 500 });
}

export function handleSummary(data) {
  return compactSummary(data, MODE === "race" ? "oversell" : "deadlock");
}
