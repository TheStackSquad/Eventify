// frontend/e2e/vendor-form.spec.mjs

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { isNarrow, openList, openVendorForm } from "./support.mjs";

const STATE = /^State\b/i;
const CATEGORY = /^Category\b/i;

test.beforeEach(async ({ page }) => {
  await openVendorForm(page);
});

test.describe("layout", () => {
  test("the page never scrolls sideways", async ({ page }) => {
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test("the form uses the phone width", async ({ page }) => {
    test.skip(!isNarrow(page), "phones only");
    const width = await page
      .locator("form")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThanOrEqual(page.viewportSize().width - 72); // rail gone, padding trimmed
  });

  test("phones get a bottom bar, larger screens the side rail", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "Dashboard" });
    const collapse = page.getByRole("button", { name: /collapse sidebar/i });
    if (isNarrow(page)) {
      await expect(nav).toBeVisible();
      await expect(collapse).toBeHidden();
    } else {
      await expect(nav).toBeHidden();
      await expect(collapse).toBeVisible();
    }
  });

  test("Logout is reachable from the More menu on phones", async ({ page }) => {
    test.skip(!isNarrow(page), "phones only");
    await page.getByRole("button", { name: "More" }).click();
    const item = page.getByRole("menuitem", { name: "Logout" });
    await expect(item).toBeVisible();
    await item.click({ trial: true }); // fails if anything covers it
    const box = await item.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  });

  test("the submit button is reachable, uncovered and on one line", async ({
    page,
  }) => {
    const button = page.getByRole("button", {
      name: /create profile|save changes/i,
    });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
    await button.click({ trial: true });
    const box = await button.boundingBox();
    expect(box.height).toBeLessThan(64); // a wrapped label is taller
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  });

  test("dropdown fields are at least 44px tall on touch screens", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "touch screens only");
    for (const name of [STATE, CATEGORY]) {
      const box = await page.getByRole("combobox", { name }).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("dropdowns", () => {
  for (const [label, name] of [
    ["State", STATE],
    ["Category", CATEGORY],
  ]) {
    test(`${label} list opens fully inside the screen`, async ({ page }) => {
      const { panel } = await openList(page, name);
      const box = await panel.boundingBox();
      const v = page.viewportSize();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(v.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(v.height + 0.5);
    });
  }

  test("on a phone the list is a bottom sheet, at most 70% of the height", async ({
    page,
  }) => {
    const v = page.viewportSize();
    test.skip(v.width >= 640 && v.height >= 480, "popover layout");
    const { panel } = await openList(page, STATE);
    const box = await panel.boundingBox();
    expect(box.height).toBeLessThanOrEqual(v.height * 0.7 + 1);
    expect(box.y + box.height).toBeGreaterThanOrEqual(v.height - 1); // anchored to the bottom
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  });

  test("rows are at least 44px tall on touch screens", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "touch screens only");
    const { list } = await openList(page, STATE);
    const box = await list.getByRole("option").first().boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(43.5);
  });

  test("choosing a state by search updates the field and closes the list", async ({
    page,
  }) => {
    await openList(page, STATE);
    await page.getByRole("searchbox", { name: /search state/i }).fill("lag");
    await page.getByRole("option", { name: "Lagos" }).click();
    await expect(page.getByRole("combobox", { name: STATE })).toContainText(
      "Lagos",
    );
    await expect(page.getByRole("listbox")).toBeHidden();
  });

  test("Escape closes the list and returns focus to the field", async ({
    page,
  }) => {
    const { trigger } = await openList(page, STATE);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("accessibility", () => {
  test("no critical accessibility violations on the form", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include("form")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    const serious = results.violations.filter((v) => v.impact === "serious");
    // Serious ones (for example low-contrast placeholder text) are reported, not failed, until you decide to fix them.
    test
      .info()
      .annotations.push(
        ...serious.map((v) => ({
          type: "a11y-serious",
          description: `${v.id}: ${v.nodes.length} node(s)`,
        })),
      );
    expect(critical.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
