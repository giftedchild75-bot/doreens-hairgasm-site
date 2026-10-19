import { test, expect } from "@playwright/test";

test.describe("continue with Google", () => {
  test("sign-in and sign-up pages offer Google first", async ({ page }) => {
    for (const path of ["/account/login", "/account/register"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: /with Google/ })).toBeVisible();
    }
  });

  test("the button hands off to Google with PKCE", async ({ request }) => {
    const res = await request.get("/api/auth/google?next=/checkout", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const to = new URL(res.headers()["location"]);
    expect(to.host).toBe("accounts.google.com");
    expect(to.searchParams.get("client_id")).toBe("e2e-client.apps.googleusercontent.com");
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(res.headers()["set-cookie"]).toMatch(/dh_google=.*HttpOnly/i);
  });

  test("a forged callback is rejected", async ({ page }) => {
    await page.goto("/api/auth/google/callback?code=x&state=forged");
    await expect(page).toHaveURL(/\/account\/login\?error=google/);
    await expect(page.locator(".notice.error")).toContainText("couldn't sign you in with Google");
  });
});
