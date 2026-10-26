import { expect, test } from "@playwright/test";

test.describe("mobile", () => {
  for (const path of ["/", "/shop", "/products/alicia", "/cart", "/account/login"]) {
    test(`no horizontal scrolling on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  // Real phones span 320–414px; the header used to overflow between 320 and 400.
  for (const width of [320, 360, 375, 390, 414]) {
    test(`header and pages fit a ${width}px phone`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ["/", "/shop", "/products/alicia"]) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test("menu opens, navigates and closes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.locator("#mobile-menu");
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Wigs" }).click();
    await expect(page).toHaveURL(/category=wigs/);
    await expect(menu).toBeHidden();
  });

  test("filters are reachable behind the Filters button", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.locator("#shop-filters")).toBeHidden();
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.locator("#shop-filters")).toBeVisible();
  });
});
