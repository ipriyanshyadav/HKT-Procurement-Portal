import { test, expect } from "@playwright/test";

const SUPPLIER_URL = process.env.SUPPLIER_URL || "http://localhost:3001";

test.describe("Critical Supplier Flows", () => {
  test.setTimeout(60_000);

  test("supplier can log in, view dashboard, and access purchase orders", async ({ page }) => {
    // 1. Navigate to Supplier Login
    await page.goto(`${SUPPLIER_URL}/login`);
    await expect(page.locator("input#email")).toBeVisible();

    // 2. Perform Login
    await page.fill("input#email", "supplier@acme.com");
    await page.fill("input#password", "Supplier123456!@#");
    await page.click('button[type="submit"]');

    // 3. Confirm redirection to Supplier Dashboard / Portal
    await page.waitForURL(/.*(profile|dashboard|purchase-orders)/, { timeout: 15_000 });

    // 4. Navigate to Purchase Orders
    await page.goto(`${SUPPLIER_URL}/purchase-orders`);
    await expect(page.locator("body")).toContainText("Purchase Order");
  });
});
