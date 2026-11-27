// frontend/e2e/global-setup.mjs

import { request } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const STATE_PATH = fileURLToPath(
  new URL("./.auth/state.json", import.meta.url),
);

export default async function globalSetup() {
  const api = await request.newContext({
    baseURL: process.env.E2E_API_URL || "http://localhost:8081",
  });

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e_${stamp}@example.com`;
  const password = `Aa1!${stamp}${stamp}`;

  const signup = await api.post("/auth/signup", {
    data: { name: "E2E Tester", email, password },
  });
  if (!signup.ok()) {
    throw new Error(
      `E2E signup failed (${signup.status()}). Is the rig backend up on E2E_API_URL? ${await signup.text()}`,
    );
  }
  const login = await api.post("/auth/login", { data: { email, password } });
  if (!login.ok())
    throw new Error(
      `E2E login failed (${login.status()}): ${await login.text()}`,
    );

  mkdirSync(dirname(STATE_PATH), { recursive: true });
  await api.storageState({ path: STATE_PATH });
  await api.dispose();
}