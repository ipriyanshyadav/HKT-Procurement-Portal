import { test, expect } from "@playwright/test";

const BUYER_URL = process.env.BUYER_URL || "http://localhost:3000";
const SUPPLIER_URL = process.env.SUPPLIER_URL || "http://localhost:3001";
const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3002";
const SCREENSHOT_DIR = "/Users/priyanshyadav/.gemini/antigravity-cli/brain/d773d61a-9f11-4f3e-83c8-abbb669d04f9/screenshots";

test.describe("Comprehensive Self-Check: Refresh Persistence & Multi-User Isolation", () => {
  test.setTimeout(120_000);

  test("Scenario 1 & 2: Buyer Multi-User Concurrent Session & Multiple Page Refreshes", async ({ browser }) => {
    const context = await browser.newContext();

    // Track console errors
    const errorsTab1: string[] = [];
    const errorsTab2: string[] = [];

    // -------------------------------------------------------------
    // TAB 1: Buyer Sarah Jenkins
    // -------------------------------------------------------------
    const tab1 = await context.newPage();
    tab1.on("pageerror", (err) => errorsTab1.push(`[Tab1 PageError] ${err.message}`));
    tab1.on("console", (msg) => {
      if (msg.type() === "error") errorsTab1.push(`[Tab1 ConsoleError] ${msg.text()}`);
    });

    await tab1.goto(`${BUYER_URL}/login`);
    await tab1.fill("input#email", "buyer@procurement.com");
    await tab1.fill("input#password", "Buyer123456!@#");
    await tab1.click('button[type="submit"]');

    await tab1.waitForURL("**/requisitions", { timeout: 20_000 });
    await expect(tab1).toHaveURL(/.*\/requisitions/);
    await expect(tab1.locator("body")).toContainText(/Sarah Jenkins|buyer@procurement.com/i);

    // Save screenshot Tab 1 before refresh
    await tab1.screenshot({ path: `${SCREENSHOT_DIR}/tab1_sarah_requisitions_before_refresh.png` });

    // REFRESH TAB 1
    await tab1.reload({ waitUntil: "domcontentloaded" });
    await tab1.waitForURL("**/requisitions", { timeout: 15_000 });
    await expect(tab1).toHaveURL(/.*\/requisitions/);
    await expect(tab1).not.toHaveURL(/.*\/login/);
    await expect(tab1.locator("body")).toContainText(/Sarah Jenkins|buyer@procurement.com/i);
    // Wait for requisitions list to finish loading
    await tab1.waitForSelector("table tbody tr, text=BU-RND-PR, text=PR-2026", { timeout: 15_000 }).catch(() => {});
    await tab1.waitForTimeout(500);

    // Save screenshot Tab 1 after refresh
    await tab1.screenshot({ path: `${SCREENSHOT_DIR}/tab1_sarah_requisitions_after_refresh.png` });

    // -------------------------------------------------------------
    // TAB 2: Approver Robert Taylor (in SAME window context)
    // -------------------------------------------------------------
    const tab2 = await context.newPage();
    tab2.on("pageerror", (err) => errorsTab2.push(`[Tab2 PageError] ${err.message}`));
    tab2.on("console", (msg) => {
      if (msg.type() === "error") errorsTab2.push(`[Tab2 ConsoleError] ${msg.text()}`);
    });

    await tab2.goto(`${BUYER_URL}/login`);
    await tab2.fill("input#email", "approver@procurement.com");
    await tab2.fill("input#password", "Approver123!@#");
    await tab2.click('button[type="submit"]');

    await tab2.waitForURL("**/requisitions", { timeout: 20_000 });
    await tab2.goto(`${BUYER_URL}/tasks`);
    await tab2.waitForURL("**/tasks", { timeout: 15_000 });
    await expect(tab2).toHaveURL(/.*\/tasks/);
    await expect(tab2.locator("body")).toContainText(/Robert Taylor|approver@procurement.com/i);

    // Save screenshot Tab 2 before refresh
    await tab2.screenshot({ path: `${SCREENSHOT_DIR}/tab2_robert_tasks_before_refresh.png` });

    // REFRESH TAB 2
    await tab2.reload({ waitUntil: "domcontentloaded" });
    await tab2.waitForURL("**/tasks", { timeout: 15_000 });
    await expect(tab2).toHaveURL(/.*\/tasks/);
    await expect(tab2).not.toHaveURL(/.*\/login/);
    await expect(tab2.locator("body")).toContainText(/Robert Taylor|approver@procurement.com/i);
    await tab2.waitForTimeout(800);

    // Save screenshot Tab 2 after refresh
    await tab2.screenshot({ path: `${SCREENSHOT_DIR}/tab2_robert_tasks_after_refresh.png` });

    // -------------------------------------------------------------
    // CROSS-VERIFY TAB 1 AFTER TAB 2 INTERACTION
    // -------------------------------------------------------------
    // Switch focus back to Tab 1
    await tab1.bringToFront();
    // Navigate Tab 1 to Purchase Orders page
    await tab1.goto(`${BUYER_URL}/purchase-orders`);
    await tab1.waitForURL("**/purchase-orders", { timeout: 15_000 });
    await expect(tab1).toHaveURL(/.*\/purchase-orders/);
    await expect(tab1.locator("body")).toContainText(/Sarah Jenkins|buyer@procurement.com/i);
    await expect(tab1.locator("body")).not.toContainText("Robert Taylor");

    // Refresh Tab 1 on /purchase-orders
    await tab1.reload({ waitUntil: "domcontentloaded" });
    await tab1.waitForURL("**/purchase-orders", { timeout: 15_000 });
    await expect(tab1).toHaveURL(/.*\/purchase-orders/);
    await expect(tab1).not.toHaveURL(/.*\/login/);
    await expect(tab1.locator("body")).toContainText(/Sarah Jenkins|buyer@procurement.com/i);
    await expect(tab1.locator("body")).not.toContainText("Robert Taylor");
    await tab1.waitForTimeout(800);

    // Save screenshot Tab 1 on purchase-orders
    await tab1.screenshot({ path: `${SCREENSHOT_DIR}/tab1_sarah_po_after_refresh.png` });

    // -------------------------------------------------------------
    // CROSS-VERIFY TAB 2 AFTER TAB 1 INTERACTION
    // -------------------------------------------------------------
    await tab2.bringToFront();
    await tab2.reload({ waitUntil: "domcontentloaded" });
    await tab2.waitForURL("**/tasks", { timeout: 15_000 });
    await expect(tab2).toHaveURL(/.*\/tasks/);
    await expect(tab2).not.toHaveURL(/.*\/login/);
    await expect(tab2.locator("body")).toContainText(/Robert Taylor|approver@procurement.com/i);
    await expect(tab2.locator("body")).not.toContainText("Sarah Jenkins");

    await tab2.screenshot({ path: `${SCREENSHOT_DIR}/tab2_robert_tasks_confirmed_isolated.png` });

    await context.close();
  });

  test("Scenario 3: Supplier Multi-Vendor Concurrent Isolation & Refresh", async ({ browser }) => {
    const context = await browser.newContext();

    // Tab 1: Acme Supplier (Rajesh Kumar)
    const acmeTab = await context.newPage();
    await acmeTab.goto(`${SUPPLIER_URL}/login`);
    await acmeTab.fill("input#email", "supplier@acme.com");
    await acmeTab.fill("input#password", "Supplier123456!@#");
    await acmeTab.click('button[type="submit"]');
    await acmeTab.waitForURL(/.*(profile|rfqs|purchase-orders)/, { timeout: 20_000 });
    await acmeTab.goto(`${SUPPLIER_URL}/purchase-orders`);
    await acmeTab.waitForURL("**/purchase-orders", { timeout: 15_000 });
    await expect(acmeTab.locator("body")).toContainText(/Rajesh Kumar|supplier@acme.com/i);

    await acmeTab.screenshot({ path: `${SCREENSHOT_DIR}/supplier_acme_po_before_refresh.png` });

    // Tab 2: GlobalCloud Supplier (Priya Sharma)
    const globalTab = await context.newPage();
    await globalTab.goto(`${SUPPLIER_URL}/login`);
    await globalTab.fill("input#email", "supplier@globalcloud.com");
    await globalTab.fill("input#password", "Supplier123456!@#");
    await globalTab.click('button[type="submit"]');
    await globalTab.waitForURL(/.*(profile|rfqs|purchase-orders)/, { timeout: 20_000 });
    await globalTab.goto(`${SUPPLIER_URL}/rfqs`);
    await globalTab.waitForURL("**/rfqs", { timeout: 15_000 });
    await expect(globalTab.locator("body")).toContainText(/Priya Sharma|supplier@globalcloud.com/i);

    await globalTab.screenshot({ path: `${SCREENSHOT_DIR}/supplier_global_rfqs_before_refresh.png` });

    // Refresh Tab 1: Acme
    await acmeTab.reload({ waitUntil: "domcontentloaded" });
    await acmeTab.waitForURL("**/purchase-orders", { timeout: 15_000 });
    await expect(acmeTab).not.toHaveURL(/.*\/login/);
    await expect(acmeTab.locator("body")).toContainText(/Rajesh Kumar|supplier@acme.com/i);
    await expect(acmeTab.locator("body")).not.toContainText("Priya Sharma");

    await acmeTab.screenshot({ path: `${SCREENSHOT_DIR}/supplier_acme_po_after_refresh.png` });

    // Refresh Tab 2: GlobalCloud
    await globalTab.reload({ waitUntil: "domcontentloaded" });
    await globalTab.waitForURL("**/rfqs", { timeout: 15_000 });
    await expect(globalTab).not.toHaveURL(/.*\/login/);
    await expect(globalTab.locator("body")).toContainText(/Priya Sharma|supplier@globalcloud.com/i);
    await expect(globalTab.locator("body")).not.toContainText("Rajesh Kumar");

    await globalTab.screenshot({ path: `${SCREENSHOT_DIR}/supplier_global_rfqs_after_refresh.png` });

    await context.close();
  });

  test("Scenario 4: Admin Portal Refresh Persistence", async ({ browser }) => {
    const context = await browser.newContext();
    const adminTab = await context.newPage();

    await adminTab.goto(`${ADMIN_URL}/login`);
    await adminTab.fill("input#email", "admin@procurement.com");
    await adminTab.fill("input#password", "Admin123456!@#");
    await adminTab.click('button[type="submit"]');

    await adminTab.waitForURL(/.*(dashboard|users|settings|organizations)/, { timeout: 20_000 });
    await adminTab.goto(`${ADMIN_URL}/users`);
    await adminTab.waitForURL("**/users", { timeout: 15_000 });
    await adminTab.waitForTimeout(800);
    await adminTab.screenshot({ path: `${SCREENSHOT_DIR}/admin_users_before_refresh.png` });

    // Refresh
    await adminTab.reload({ waitUntil: "domcontentloaded" });
    await adminTab.waitForURL("**/users", { timeout: 15_000 });
    await expect(adminTab).not.toHaveURL(/.*\/login/);
    await expect(adminTab.locator("body")).toContainText(/Admin|admin@procurement.com/i);
    await adminTab.waitForTimeout(800);

    await adminTab.screenshot({ path: `${SCREENSHOT_DIR}/admin_users_after_refresh.png` });

    await context.close();
  });

  test("Scenario 5: Unauthenticated Route Protection with Redirect Query", async ({ browser }) => {
    const context = await browser.newContext();
    const guestTab = await context.newPage();

    // Access protected page without session
    await guestTab.goto(`${BUYER_URL}/requisitions`);
    // Must redirect to /login?redirect=%2Frequisitions
    await guestTab.waitForURL(/.*\/login.*/, { timeout: 15_000 });
    expect(guestTab.url()).toContain("redirect=");

    // Log in from this protected bounce
    await guestTab.fill("input#email", "buyer@procurement.com");
    await guestTab.fill("input#password", "Buyer123456!@#");
    await guestTab.click('button[type="submit"]');

    // Should redirect directly back to /requisitions
    await guestTab.waitForURL("**/requisitions", { timeout: 20_000 });
    await expect(guestTab).toHaveURL(/.*\/requisitions/);

    await context.close();
  });
});
