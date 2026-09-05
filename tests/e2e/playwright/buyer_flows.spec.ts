import { test, expect } from "@playwright/test";

const BUYER_URL = process.env.BUYER_URL || "http://localhost:3000";

test.describe("Critical Buyer Flows", () => {
  test.setTimeout(60_000);

  test("buyer can log in, view requisition list, and inspect requisitions", async ({ page }) => {
    // 1. Navigate to Buyer Login
    await page.goto(`${BUYER_URL}/login`);
    await expect(page.locator("input#email")).toBeVisible();

    // 2. Perform Login
    await page.fill("input#email", "buyer@procurement.com");
    await page.fill("input#password", "Buyer123456!@#");
    await page.click('button[type="submit"]');

    // 3. Confirm redirection to Requisitions
    await page.waitForURL("**/requisitions", { timeout: 15_000 });
    await expect(page).toHaveURL(/.*\/requisitions/);

    // 4. Verify Requisitions dashboard elements
    await expect(page.locator("body")).toContainText("Requisition");

    // 5. Navigate to Purchase Orders page
    await page.goto(`${BUYER_URL}/purchase-orders`);
    await page.waitForURL("**/purchase-orders", { timeout: 15_000 });
    await expect(page).toHaveURL(/.*\/purchase-orders/);
  });
});
