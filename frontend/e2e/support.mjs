// frontend/e2e/support.mjs

import { expect } from "@playwright/test";

export const PHONE_BELOW = 640; // same breakpoint as the sidebar and SelectField
export const isNarrow = (page) => page.viewportSize().width < PHONE_BELOW;

export async function openVendorForm(page) {
  await page.goto("/dashboard");
  if (/\/account\/auth\/login/.test(page.url())) {
    throw new Error(
      "Not signed in: the session from global-setup was rejected. Check the backend is up on E2E_API_URL and its cookies are not Secure-only.",
    );
  }

  const heading = page.getByRole("heading", {
    name: /register business|update profile/i,
  });
  const entry = isNarrow(page)
    ? page
        .getByRole("navigation", { name: "Dashboard" })
        .getByRole("button", { name: /register|profile/i })
        .first()
    : page.getByRole("button", { name: /vendor portal/i });

  await expect(heading.or(entry).first()).toBeVisible();

  if (!(await heading.isVisible())) {
    if (isNarrow(page)) {
      await entry.click();
    } else {
      const sub = page.getByRole("button", {
        name: /register as vendor|edit profile/i,
      });
      if (!(await sub.isVisible())) await entry.click(); // expand the Vendor Portal group
      await sub.click();
    }
  }
  await expect(heading).toBeVisible();
  await expect(page.locator("form").first()).toBeVisible();
}

// Opens a SelectField and returns its parts. The panel holds the search box and the list.
export async function openList(page, name) {
  const trigger = page.getByRole("combobox", { name });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  return { trigger, list, panel: list.locator("xpath=..") };
}