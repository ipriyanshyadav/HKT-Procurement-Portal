import assert from 'node:assert';
import { checkRouteAccess, ENTERPRISE_PERSONAS, SUPERADMIN_PERSONA } from './personas';

// 1. SuperAdmin Universal Bypass
{
  const resultBuyer = checkRouteAccess('/invoices', 'buyer', ['SUPERADMIN']);
  assert.strictEqual(resultBuyer.allowed, true, 'SuperAdmin must have bypass access on buyer invoices');

  const resultAdmin = checkRouteAccess('/system/logs', 'admin', ['SUPERADMIN']);
  assert.strictEqual(resultAdmin.allowed, true, 'SuperAdmin must have bypass access on admin system logs');

  const resultSupplier = checkRouteAccess('/bids', 'supplier', ['SUPERADMIN']);
  assert.strictEqual(resultSupplier.allowed, true, 'SuperAdmin must have bypass access on supplier bids');
}

// 2. Requestor / Buyer (Sarah Jenkins)
{
  const sarah = ENTERPRISE_PERSONAS.find((p) => p.email === 'buyer@procurement.com');
  assert.ok(sarah, 'Sarah Jenkins persona must exist');

  // Allowed on PRs and Sourcing
  const prResult = checkRouteAccess('/requisitions', 'buyer', sarah.roles);
  assert.strictEqual(prResult.allowed, true, 'Sarah should have access to /requisitions');

  const sourcingResult = checkRouteAccess('/sourcing', 'buyer', sarah.roles);
  assert.strictEqual(sourcingResult.allowed, true, 'Sarah should have access to /sourcing');

  // Restricted on Invoices (Requires Finance / AP)
  const invoiceResult = checkRouteAccess('/invoices', 'buyer', sarah.roles);
  assert.strictEqual(invoiceResult.allowed, false, 'Sarah should NOT have access to /invoices');
  assert.ok(invoiceResult.requiredRoles.includes('FINANCE_CONTROLLER') || invoiceResult.requiredRoles.includes('ACCOUNTS_PAYABLE'));

  // Restricted on Approvals
  const approvalResult = checkRouteAccess('/approvals', 'buyer', sarah.roles);
  assert.strictEqual(approvalResult.allowed, false, 'Sarah should NOT have access to /approvals');
}

// 3. Approver (Robert Taylor)
{
  const robert = ENTERPRISE_PERSONAS.find((p) => p.email === 'approver@procurement.com');
  assert.ok(robert, 'Robert Taylor persona must exist');

  const approvalResult = checkRouteAccess('/approvals', 'buyer', robert.roles);
  assert.strictEqual(approvalResult.allowed, true, 'Robert should have access to /approvals');

  const poResult = checkRouteAccess('/purchase-orders', 'buyer', robert.roles);
  assert.strictEqual(poResult.allowed, true, 'Robert should have access to /purchase-orders as Approver/Procurement Head');
}

// 4. Warehouse Manager (Marcus Vance)
{
  const marcus = ENTERPRISE_PERSONAS.find((p) => p.email === 'warehouse@procurement.com');
  assert.ok(marcus, 'Marcus Vance persona must exist');

  const grnResult = checkRouteAccess('/goods-receipts', 'buyer', marcus.roles);
  assert.strictEqual(grnResult.allowed, true, 'Marcus should have access to /goods-receipts');

  const invoiceResult = checkRouteAccess('/invoices', 'buyer', marcus.roles);
  assert.strictEqual(invoiceResult.allowed, false, 'Marcus should NOT have access to /invoices');
}

// 5. Accounts Payable (Claire Redfield)
{
  const claire = ENTERPRISE_PERSONAS.find((p) => p.email === 'ap@procurement.com');
  assert.ok(claire, 'Claire Redfield persona must exist');

  const invoiceResult = checkRouteAccess('/invoices', 'buyer', claire.roles);
  assert.strictEqual(invoiceResult.allowed, true, 'Claire should have access to /invoices');
}

// 6. Supplier Partner (Rajesh Kumar)
{
  const rajesh = ENTERPRISE_PERSONAS.find((p) => p.email === 'supplier@acme.com');
  assert.ok(rajesh, 'Rajesh Kumar persona must exist');

  const rfqResult = checkRouteAccess('/rfqs', 'supplier', rajesh.roles);
  assert.strictEqual(rfqResult.allowed, true, 'Rajesh should have access to supplier RFQs');

  const buyerPrResult = checkRouteAccess('/requisitions', 'buyer', rajesh.roles);
  assert.strictEqual(buyerPrResult.allowed, false, 'Supplier should NOT have access to internal Buyer requisitions');
}

// 7. System Admin (David Miller)
{
  const david = ENTERPRISE_PERSONAS.find((p) => p.email === 'admin@procurement.com');
  assert.ok(david, 'David Miller persona must exist');

  const adminUsersResult = checkRouteAccess('/users', 'admin', david.roles);
  assert.strictEqual(adminUsersResult.allowed, true, 'David should have access to Admin Users');

  const workflowsResult = checkRouteAccess('/workflows', 'admin', david.roles);
  assert.strictEqual(workflowsResult.allowed, true, 'David should have access to Workflows');
}

// 8. Public / General Pages
{
  const publicDashboard = checkRouteAccess('/', 'buyer', ['REQUESTOR']);
  assert.strictEqual(publicDashboard.allowed, true, 'Root dashboard is accessible');
}
