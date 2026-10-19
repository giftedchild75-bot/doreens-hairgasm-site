import { test, expect } from "@playwright/test";

test("shoppers can heart a piece and find it again on the Saved page", async ({ page }) => {
  await page.goto("/saved");
  await expect(page.getByText("Nothing saved yet")).toBeVisible();

  await page.goto("/shop");
  const heart = page.getByRole("button", { name: /^Save .* for later$/ }).first();
  const name = (await heart.getAttribute("aria-label"))!.replace(/^Save | for later$/g, "");
  await heart.click();
  await expect(page.getByRole("button", { name: `Remove ${name} from saved` })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Saved pieces, 1" })).toBeVisible();

  await page.getByRole("link", { name: "Saved pieces, 1" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Survives a reload (kept in this browser), and can be removed again.
  await page.reload();
  await page.getByRole("button", { name: `Remove ${name} from saved` }).click();
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
});
