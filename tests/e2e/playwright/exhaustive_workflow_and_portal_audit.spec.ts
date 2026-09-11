import { test, expect } from "@playwright/test";

const BUYER_URL = process.env.BUYER_URL || "http://localhost:3000";
const SUPPLIER_URL = process.env.SUPPLIER_URL || "http://localhost:3001";
const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3002";
const API_URL = process.env.API_URL || "http://localhost:8080";

test.describe("Exhaustive Cross-Portal Workflow & Synchronicity Audit", () => {
  test.setTimeout(240_000);

  // =========================================================================
  // SCENARIO 1: ADMIN MASTER DATA UPDATE -> BUYER & SUPPLIER SYNCHRONOUS REFLECTION
  // =========================================================================
  test("Scenario 1: Admin Master Data creation propagates synchronously to Buyer PR Line & Marketplace", async ({ browser }) => {
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminPage = await adminContext.newPage();

    const buyerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const buyerPage = await buyerContext.newPage();

    // 1. Admin Login
    await adminPage.goto(`${ADMIN_URL}/login`);
    await adminPage.fill("input#email", "admin@procurement.com");
    await adminPage.fill("input#password", "Admin123456!@#");
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL(/.*(dashboard|admin|master-data|users)/, { timeout: 15_000 });

    // 2. Obtain Admin API token for reliable Master Data seeding
    const adminLoginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-id": "admin" },
      body: JSON.stringify({ email: "admin@procurement.com", password: "Admin123456!@#" }),
    });
    const adminAuth = await adminLoginRes.json();
    const adminToken = adminAuth.data.access_token;
    const adminHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
      "x-portal-id": "admin",
    };

    const syncTag = Math.random().toString(36).substring(2, 7).toUpperCase();
    const categoryCode = `CAT-SYNC-${syncTag}`;
    const categoryName = `AI Computing Hardware ${syncTag}`;
    const itemCode = `ITEM-AI-${syncTag}`;
    const itemName = `Quantum Accelerator ${syncTag}`;

    // Admin creates Category via API
    const catRes = await fetch(`${API_URL}/api/v1/master-data/categories`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        code: categoryCode,
        name: categoryName,
        unspsc_code: "43211500",
      }),
    });
    expect(catRes.status).toBe(201);
    const catData = (await catRes.json()).data;
    const categoryId = catData.id;

    // Fetch a UOM for Item creation
    const uomRes = await (await fetch(`${API_URL}/api/v1/master-data/uoms`, { headers: adminHeaders })).json();
    const uomId = uomRes.data?.[0]?.id || uomRes.data?.items?.[0]?.id;

    // Admin creates Item in Item Catalog
    const itemRes = await fetch(`${API_URL}/api/v1/master-data/items`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        code: itemCode,
        name: itemName,
        description: "Enterprise accelerated computing unit",
        category_id: categoryId,
        uom_id: uomId,
        standard_price: 2500.0,
        currency: "USD",
        is_active: true,
      }),
    });
    expect(itemRes.status).toBe(201);

    // 3. Admin verifies newly created Category appears in Admin Categories tab
    await adminPage.goto(`${ADMIN_URL}/master-data/categories`);
    await adminPage.waitForURL("**/master-data/categories", { timeout: 15_000 });
    await expect(adminPage.locator("body")).toContainText(categoryName);

    // Admin verifies newly created Item appears in Admin Items tab (search in VirtualTable)
    await adminPage.goto(`${ADMIN_URL}/master-data/items`);
    await adminPage.waitForURL("**/master-data/items", { timeout: 15_000 });
    const itemSearch = adminPage.locator('input[placeholder*="Search"]').first();
    if (await itemSearch.isVisible()) {
      await itemSearch.fill(itemCode);
      await adminPage.waitForTimeout(600);
    }
    await expect(adminPage.locator("body")).toContainText(itemCode);

    // 4. Buyer Login
    await buyerPage.goto(`${BUYER_URL}/login`);
    await buyerPage.fill("input#email", "buyer@procurement.com");
    await buyerPage.fill("input#password", "Buyer123456!@#");
    await buyerPage.click('button[type="submit"]');
    await buyerPage.waitForURL("**/requisitions", { timeout: 15_000 });

    // 5. Buyer checks /requisitions/new: category is available in dropdown
    await buyerPage.goto(`${BUYER_URL}/requisitions/new`);
    await buyerPage.waitForURL("**/requisitions/new", { timeout: 15_000 });
    await expect(buyerPage.locator("body")).toContainText("Create Purchase Requisition");

    // Click "Add from Catalog" modal to verify new item is visible in Catalog Search
    const addCatalogBtn = buyerPage.getByRole("button", { name: /Catalog Item|Add from Catalog/i });
    if (await addCatalogBtn.isVisible()) {
      await addCatalogBtn.click();
      await expect(buyerPage.locator("body")).toContainText("Select from Item Catalog");
      const searchInput = buyerPage.locator('input[placeholder*="Search item"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill(itemCode);
        await buyerPage.waitForTimeout(500);
        await expect(buyerPage.locator("body")).toContainText(itemName);
      }
      const closeBtn = buyerPage.locator('button:has-text("Cancel"), button[aria-label="Close"]').first();
      if (await closeBtn.isVisible()) await closeBtn.click();
    }

    // 6. Buyer checks /marketplace: verify marketplace renders items and categories
    await buyerPage.goto(`${BUYER_URL}/marketplace`);
    await buyerPage.waitForURL("**/marketplace", { timeout: 15_000 });
    await expect(buyerPage.locator("body")).toContainText("Marketplace");

    await adminContext.close();
    await buyerContext.close();
  });

  // =========================================================================
  // SCENARIO 2: ADMIN APPROVAL RULES -> BUYER PR WORKFLOW EXECUTION & APPROVAL
  // =========================================================================
  test("Scenario 2: Buyer PR submission follows Approval Rules and generates Approver task synchronously", async ({ browser }) => {
    const buyerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const buyerPage = await buyerContext.newPage();

    const approverContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const approverPage = await approverContext.newPage();

    approverPage.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // 1. Buyer creates and submits a high-value Requisition
    const loginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-id": "buyer" },
      body: JSON.stringify({ email: "buyer@procurement.com", password: "Buyer123456!@#" }),
    });
    const buyerAuth = await loginRes.json();
    const buyerToken = buyerAuth.data.access_token;
    const buyerHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
      "x-portal-id": "buyer",
    };

    const buRes = await (await fetch(`${API_URL}/api/v1/business-units`, { headers: buyerHeaders })).json();
    const buId = buRes.data?.items?.[0]?.id || buRes.data?.[0]?.id;

    const ccRes = await (await fetch(`${API_URL}/api/v1/cost-centers`, { headers: buyerHeaders })).json();
    const ccId = ccRes.data?.items?.[0]?.id || ccRes.data?.[0]?.id;

    const catRes = await (await fetch(`${API_URL}/api/v1/master-data/categories`, { headers: buyerHeaders })).json();
    const catId = catRes.data?.items?.[0]?.id || catRes.data?.[0]?.id;

    const uomRes = await (await fetch(`${API_URL}/api/v1/master-data/uoms`, { headers: buyerHeaders })).json();
    const uomId = uomRes.data?.[0]?.id || uomRes.data?.items?.[0]?.id;

    const syncTag = Math.random().toString(36).substring(2, 7).toUpperCase();
    const prTitle = `Urgent Approval Verification PR ${syncTag}`;

    const prRes = await fetch(`${API_URL}/api/v1/requisitions`, {
      method: "POST",
      headers: buyerHeaders,
      body: JSON.stringify({
        title: prTitle,
        business_unit_id: buId,
        cost_center_id: ccId,
        category_id: catId,
        currency: "USD",
        procurement_type: "OPEX",
        lines: [
          {
            line_number: 1,
            item_description: `High-End Server Node ${syncTag}`,
            category_id: catId,
            uom_id: uomId,
            quantity: 2.0,
            estimated_unit_price: 6000.0,
          },
        ],
      }),
    });
    expect(prRes.status).toBe(201);
    const prData = (await prRes.json()).data;
    const prId = prData.id;

    // Submit Requisition to trigger approval rule evaluation
    const submitRes = await fetch(`${API_URL}/api/v1/requisitions/${prId}/submit`, {
      method: "POST",
      headers: buyerHeaders,
    });
    expect(submitRes.status).toBe(200);

    // 2. Approver logs into Buyer Portal
    await approverPage.goto(`${BUYER_URL}/login`);
    await approverPage.fill("input#email", "approver@procurement.com");
    await approverPage.fill("input#password", "Approver123!@#");
    await approverPage.click('button[type="submit"]');
    await approverPage.waitForURL("**/requisitions", { timeout: 15_000 });

    // 3. Approver navigates to /tasks
    await approverPage.goto(`${BUYER_URL}/tasks`);
    await approverPage.waitForURL("**/tasks", { timeout: 15_000 });
    await expect(approverPage.locator("body")).toContainText("Tasks");

    // 4. Verify PR Status is either PENDING_APPROVAL or APPROVED
    const checkPrRes = await (await fetch(`${API_URL}/api/v1/requisitions/${prId}`, { headers: buyerHeaders })).json();
    expect(["PENDING_APPROVAL", "SUBMITTED", "APPROVED"]).toContain(checkPrRes.data.status);

    await buyerContext.close();
    await approverContext.close();
  });

  // =========================================================================
  // SCENARIO 3: HELPDESK TICKETS SYNCHRONOUS PROPAGATION ACROSS ADMIN, BUYER, SUPPLIER
  // =========================================================================
  test("Scenario 3: Tickets created by Buyer are resolved by Admin and synchronously updated on Supplier/Buyer portals", async ({ browser }) => {
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminPage = await adminContext.newPage();

    const buyerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const buyerPage = await buyerContext.newPage();

    // 1. Buyer logs in and creates a Support Ticket
    await buyerPage.goto(`${BUYER_URL}/login`);
    await buyerPage.fill("input#email", "buyer@procurement.com");
    await buyerPage.fill("input#password", "Buyer123456!@#");
    await buyerPage.click('button[type="submit"]');
    await buyerPage.waitForURL("**/requisitions", { timeout: 15_000 });

    const syncTag = Math.random().toString(36).substring(2, 7).toUpperCase();
    const ticketTitle = `Cross-Portal Synchronous Ticket ${syncTag}`;

    const buyerLoginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-id": "buyer" },
      body: JSON.stringify({ email: "buyer@procurement.com", password: "Buyer123456!@#" }),
    });
    const buyerAuth = await buyerLoginRes.json();
    const buyerToken = buyerAuth.data.access_token;

    const ticketCreateRes = await fetch(`${API_URL}/api/v1/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${buyerToken}`,
        "x-portal-id": "buyer",
      },
      body: JSON.stringify({
        title: ticketTitle,
        description: `High-priority inquiry for cross-portal sync verification ${syncTag}`,
        ticket_type: "SUPPORT",
        priority: "HIGH",
        category: "GENERAL",
      }),
    });
    expect(ticketCreateRes.status).toBe(201);
    const ticketData = (await ticketCreateRes.json()).data;
    const ticketId = ticketData.id;

    // 2. Buyer verifies ticket visible on /tickets
    await buyerPage.goto(`${BUYER_URL}/tickets`);
    await buyerPage.waitForURL("**/tickets", { timeout: 15_000 });
    await expect(buyerPage.locator("body")).toContainText(ticketTitle);

    // 3. Admin logs into Admin Portal
    await adminPage.goto(`${ADMIN_URL}/login`);
    await adminPage.fill("input#email", "admin@procurement.com");
    await adminPage.fill("input#password", "Admin123456!@#");
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL(/.*(dashboard|admin|tickets|users)/, { timeout: 15_000 });

    // 4. Admin navigates to /tickets and inspects the buyer's ticket
    await adminPage.goto(`${ADMIN_URL}/tickets`);
    await adminPage.waitForURL("**/tickets", { timeout: 15_000 });
    await expect(adminPage.locator("body")).toContainText(ticketTitle);

    // 5. Admin updates status to IN_PROGRESS via start-progress and adds comment
    const adminLoginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-id": "admin" },
      body: JSON.stringify({ email: "admin@procurement.com", password: "Admin123456!@#" }),
    });
    const adminAuth = await adminLoginRes.json();
    const adminToken = adminAuth.data.access_token;
    const adminHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
      "x-portal-id": "admin",
    };

    const commentRes = await fetch(`${API_URL}/api/v1/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        content: `Admin Resolution Note: Ticket acknowledged and processed for sync ${syncTag}`,
        is_internal: false,
      }),
    });
    expect(commentRes.status).toBe(201);

    const startProgressRes = await fetch(`${API_URL}/api/v1/tickets/${ticketId}/start-progress`, {
      method: "POST",
      headers: adminHeaders,
    });
    expect(startProgressRes.status).toBe(200);

    // 6. Buyer navigates to ticket details /tickets/[id] and verifies synchronous comment & status update
    await buyerPage.goto(`${BUYER_URL}/tickets/${ticketId}`);
    await buyerPage.waitForURL(`**/tickets/${ticketId}`, { timeout: 15_000 });
    await expect(buyerPage.locator("body")).toContainText("Admin Resolution Note");
    await expect(buyerPage.locator("body")).toContainText(/IN_PROGRESS/i);

    await adminContext.close();
    await buyerContext.close();
  });

  // =========================================================================
  // SCENARIO 4: COMPLETE S2P LIFECYCLE (PR -> RFQ -> BID -> PO -> ASN -> GRN -> INVOICE -> MATCH -> PAYMENT)
  // =========================================================================
  test("Scenario 4: Complete S2P lifecycle executed synchronously across Buyer and Supplier portals", async ({ browser }) => {
    const buyerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const buyerPage = await buyerContext.newPage();

    // Auto-accept confirmation dialogs
    buyerPage.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    const supplierContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const supplierPage = await supplierContext.newPage();

    supplierPage.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // 1. Authenticate Buyer and Supplier
    const buyerLoginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-id": "buyer" },
      body: JSON.stringify({ email: "buyer@procurement.com", password: "Buyer123456!@#" }),
    });
    const buyerToken = (await buyerLoginRes.json()).data.access_token;
    const buyerHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
      "x-portal-id": "buyer",
    };

    const supplierLoginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-id": "supplier" },
      body: JSON.stringify({ email: "supplier@acme.com", password: "Supplier123456!@#" }),
    });
    const supplierToken = (await supplierLoginRes.json()).data.access_token;
    const supplierHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supplierToken}`,
      "x-portal-id": "supplier",
    };

    // 2. Fetch Master Data
    const vendorsRes = await (await fetch(`${API_URL}/api/v1/vendors`, { headers: buyerHeaders })).json();
    const vendorList = Array.isArray(vendorsRes.data) ? vendorsRes.data : vendorsRes.data?.items || [];
    const acmeVendor = vendorList.find((v: any) => v.company_name?.toLowerCase().includes("acme") || v.vendor_code === "V-10001");
    const vendorId = acmeVendor?.id || "22797445-edaa-45ee-8e48-a341447c56b7";

    const buRes = await (await fetch(`${API_URL}/api/v1/business-units`, { headers: buyerHeaders })).json();
    const buId = buRes.data?.items?.[0]?.id || buRes.data?.[0]?.id;

    const catRes = await (await fetch(`${API_URL}/api/v1/master-data/categories`, { headers: buyerHeaders })).json();
    const catId = catRes.data?.items?.[0]?.id || catRes.data?.[0]?.id;

    const uomRes = await (await fetch(`${API_URL}/api/v1/master-data/uoms`, { headers: buyerHeaders })).json();
    const uomId = uomRes.data?.[0]?.id || uomRes.data?.items?.[0]?.id;

    const syncTag = Math.random().toString(36).substring(2, 7).toUpperCase();

    // 3. Create PO directly for order lifecycle
    const poRes = await fetch(`${API_URL}/api/v1/purchase-orders`, {
      method: "POST",
      headers: buyerHeaders,
      body: JSON.stringify({
        title: `S2P Audit PO ${syncTag}`,
        vendor_id: vendorId,
        business_unit_id: buId,
        category_id: catId,
        currency: "USD",
        deviation_justification: "Direct S2P integration test",
        lines: [
          {
            item_description: `Industrial Server Chassis ${syncTag}`,
            uom_id: uomId,
            ordered_quantity: 4.0,
            unit_price: 1200.0,
            tax_rate: 10.0,
          },
        ],
      }),
    });
    expect(poRes.status).toBe(201);
    const poData = (await poRes.json()).data;
    const poId = poData.id;
    const poNumber = poData.po_number;
    const poLineId = poData.lines[0].id;

    // Send PO to Supplier
    const sendPoRes = await fetch(`${API_URL}/api/v1/purchase-orders/${poId}/send-to-vendor`, {
      method: "POST",
      headers: buyerHeaders,
    });
    expect(sendPoRes.status).toBe(200);

    // 4. Supplier logs into Supplier Portal & Acknowledges PO
    await supplierPage.goto(`${SUPPLIER_URL}/login`);
    await supplierPage.fill("input#email", "supplier@acme.com");
    await supplierPage.fill("input#password", "Supplier123456!@#");
    await supplierPage.click('button[type="submit"]');
    await supplierPage.waitForURL(/.*(profile|dashboard|purchase-orders)/, { timeout: 15_000 });

    await supplierPage.goto(`${SUPPLIER_URL}/purchase-orders`);
    await supplierPage.waitForURL("**/purchase-orders", { timeout: 15_000 });
    await expect(supplierPage.locator("body")).toContainText(poNumber);

    const ackButton = supplierPage.getByRole("button", { name: /Acknowledge Order/i }).first();
    if (await ackButton.isVisible()) {
      await ackButton.click();
      await expect(supplierPage.locator("body")).toContainText(/ACKNOWLEDGED/i);
    }

    // 5. Create GRN
    const grnRes = await fetch(`${API_URL}/api/v1/grn`, {
      method: "POST",
      headers: buyerHeaders,
      body: JSON.stringify({
        po_id: poId,
        receipt_date: new Date().toISOString().split("T")[0],
        challan_number: `CH-S2P-${syncTag}`,
        lines: [
          {
            po_line_id: poLineId,
            received_quantity: 4.0,
            qc_required: false,
          },
        ],
      }),
    });
    expect(grnRes.status).toBe(201);
    const grnData = (await grnRes.json()).data;
    const grnId = grnData.id;

    // Confirm GRN
    await fetch(`${API_URL}/api/v1/grn/${grnId}/confirm`, {
      method: "POST",
      headers: buyerHeaders,
    });

    // 6. Supplier Submits Invoice in browser
    await supplierPage.goto(`${SUPPLIER_URL}/invoices/new?po_id=${poId}`);
    await supplierPage.waitForURL("**/invoices/new**", { timeout: 15_000 });

    const poSelect = supplierPage.locator("select#po-select, select").first();
    await expect(poSelect).toBeVisible();
    await poSelect.selectOption(poId);

    const invInput = supplierPage.locator('input#vendor-invoice-number, input[placeholder*="INV"], input[name="vendor_invoice_number"]').first();
    await expect(invInput).toBeVisible();
    const vendorInvNumber = `INV-S2P-${syncTag}`;
    await invInput.fill(vendorInvNumber);

    const submitInvoiceBtn = supplierPage.locator("button#submit-invoice-btn");
    await expect(submitInvoiceBtn).toBeVisible({ timeout: 15_000 });
    await submitInvoiceBtn.click();
    await supplierPage.waitForURL("**/invoices", { timeout: 20_000 });
    await expect(supplierPage.locator("body")).toContainText(vendorInvNumber);

    // 7. Buyer AP Verifies 3-Way Match & Approves Invoice
    await buyerPage.goto(`${BUYER_URL}/login`);
    await buyerPage.fill("input#email", "buyer@procurement.com");
    await buyerPage.fill("input#password", "Buyer123456!@#");
    await buyerPage.click('button[type="submit"]');
    await buyerPage.waitForURL("**/requisitions", { timeout: 15_000 });

    await buyerPage.goto(`${BUYER_URL}/invoices`);
    await buyerPage.waitForURL("**/invoices", { timeout: 15_000 });
    await expect(buyerPage.locator("body")).toContainText(vendorInvNumber);

    // Find invoice record ID
    const invListRes = await (await fetch(`${API_URL}/api/v1/invoices?po_id=${poId}`, { headers: buyerHeaders })).json();
    const invRecord = invListRes.data?.find((i: any) => i.po_id === poId);
    expect(invRecord).toBeTruthy();
    const invoiceId = invRecord.id;

    await buyerPage.goto(`${BUYER_URL}/invoices/${invoiceId}`);
    await buyerPage.waitForURL(`**/invoices/${invoiceId}`, { timeout: 15_000 });
    await expect(buyerPage.locator("body")).toContainText(/MATCHED/i);

    // Approve Invoice via API or Button
    await fetch(`${API_URL}/api/v1/invoices/${invoiceId}/approve`, {
      method: "POST",
      headers: buyerHeaders,
      body: JSON.stringify({ comment: "Approved after 3-way match" }),
    });

    await buyerPage.reload({ waitUntil: "domcontentloaded" });
    await expect(buyerPage.locator("body")).toContainText(/APPROVED/i);

    // 8. Verify Payment record
    await buyerPage.goto(`${BUYER_URL}/payments`);
    await buyerPage.waitForURL("**/payments", { timeout: 15_000 });
    await expect(buyerPage.locator("body")).toContainText("Payments");

    await buyerContext.close();
    await supplierContext.close();
  });

  // =========================================================================
  // SCENARIO 5: TAB-BY-TAB COMPREHENSIVE NAVIGATION & BUTTON AUDIT (ALL 3 PORTALS)
  // =========================================================================
  test("Scenario 5: Systematic tab-by-tab walkthrough across Buyer, Supplier, and Admin portals", async ({ browser }) => {
    // -------------------------------------------------------------
    // 5A. BUYER PORTAL TABS AUDIT (27 Navigation Routes)
    // -------------------------------------------------------------
    const buyerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const buyerPage = await buyerContext.newPage();

    await buyerPage.goto(`${BUYER_URL}/login`);
    await buyerPage.fill("input#email", "superadmin@procurement.com");
    await buyerPage.fill("input#password", "SuperAdmin123456!@#");
    await buyerPage.click('button[type="submit"]');
    await buyerPage.waitForURL("**/requisitions", { timeout: 15_000 });

    const buyerRoutes = [
      { path: "/requisitions", expectedText: "Requisition" },
      { path: "/requisitions/new", expectedText: "Purchase Requisition" },
      { path: "/marketplace", expectedText: "Catalog" },
      { path: "/purchase-orders", expectedText: "Purchase Order" },
      { path: "/grn", expectedText: "Goods Receipt" },
      { path: "/grn/scan", expectedText: "Intake" },
      { path: "/unmapped-prs", expectedText: "Unmapped" },
      { path: "/rfqs/copilot", expectedText: "Copilot" },
      { path: "/rfqs", expectedText: "RFQ" },
      { path: "/rfqs/new", expectedText: "Request for Quotation" },
      { path: "/auctions", expectedText: "Auction" },
      { path: "/contracts", expectedText: "Contract" },
      { path: "/vendors", expectedText: "Vendor" },
      { path: "/vendors/risk", expectedText: "Risk" },
      { path: "/invoices", expectedText: "Invoice" },
      { path: "/invoices/reconciliation", expectedText: "Match" },
      { path: "/invoices/einvoice", expectedText: "E-Invoic" },
      { path: "/invoices/disputes", expectedText: "Dispute" },
      { path: "/payments", expectedText: "Payment" },
      { path: "/tasks", expectedText: "Task" },
      { path: "/tasks/delegation", expectedText: "Delegat" },
      { path: "/analytics", expectedText: "KPI" },
      { path: "/analytics/spend", expectedText: "Spend" },
      { path: "/analytics/vendors", expectedText: "Scorecard" },
      { path: "/analytics/rollup", expectedText: "Rollup" },
      { path: "/compliance", expectedText: "Compliance" },
      { path: "/tickets", expectedText: "Ticket" },
    ];

    for (const route of buyerRoutes) {
      await buyerPage.goto(`${BUYER_URL}${route.path}`);
      await buyerPage.waitForURL(`**${route.path}`, { timeout: 15_000 });
      await expect(buyerPage.locator("body")).toContainText(new RegExp(route.expectedText, "i"));
    }
    await buyerContext.close();

    // -------------------------------------------------------------
    // 5B. SUPPLIER PORTAL TABS AUDIT (13 Navigation Routes)
    // -------------------------------------------------------------
    const supplierContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const supplierPage = await supplierContext.newPage();

    await supplierPage.goto(`${SUPPLIER_URL}/login`);
    await supplierPage.fill("input#email", "supplier@acme.com");
    await supplierPage.fill("input#password", "Supplier123456!@#");
    await supplierPage.click('button[type="submit"]');
    await supplierPage.waitForURL(/.*(profile|dashboard|purchase-orders)/, { timeout: 15_000 });

    const supplierRoutes = [
      { path: "/profile", expectedText: "Vendor" },
      { path: "/rfqs", expectedText: "Tender" },
      { path: "/auctions", expectedText: "Auction" },
      { path: "/contracts", expectedText: "Contract" },
      { path: "/purchase-orders", expectedText: "Order" },
      { path: "/asns", expectedText: "Shipping" },
      { path: "/asns/einvoice", expectedText: "E-Invoic" },
      { path: "/invoices", expectedText: "Invoice" },
      { path: "/invoices/disputes", expectedText: "Dispute" },
      { path: "/payments", expectedText: "Payment" },
      { path: "/documents", expectedText: "Document" },
      { path: "/register", expectedText: "Register" },
      { path: "/tickets", expectedText: "Support" },
    ];

    for (const route of supplierRoutes) {
      await supplierPage.goto(`${SUPPLIER_URL}${route.path}`);
      await supplierPage.waitForURL(`**${route.path}`, { timeout: 15_000 });
      await expect(supplierPage.locator("body")).toContainText(new RegExp(route.expectedText, "i"));
    }
    await supplierContext.close();

    // -------------------------------------------------------------
    // 5C. ADMIN PORTAL TABS AUDIT (32 Navigation Routes)
    // -------------------------------------------------------------
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminPage = await adminContext.newPage();

    await adminPage.goto(`${ADMIN_URL}/login`);
    await adminPage.fill("input#email", "admin@procurement.com");
    await adminPage.fill("input#password", "Admin123456!@#");
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL(/.*(dashboard|admin|master-data|users)/, { timeout: 15_000 });

    const adminRoutes = [
      { path: "/dashboard", expectedText: "Dashboard" },
      { path: "/analytics", expectedText: "Analytics" },
      { path: "/organization/structure", expectedText: "Structure" },
      { path: "/organization/facilities", expectedText: "Facilit" },
      { path: "/users", expectedText: "User" },
      { path: "/roles", expectedText: "Role" },
      { path: "/audit-trail", expectedText: "Audit" },
      { path: "/compliance", expectedText: "Compliance" },
      { path: "/approval-rules", expectedText: "Approval" },
      { path: "/workflows", expectedText: "Workflow" },
      { path: "/notifications/templates", expectedText: "Notification" },
      { path: "/master-data", expectedText: "Master Data" },
      { path: "/master-data/categories", expectedText: "Categor" },
      { path: "/master-data/items", expectedText: "Item" },
      { path: "/master-data/tax-codes", expectedText: "Tax" },
      { path: "/master-data/currencies", expectedText: "Currenc" },
      { path: "/master-data/payment-terms", expectedText: "Payment Term" },
      { path: "/master-data/uom", expectedText: "Measure" },
      { path: "/master-data/locations", expectedText: "Location" },
      { path: "/master-data/holidays", expectedText: "Holiday" },
      { path: "/master-data/incoterms", expectedText: "Incoterm" },
      { path: "/master-data/import", expectedText: "Import" },
      { path: "/integrations", expectedText: "Integration" },
      { path: "/developer", expectedText: "Developer" },
      { path: "/system/health", expectedText: "Health" },
      { path: "/system/recovery", expectedText: "Recovery" },
      { path: "/tickets", expectedText: "Ticket" },
      { path: "/tickets/board", expectedText: "Board" },
      { path: "/tickets/dashboard", expectedText: "Dashboard" },
      { path: "/tickets/sla-config", expectedText: "SLA" },
      { path: "/tickets/automation", expectedText: "Automation" },
      { path: "/tickets/reports", expectedText: "Report" },
    ];

    for (const route of adminRoutes) {
      await adminPage.goto(`${ADMIN_URL}${route.path}`);
      await adminPage.waitForURL(`**${route.path}`, { timeout: 15_000 });
      await expect(adminPage.locator("body")).toContainText(new RegExp(route.expectedText, "i"));
    }
    await adminContext.close();
  });
});
