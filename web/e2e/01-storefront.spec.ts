import { expect, test } from "@playwright/test";

test.describe("storefront", () => {
  test("homepage keeps the brand and core sections", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Doreen's Hairgasm/);
    await expect(page.locator(".logo-script").first()).toHaveText("Hairgasm");
    // Approved hero image (salon, mannequin, branded bag) is used as-is.
    await expect(page.locator(".hero-media-img")).toHaveAttribute("src", "/assets/hero-install.jpg");
    await expect(page.getByRole("heading", { name: /Your hair/ })).toBeVisible();
    for (const id of ["#collection", "#shade-finder", "#why", "#featured", "#faq", "#order"]) {
      await expect(page.locator(id)).toHaveCount(1);
    }
    await expect(page.locator('a[href*="wa.me/2349130213524"]').first()).toBeAttached();
    await expect(page.locator('a[href="https://www.tiktok.com/@doreens.hairgasm"]').first()).toBeAttached();
    await expect(page.locator('a[href="https://www.instagram.com/doreens_hairgasm"]').first()).toBeAttached();
  });

  test("navigation reaches shop, about and contact", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shop All" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "The Collection" })).toBeVisible();
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("your crown");
    await page.goto("/guide");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choosing your first unit");
    await expect(page.locator("#lace, #length, #care")).toHaveCount(3);
    await page.goto("/contact");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contact Us");
  });

  test("catalogue search and filters use real data", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByText("43 pieces")).toBeVisible();
    await page.goto("/shop?texture=curly&color=red");
    await expect(page.locator(".card")).toHaveCount(5);
    await expect(page.locator(".card h3")).toContainText(["Brooklyn Dark Auburn", "Jasmine — Ginger", "Karen II", "Nelly Gold", "Nelly Wine"]);
    await page.goto("/shop");
    const search = page.getByRole("searchbox", { name: "Search the collection" });
    await search.fill("jasmine");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=jasmine/);
    await expect(page.locator(".card")).toHaveCount(5);
    await page.goto("/shop?q=zzzznothing");
    await expect(page.getByText(/No pieces match/)).toBeVisible();
  });

  test("price sorting is correct", async ({ page }) => {
    await page.goto("/shop?category=wigs&sort=price-asc");
    const prices = await page.locator(".card .price").allTextContents();
    const nums = prices.map((p) => Number(p.replace(/[^0-9]/g, "")));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect(nums[0]).toBe(28500);
  });

  test("shade finder recommends products that exist", async ({ page }) => {
    await page.goto("/#shade-finder");
    await page.getByRole("radio", { name: "Cool" }).click();
    await page.getByRole("radio", { name: "Bob" }).click();
    await page.getByRole("radio", { name: "Straight" }).click();
    const first = page.locator(".shade-result a[href^='/products/']").first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.locator(".pdp-info h1")).toBeVisible();
  });

  test("bag persists across reloads and quantity updates", async ({ page }) => {
    await page.goto("/products/alicia");
    await expect(page.locator(".pdp-price")).toHaveText("₦70,000");
    await page.getByRole("button", { name: "Add to bag" }).click();
    await expect(page.getByRole("status")).toContainText("added to your bag");
    await page.reload();
    await expect(page.locator(".bag-count")).toHaveText("1");
    await page.goto("/cart");
    await page.getByRole("button", { name: "Increase" }).click();
    await expect(page.locator(".summary-row.total")).toContainText("₦140,000");
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(/Your bag is empty/)).toBeVisible();
  });

  test("services are booked on WhatsApp, not sold online", async ({ page }) => {
    await page.goto("/products/custom-install");
    await expect(page.getByRole("link", { name: "Book on WhatsApp" })).toHaveAttribute("href", /wa\.me/);
    await expect(page.getByRole("button", { name: "Add to bag" })).toHaveCount(0);
  });

  test("product pages expose structured data and canonical URL", async ({ page }) => {
    await page.goto("/products/alicia");
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld["@type"]).toBe("Product");
    expect(ld.offers[0]).toMatchObject({ price: "70000.00", priceCurrency: "NGN" });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/products\/alicia$/);
    const res = await page.request.get("/sitemap.xml");
    expect(await res.text()).toContain("/products/alicia");
  });
});
