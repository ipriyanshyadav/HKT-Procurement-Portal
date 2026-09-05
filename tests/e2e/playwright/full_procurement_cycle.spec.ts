import { test, expect } from "@playwright/test";

const BUYER_URL = "http://localhost:3000";
const SUPPLIER_URL = "http://localhost:3001";
const API_URL = "http://localhost:8000";

test.describe("Full Procurement Cycle (PR → PO → GRN → Invoice → Payment)", () => {
  test.setTimeout(180_000);

  test("executes complete procurement cycle end-to-end across buyer and supplier portals", async ({ browser }) => {
    // ==========================================
    // 1. BUYER LOGIN & DASHBOARD VERIFICATION
    // ==========================================
    const buyerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const buyerPage = await buyerContext.newPage();

    // Auto-accept confirmation dialogs (for approve prompts)
    buyerPage.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await buyerPage.goto(`${BUYER_URL}/login`);
    await expect(buyerPage.locator("input#email")).toBeVisible();

    await buyerPage.fill("input#email", "buyer@procurement.com");
    await buyerPage.fill("input#password", "Buyer123456!@#");
    await buyerPage.click('button[type="submit"]');

    // Wait for redirect to /requisitions
    await buyerPage.waitForURL("**/requisitions", { timeout: 15_000 });
    await expect(buyerPage).toHaveURL(/.*\/requisitions/);

    // Verify Requisitions listing renders
    await expect(buyerPage.locator("body")).toContainText("Requisition");

    // ==========================================
    // 2. SUPPLIER LOGIN & PORTAL VERIFICATION
    // ==========================================
    const supplierContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const supplierPage = await supplierContext.newPage();

    supplierPage.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await supplierPage.goto(`${SUPPLIER_URL}/login`);
    await expect(supplierPage.locator("input#email")).toBeVisible();

    await supplierPage.fill("input#email", "supplier@acme.com");
    await supplierPage.fill("input#password", "Supplier123456!@#");
    await supplierPage.click('button[type="submit"]');

    // Wait for supplier dashboard / profile redirect
    await supplierPage.waitForURL(/.*(profile|dashboard|purchase-orders)/, { timeout: 15_000 });

    // ==========================================
    // 3. API CYCLE SETUP (PR -> PO -> SEND)
    // ==========================================
    // Authenticate via backend API to perform cycle setup with valid master data
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

    const supplierLoginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portal-id": "supplier" },
      body: JSON.stringify({ email: "supplier@acme.com", password: "Supplier123456!@#" }),
    });
    const supplierAuth = await supplierLoginRes.json();
    const supplierToken = supplierAuth.data.access_token;
    const supplierHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supplierToken}`,
      "x-portal-id": "supplier",
    };

    const vendorId = "a6f83ade-0525-4536-bbe6-6b047c731d4e";
    const buId = "c7ece6ea-6786-479e-82f8-159b0b95f07d";
    const ccId = "1628e2bd-4cbe-4245-aaf4-7c8d22bfc169";
    const catId = "7e22b2c3-cb3c-4c37-b8a5-80fed72d8b85";
    const uomId = "f64caf4a-09bb-4fe1-9a7b-22d29bc1175a";

    const uniqueTag = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create PR
    const prRes = await fetch(`${API_URL}/api/v1/requisitions`, {
      method: "POST",
      headers: buyerHeaders,
      body: JSON.stringify({
        title: `Playwright Cycle PR ${uniqueTag}`,
        business_unit_id: buId,
        cost_center_id: ccId,
        category_id: catId,
        currency: "USD",
        procurement_type: "OPEX",
        lines: [
          {
            line_number: 1,
            item_description: `Enterprise Cloud Compute Node ${uniqueTag}`,
            category_id: catId,
            uom_id: uomId,
            quantity: 5.0,
            estimated_unit_price: 1000.0,
          },
        ],
      }),
    });
    expect(prRes.status).toBe(201);
    const prData = (await prRes.json()).data;
    const prId = prData.id;

    // Submit PR
    const prSubmitRes = await fetch(`${API_URL}/api/v1/requisitions/${prId}/submit`, {
      method: "POST",
      headers: buyerHeaders,
    });
    expect(prSubmitRes.status).toBe(200);

    // Create PO
    const poRes = await fetch(`${API_URL}/api/v1/purchase-orders`, {
      method: "POST",
      headers: buyerHeaders,
      body: JSON.stringify({
        title: `PO for Compute Nodes ${uniqueTag}`,
        vendor_id: vendorId,
        business_unit_id: buId,
        category_id: catId,
        currency: "USD",
        deviation_justification: "Direct PO for urgent IT infrastructure expansion",
        lines: [
          {
            item_description: `Enterprise Cloud Compute Node ${uniqueTag}`,
            uom_id: uomId,
            ordered_quantity: 5.0,
            unit_price: 1000.0,
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

    // Send PO to vendor
    const sendRes = await fetch(`${API_URL}/api/v1/purchase-orders/${poId}/send-to-vendor`, {
      method: "POST",
      headers: buyerHeaders,
    });
    expect(sendRes.status).toBe(200);

    // ==========================================
    // 4. SUPPLIER PO ACKNOWLEDGEMENT IN BROWSER
    // ==========================================
    await supplierPage.goto(`${SUPPLIER_URL}/purchase-orders/${poId}`);
    await supplierPage.waitForLoadState("networkidle");

    // Verify PO details are rendered on supplier portal
    await expect(supplierPage.locator("body")).toContainText(poNumber);
    await expect(supplierPage.locator("body")).toContainText(`Enterprise Cloud Compute Node ${uniqueTag}`);

    // Click "Acknowledge PO" button
    const ackButton = supplierPage.getByRole("button", { name: /Acknowledge PO/i });
    await expect(ackButton).toBeVisible();
    await ackButton.click();

    // Confirm PO is now acknowledged
    await expect(supplierPage.locator("body")).toContainText(/ACKNOWLEDGED/i);

    // ==========================================
    // 5. GOODS RECEIPT NOTE (GRN) CREATION & CONFIRM
    // ==========================================
    const grnRes = await fetch(`${API_URL}/api/v1/grn`, {
      method: "POST",
      headers: buyerHeaders,
      body: JSON.stringify({
        po_id: poId,
        receipt_date: new Date().toISOString().split("T")[0],
        challan_number: `CH-${uniqueTag}`,
        lines: [
          {
            po_line_id: poLineId,
            received_quantity: 5.0,
            qc_required: false,
          },
        ],
      }),
    });
    expect(grnRes.status).toBe(201);
    const grnData = (await grnRes.json()).data;
    const grnId = grnData.id;

    // Confirm GRN
    const confirmGrnRes = await fetch(`${API_URL}/api/v1/grn/${grnId}/confirm`, {
      method: "POST",
      headers: buyerHeaders,
    });
    expect(confirmGrnRes.status).toBe(200);

    // ==========================================
    // 6. SUPPLIER INVOICE SUBMISSION IN BROWSER
    // ==========================================
    await supplierPage.goto(`${SUPPLIER_URL}/invoices/new`);
    await supplierPage.waitForLoadState("networkidle");

    // Wait for PO select to be available
    const poSelect = supplierPage.locator("select#po-select, select").first();
    await expect(poSelect).toBeVisible();

    // Select the newly acknowledged and received PO
    await poSelect.selectOption(poId);

    // Fill vendor invoice number
    const invInput = supplierPage.locator('input[placeholder*="INV"], input#vendor-invoice-number, input[name="vendor_invoice_number"]').first();
    await expect(invInput).toBeVisible();
    const vendorInvNumber = `INV-${uniqueTag}`;
    await invInput.fill(vendorInvNumber);

    // Submit invoice
    const submitInvoiceBtn = supplierPage.getByRole("button", { name: /Submit.*Invoice/i });
    await expect(submitInvoiceBtn).toBeVisible();
    await submitInvoiceBtn.click();

    // Wait for redirect to invoices list
    await supplierPage.waitForURL("**/invoices", { timeout: 15_000 });
    await expect(supplierPage.locator("body")).toContainText(vendorInvNumber);

    // Fetch the created invoice ID from API to navigate directly on buyer portal
    const invListRes = await fetch(`${API_URL}/api/v1/invoices?po_id=${poId}`, {
      headers: buyerHeaders,
    });
    const invListData = await invListRes.json();
    const invoiceRecord = invListData.data.find((inv: any) => inv.po_id === poId);
    expect(invoiceRecord).toBeTruthy();
    const invoiceId = invoiceRecord.id;

    // ==========================================
    // 7. BUYER INVOICE 3-WAY MATCH & APPROVAL IN BROWSER
    // ==========================================
    await buyerPage.goto(`${BUYER_URL}/invoices/${invoiceId}`);
    await buyerPage.waitForLoadState("networkidle");

    // Verify 3-way match status on screen
    await expect(buyerPage.locator("body")).toContainText(/MATCHED/i);
    await expect(buyerPage.locator("body")).toContainText(poNumber);

    // Click "Approve Invoice"
    const approveInvoiceBtn = buyerPage.getByRole("button", { name: /Approve Invoice/i });
    await expect(approveInvoiceBtn).toBeVisible();
    await approveInvoiceBtn.click();

    // Verify status updates to APPROVED
    await expect(buyerPage.locator("body")).toContainText(/APPROVED/i);

    // ==========================================
    // 8. BUYER PAYMENT RECORD VERIFICATION
    // ==========================================
    await buyerPage.goto(`${BUYER_URL}/payments`);
    await buyerPage.waitForLoadState("networkidle");

    // Verify payment record exists for the invoice
    await expect(buyerPage.locator("body")).toContainText("Payments");
    // Verify invoice total is present (5,500.00)
    await expect(buyerPage.locator("body")).toContainText(/5,?500/);

    // Clean up browser contexts
    await buyerContext.close();
    await supplierContext.close();
  });
});
