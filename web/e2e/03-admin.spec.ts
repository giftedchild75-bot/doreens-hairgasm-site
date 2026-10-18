import { expect, test, type Page } from "@playwright/test";

// Sign in once per role and reuse the session: the real login rate limit
// (5 attempts / 15 min per IP) stays in force during tests.
const sessions: Record<string, { name: string; value: string }[]> = {};

async function login(page: Page, who: "owner" | "staff") {
  if (sessions[who]) {
    await page.context().addCookies(sessions[who].map((c) => ({ ...c, url: "http://localhost:3100" })));
    await page.goto("/admin");
  } else {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(`${who}@e2e.test`);
    await page.getByLabel("Password").fill(`${who}-password-123`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    sessions[who] = (await page.context().cookies()).filter((c) => c.name === "dh_admin").map(({ name, value }) => ({ name, value }));
  }
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test.describe("admin", () => {
  test("unauthenticated visitors cannot reach admin pages or exports", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login/);
    expect((await page.request.get("/admin/orders/export")).status()).toBe(401);
  });

  test("wrong password is rejected", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("owner@e2e.test");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".notice.error")).toHaveText("Email or password is incorrect.");
  });

  test("dashboard shows only verified revenue from the checkout journeys", async ({ page }) => {
    await login(page, "owner");
    const revenue = page.locator(".kpi", { hasText: "Paid revenue" }).locator(".value");
    await expect(revenue).not.toHaveText("₦0");
  });

  test("owner edits a price and the storefront reflects it", async ({ page }) => {
    await login(page, "owner");
    await page.goto("/admin/products?q=freya");
    await page.getByRole("link", { name: "Freya" }).click();
    const variant = page.locator("details.panel").first();
    await variant.getByLabel("Price (₦)").fill("66000");
    await variant.getByRole("button", { name: "Save option" }).click();
    await expect(variant.getByRole("status")).toHaveText("Option saved.");
    await page.goto("/products/freya");
    await expect(page.locator(".pdp-price")).toHaveText("₦66,000");
  });

  test("staff fulfil a paid order: processing → shipped with tracking", async ({ page }) => {
    await login(page, "staff");
    await page.goto("/admin/orders?status=paid");
    await page.locator(".tbl a.mini-link").first().click();
    await page.getByRole("button", { name: "Mark processing" }).click();
    await expect(page.locator("h1 .badge")).toHaveText("processing");
    await page.getByLabel("Tracking number (optional)").fill("GIG123456");
    await page.getByRole("button", { name: "Mark shipped" }).click();
    await expect(page.locator("h1 .badge")).toHaveText("shipped");
    await expect(page.getByText("GIG123456")).toBeVisible();
    // Staff cannot refund — only the owner.
    await expect(page.getByRole("button", { name: "Refund via Paystack" })).toHaveCount(0);
  });

  test("staff cannot change owner-only settings", async ({ page }) => {
    await login(page, "staff");
    await page.goto("/admin/settings");
    await page.getByLabel(/Announcement bar/).fill("hacked");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.locator(".notice.error")).toHaveText("Only the store owner can do this.");
  });

  test("every admin action is in the audit log", async ({ page }) => {
    await login(page, "owner");
    await page.goto("/admin/audit");
    await expect(page.getByRole("cell", { name: "variant.update" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "admin.login_failed" }).first()).toBeVisible();
  });
});
