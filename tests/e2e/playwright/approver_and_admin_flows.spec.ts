import { test, expect } from "@playwright/test";

const BUYER_URL = process.env.BUYER_URL || "http://localhost:3000";
const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3002";

test.describe("Approver Persona Flows", () => {
  test.setTimeout(60_000);

  test("approver can log in, view pending approval tasks, and inspect requisitions", async ({ page }) => {
    // 1. Navigate to Buyer Login as Approver
    await page.goto(`${BUYER_URL}/login`);
    await expect(page.locator("input#email")).toBeVisible();

    // 2. Perform Login
    await page.fill("input#email", "approver@procurement.com");
    await page.fill("input#password", "Approver123!@#");
    await page.click('button[type="submit"]');

    // 3. Confirm redirection
    await page.waitForURL("**/requisitions", { timeout: 15_000 });
    await expect(page).toHaveURL(/.*\/requisitions/);

    // 4. Navigate to Tasks / Approvals Queue
    await page.goto(`${BUYER_URL}/tasks`);
    await page.waitForURL("**/tasks", { timeout: 15_000 });
    await expect(page.locator("body")).toContainText(/Task|Approval|Pending/i);

    // 5. Navigate to Contracts
    await page.goto(`${BUYER_URL}/contracts`);
    await page.waitForURL("**/contracts", { timeout: 15_000 });
    await expect(page.locator("body")).toContainText(/Contract/i);
  });
});

test.describe("Admin Persona Flows", () => {
  test.setTimeout(60_000);

  test("admin can log in, inspect master data, audit logs, and settings", async ({ page }) => {
    // 1. Navigate to Admin Login
    await page.goto(`${ADMIN_URL}/login`);
    await expect(page.locator("input#email")).toBeVisible();

    // 2. Perform Login
    await page.fill("input#email", "admin@procurement.com");
    await page.fill("input#password", "Admin123456!@#");
    await page.click('button[type="submit"]');

    // 3. Confirm redirection
    await page.waitForURL(/.*(dashboard|admin|settings|master-data|users)/, { timeout: 15_000 });

    // 4. Verify Admin layout / Navigation
    await expect(page.locator("body")).toContainText(/Admin|Procurement|Master Data|Users/i);

    // 5. Navigate to Tickets / SLAs
    await page.goto(`${ADMIN_URL}/tickets`);
    await page.waitForURL("**/tickets", { timeout: 15_000 });
    await expect(page.locator("body")).toContainText(/Ticket|Issue/i);
  });
});
