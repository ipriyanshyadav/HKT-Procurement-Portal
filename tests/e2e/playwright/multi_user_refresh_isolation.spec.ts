import { test, expect } from "@playwright/test";

const BUYER_URL = process.env.BUYER_URL || "http://localhost:3000";
const SUPPLIER_URL = process.env.SUPPLIER_URL || "http://localhost:3001";
const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3002";

test.describe("Multi-User Multi-Tab Isolation & Page Refresh Persistence", () => {
  test.setTimeout(90_000);

  test("two browser tabs in the same window can log into different buyer accounts, refresh independently, and remain on their active pages", async ({
    browser,
  }) => {
    // Shared browser context (same browser window sharing cookies & localStorage)
    const context = await browser.newContext();

    // -------------------------------------------------------------
    // TAB 1: Buyer Sarah Jenkins
    // -------------------------------------------------------------
    const page1 = await context.newPage();
    await page1.goto(`${BUYER_URL}/login`);
    await expect(page1.locator("input#email")).toBeVisible({ timeout: 15_000 });

    await page1.fill("input#email", "buyer@procurement.com");
    await page1.fill("input#password", "Buyer123456!@#");
    await page1.click('button[type="submit"]');

    await page1.waitForURL("**/requisitions", { timeout: 20_000 });
    await expect(page1).toHaveURL(/.*\/requisitions/);
    await expect(page1.locator("body")).toContainText(/Sarah Jenkins|buyer@procurement.com/i);

    // -------------------------------------------------------------
    // TAB 2: Approver Robert Taylor (Same browser context, new tab)
    // -------------------------------------------------------------
    const page2 = await context.newPage();
    await page2.goto(`${BUYER_URL}/login`);
    await expect(page2.locator("input#email")).toBeVisible({ timeout: 15_000 });

    await page2.fill("input#email", "approver@procurement.com");
    await page2.fill("input#password", "Approver123!@#");
    await page2.click('button[type="submit"]');

    await page2.waitForURL("**/requisitions", { timeout: 20_000 });
    // Navigate Tab 2 to Tasks / Approvals page
    await page2.goto(`${BUYER_URL}/tasks`);
    await page2.waitForURL("**/tasks", { timeout: 15_000 });
    await expect(page2).toHaveURL(/.*\/tasks/);
    await expect(page2.locator("body")).toContainText(/Robert Taylor|approver@procurement.com/i);

    // -------------------------------------------------------------
    // TEST 1: Refresh Tab 1 (Sarah Jenkins on /requisitions)
    // -------------------------------------------------------------
    await page1.reload({ waitUntil: "domcontentloaded" });

    // Verify Tab 1 DOES NOT bounce to /login and remains on /requisitions
    await page1.waitForURL("**/requisitions", { timeout: 15_000 });
    await expect(page1).toHaveURL(/.*\/requisitions/);
    await expect(page1).not.toHaveURL(/.*\/login/);

    // Verify Tab 1 is STILL Sarah Jenkins (no session pollution from Tab 2)
    await expect(page1.locator("body")).toContainText(/Sarah Jenkins|buyer@procurement.com/i);
    await expect(page1.locator("body")).not.toContainText("Robert Taylor");

    // -------------------------------------------------------------
    // TEST 2: Refresh Tab 2 (Robert Taylor on /tasks)
    // -------------------------------------------------------------
    await page2.reload({ waitUntil: "domcontentloaded" });

    // Verify Tab 2 DOES NOT bounce to /login and remains on /tasks
    await page2.waitForURL("**/tasks", { timeout: 15_000 });
    await expect(page2).toHaveURL(/.*\/tasks/);
    await expect(page2).not.toHaveURL(/.*\/login/);

    // Verify Tab 2 is STILL Robert Taylor (no session pollution from Tab 1)
    await expect(page2.locator("body")).toContainText(/Robert Taylor|approver@procurement.com/i);
    await expect(page2.locator("body")).not.toContainText("Sarah Jenkins");

    // -------------------------------------------------------------
    // TEST 3: Navigate Tab 1 to /invoices, refresh Tab 1, check Tab 2
    // -------------------------------------------------------------
    await page1.goto(`${BUYER_URL}/invoices`);
    await page1.waitForURL("**/invoices", { timeout: 15_000 });
    await expect(page1).toHaveURL(/.*\/invoices/);

    await page1.reload({ waitUntil: "domcontentloaded" });
    await page1.waitForURL("**/invoices", { timeout: 15_000 });
    await expect(page1).toHaveURL(/.*\/invoices/);
    await expect(page1.locator("body")).toContainText(/Sarah Jenkins|buyer@procurement.com/i);

    // Verify Tab 2 remains entirely unaffected on /tasks as Robert Taylor
    await page2.reload({ waitUntil: "domcontentloaded" });
    await page2.waitForURL("**/tasks", { timeout: 15_000 });
    await expect(page2).toHaveURL(/.*\/tasks/);
    await expect(page2.locator("body")).toContainText(/Robert Taylor|approver@procurement.com/i);

    await context.close();
  });

  test("two different supplier vendor accounts can operate in separate tabs simultaneously without collision", async ({
    browser,
  }) => {
    const context = await browser.newContext();

    // Tab 1: Acme Supplier (Rajesh Kumar)
    const supp1 = await context.newPage();
    await supp1.goto(`${SUPPLIER_URL}/login`);
    await supp1.fill("input#email", "supplier@acme.com");
    await supp1.fill("input#password", "Supplier123456!@#");
    await supp1.click('button[type="submit"]');
    await supp1.waitForURL(/.*(profile|rfqs|purchase-orders)/, { timeout: 20_000 });
    await supp1.goto(`${SUPPLIER_URL}/rfqs`);
    await supp1.waitForURL("**/rfqs", { timeout: 15_000 });
    await expect(supp1.locator("body")).toContainText(/Rajesh Kumar|supplier@acme.com/i);

    // Tab 2: GlobalCloud Supplier (Priya Sharma)
    const supp2 = await context.newPage();
    await supp2.goto(`${SUPPLIER_URL}/login`);
    await supp2.fill("input#email", "supplier@globalcloud.com");
    await supp2.fill("input#password", "Supplier123456!@#");
    await supp2.click('button[type="submit"]');
    await supp2.waitForURL(/.*(profile|rfqs|purchase-orders)/, { timeout: 20_000 });
    await supp2.goto(`${SUPPLIER_URL}/purchase-orders`);
    await supp2.waitForURL("**/purchase-orders", { timeout: 15_000 });
    await expect(supp2.locator("body")).toContainText(/Priya Sharma|supplier@globalcloud.com/i);

    // Refresh Tab 1: Remains Acme Supplier on /rfqs
    await supp1.reload({ waitUntil: "domcontentloaded" });
    await supp1.waitForURL("**/rfqs", { timeout: 15_000 });
    await expect(supp1).not.toHaveURL(/.*\/login/);
    await expect(supp1.locator("body")).toContainText(/Rajesh Kumar|supplier@acme.com/i);
    await expect(supp1.locator("body")).not.toContainText("Priya Sharma");

    // Refresh Tab 2: Remains GlobalCloud Supplier on /purchase-orders
    await supp2.reload({ waitUntil: "domcontentloaded" });
    await supp2.waitForURL("**/purchase-orders", { timeout: 15_000 });
    await expect(supp2).not.toHaveURL(/.*\/login/);
    await expect(supp2.locator("body")).toContainText(/Priya Sharma|supplier@globalcloud.com/i);
    await expect(supp2.locator("body")).not.toContainText("Rajesh Kumar");

    await context.close();
  });
});
