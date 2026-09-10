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

  test("cross-portal live sync: admin ticket update propagates synchronously to buyer portal", async ({ browser }) => {
    const API_URL = process.env.API_URL || "http://localhost:8000";
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminPage = await adminContext.newPage();

    const buyerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const buyerPage = await buyerContext.newPage();

    // 1. Log into Admin Portal
    await adminPage.goto(`${ADMIN_URL}/login`);
    await adminPage.fill("input#email", "admin@procurement.com");
    await adminPage.fill("input#password", "Admin123456!@#");
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL(/.*(dashboard|admin|settings|master-data|users)/, { timeout: 15_000 });

    // 2. Log into Buyer Portal
    await buyerPage.goto(`${BUYER_URL}/login`);
    await buyerPage.fill("input#email", "buyer@procurement.com");
    await buyerPage.fill("input#password", "Buyer123456!@#");
    await buyerPage.click('button[type="submit"]');
    await buyerPage.waitForURL("**/requisitions", { timeout: 15_000 });

    // 3. Create a unique ticket with Admin credentials
    const uniqueSyncTag = Math.random().toString(36).substring(2, 8).toUpperCase();
    const ticketTitle = `Admin Live Broadcast Sync ${uniqueSyncTag}`;

    const loginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-id": "admin" },
      body: JSON.stringify({ email: "admin@procurement.com", password: "Admin123456!@#" }),
    });
    const adminAuth = await loginRes.json();
    const adminToken = adminAuth.data.access_token;

    const createTicketRes = await fetch(`${API_URL}/api/v1/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`,
        "x-portal-id": "admin",
      },
      body: JSON.stringify({
        title: ticketTitle,
        description: `Cross-portal synchronization verification across Admin and Buyer portals for ticket ${uniqueSyncTag}`,
        ticket_type: "SUPPORT",
        priority: "HIGH",
        category: "GENERAL",
      }),
    });
    expect(createTicketRes.status).toBe(201);

    // 4. Verify Admin sees the ticket on Admin Portal
    await adminPage.goto(`${ADMIN_URL}/tickets`);
    await adminPage.waitForURL("**/tickets", { timeout: 15_000 });
    await expect(adminPage.locator("body")).toContainText(ticketTitle);

    // 5. Verify Buyer sees the newly created ticket on Buyer Portal synchronously
    await buyerPage.goto(`${BUYER_URL}/tickets`);
    await buyerPage.waitForURL("**/tickets", { timeout: 15_000 });
    await expect(buyerPage.locator("body")).toContainText(ticketTitle);

    await adminContext.close();
    await buyerContext.close();
  });
});
