//audit/k6/lib/profiles.js

export const profiles = {
  smoke: { executor: "constant-vus", vus: 1, duration: "30s" },
  load: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m", target: 25 },
      { duration: "3m", target: 50 },
      { duration: "1m", target: 0 },
    ],
  },
  stress: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "2m", target: 50 },
      { duration: "3m", target: 100 },
      { duration: "3m", target: 200 },
      { duration: "2m", target: 0 },
    ],
  },
  spike: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: 10 },
      { duration: "20s", target: 200 },
      { duration: "1m", target: 200 },
      { duration: "30s", target: 10 },
    ],
  },
};
