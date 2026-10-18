import { expect, test, type Page } from "@playwright/test";

async function addAndGoToCheckout(page: Page, slug: string) {
  await page.goto(`/products/${slug}`);
  await page.getByRole("button", { name: "Buy now" }).click();
  await expect(page).toHaveURL(/\/checkout/);
}

async function fillCheckout(page: Page, email = "buyer@example.com") {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Full name").fill("Ada Buyer");
  await page.getByLabel("Phone (WhatsApp preferred)").fill("+234 800 000 0000");
  await page.getByLabel("Street address").fill("12 Allen Avenue");
  await page.getByLabel("City / town").fill("Ikeja");
  await page.getByLabel("State").selectOption("Lagos");
  await expect(page.getByRole("radio", { name: /Nationwide delivery/ })).toBeChecked();
}

test.describe("checkout", () => {
  test("validates required details before payment", async ({ page }) => {
    await addAndGoToCheckout(page, "nia");
    await page.getByLabel("State").selectOption("Lagos");
    await page.getByRole("button", { name: /^Pay/ }).click();
    await expect(page.locator(".notice.error")).toContainText(/check the highlighted fields/i);
    await expect(page).toHaveURL(/\/checkout/);
  });

  test("successful payment is verified server-side and marks the order paid", async ({ page }) => {
    await addAndGoToCheckout(page, "alicia");
    await fillCheckout(page);
    await expect(page.locator(".summary-row.total")).toContainText("₦75,000"); // 70,000 + 5,000 delivery
    await page.getByRole("button", { name: "Pay ₦75,000" }).click();
    await expect(page.getByRole("heading", { name: "Mock Paystack checkout" })).toBeVisible();
    await expect(page.getByText("Amount: 7500000 kobo")).toBeVisible(); // server-computed amount
    await page.locator("#pay-success").click();
    await expect(page).toHaveURL(/\/orders\/DH-[A-Z2-9]{8}/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paid — preparing your order");
    await expect(page.getByRole("status")).toContainText("payment has been verified");
  });

  test("a declined payment never produces a paid order and can be retried", async ({ page }) => {
    await addAndGoToCheckout(page, "monica");
    await fillCheckout(page);
    await page.getByRole("button", { name: /^Pay ₦/ }).click();
    await page.locator("#pay-fail").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payment didn't go through");
    await page.getByRole("button", { name: /^Pay ₦/ }).click();
    await page.locator("#pay-success").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paid — preparing your order");
  });

  test("returning to the callback URL by hand does not mark anything paid", async ({ page }) => {
    await addAndGoToCheckout(page, "kira");
    await fillCheckout(page);
    await page.getByRole("button", { name: /^Pay ₦/ }).click();
    await page.waitForURL(/\/pay\//);
    const ref = page.url().split("/pay/")[1];
    await page.goto(`/checkout/callback?reference=${ref}`); // skip paying entirely
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Awaiting payment|Payment didn't go through/);
  });

  test("sold-out items cannot be bought", async ({ page, browser }) => {
    // Octavia has exactly one unit in the e2e database.
    await addAndGoToCheckout(page, "octavia");
    await fillCheckout(page);
    await page.getByRole("button", { name: /^Pay ₦/ }).click();
    await page.locator("#pay-success").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paid — preparing your order");

    const other = await browser.newPage();
    await other.goto("/products/octavia");
    await expect(other.locator(".stock-line")).toHaveText("Sold out");
    await expect(other.getByRole("button", { name: "Sold out" })).toBeDisabled();
    await other.close();
  });

  test("order pages are private to the buyer", async ({ page, browser }) => {
    await addAndGoToCheckout(page, "nova");
    await fillCheckout(page);
    await page.getByRole("button", { name: /^Pay ₦/ }).click();
    await page.locator("#pay-success").click();
    await expect(page).toHaveURL(/\/orders\/DH-/);
    const orderPath = new URL(page.url()).pathname;
    const stranger = await browser.newPage();
    const res = await stranger.goto(orderPath);
    expect(res?.status()).toBe(404);
    await stranger.close();
  });
});
