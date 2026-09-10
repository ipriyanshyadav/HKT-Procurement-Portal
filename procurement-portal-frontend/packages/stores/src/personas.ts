export interface EnterprisePersona {
  id: string;
  name: string;
  email: string;
  title: string;
  roles: string[];
  portalKey: "buyer" | "supplier" | "admin";
  portalName: string;
  path: string;
  icon: string;
  description: string;
  vendorId?: string | null;
}

export const SUPERADMIN_PERSONA: EnterprisePersona = {
  id: "superadmin",
  name: "Alexander Vance",
  email: "superadmin@procurement.com",
  title: "Universal Super Admin",
  roles: [
    "SUPERADMIN",
    "ORG_ADMIN",
    "PROCUREMENT_ADMIN",
    "PROCUREMENT_MANAGER",
    "PROCUREMENT_HEAD",
    "APPROVER",
    "BUYER",
    "REQUESTOR",
    "PROCUREMENT_OFFICER",
    "FINANCE_CONTROLLER",
    "CFO",
    "SOURCING_MANAGER",
    "COMPLIANCE_OFFICER",
    "VENDOR_ADMIN",
    "SUPPLIER",
    "SUPPLIER_ADMIN",
    "SUPPLIER_USER",
  ],
  portalKey: "buyer",
  portalName: "All Portals",
  path: "/requisitions",
  icon: "👑",
  description: "Universal omnipotent access across all portals, modules and enterprise settings",
};

export const ENTERPRISE_PERSONAS: EnterprisePersona[] = [
  {
    id: "david-miller",
    name: "David Miller",
    email: "admin@procurement.com",
    title: "System Admin",
    roles: ["ORG_ADMIN", "PROCUREMENT_MANAGER", "PROCUREMENT_ADMIN"],
    portalKey: "admin",
    portalName: "Admin Portal",
    path: "/users",
    icon: "⚙️",
    description: "User administration, workflows, approval rules, master data & audit trails",
  },
  {
    id: "sarah-jenkins",
    name: "Sarah Jenkins",
    email: "buyer@procurement.com",
    title: "Buyer Specialist",
    roles: ["REQUESTOR", "BUYER", "PROCUREMENT_OFFICER"],
    portalKey: "buyer",
    portalName: "Buyer Portal",
    path: "/requisitions",
    icon: "📝",
    description: "Requisitions, RFQs, bidding events, marketplace & purchase orders",
  },
  {
    id: "robert-taylor",
    name: "Robert Taylor",
    email: "approver@procurement.com",
    title: "Approver (L1 Line Manager)",
    roles: ["APPROVER", "PROCUREMENT_HEAD", "FINANCE_CONTROLLER"],
    portalKey: "buyer",
    portalName: "Buyer Portal",
    path: "/tasks",
    icon: "✅",
    description: "Managerial sign-offs, pending task queue, PR/PO approvals & delegations",
  },
  {
    id: "eleanor-vance",
    name: "Eleanor Vance",
    email: "finance@procurement.com",
    title: "Finance Manager (L2)",
    roles: ["APPROVER", "FINANCE_CONTROLLER", "CFO"],
    portalKey: "buyer",
    portalName: "Buyer Portal",
    path: "/invoices",
    icon: "📊",
    description: "Financial controls, spend budget approvals, invoice verification & CFO authority",
  },
  {
    id: "marcus-vance",
    name: "Marcus Vance",
    email: "warehouse@procurement.com",
    title: "Warehouse Manager",
    roles: ["BUYER", "PROCUREMENT_OFFICER"],
    portalKey: "buyer",
    portalName: "Buyer Portal",
    path: "/grn",
    icon: "📦",
    description: "Dock receiving, barcode intake, goods receipt notes (GRN) & quality inspection",
  },
  {
    id: "claire-redfield",
    name: "Claire Redfield",
    email: "ap@procurement.com",
    title: "Accounts Payable Lead",
    roles: ["PROCUREMENT_OFFICER", "FINANCE_CONTROLLER"],
    portalKey: "buyer",
    portalName: "Buyer Portal",
    path: "/invoices",
    icon: "💳",
    description: "2-way / 3-way match, invoice processing, tax reconciliation & payment release",
  },
  {
    id: "rajesh-kumar",
    name: "Rajesh Kumar",
    email: "supplier@acme.com",
    title: "Supplier Partner (Acme Tech)",
    roles: ["SUPPLIER", "SUPPLIER_ADMIN"],
    portalKey: "supplier",
    portalName: "Supplier Portal",
    path: "/rfqs",
    icon: "🏭",
    description: "Tender bidding, reverse auctions, PO acknowledgments & invoices for Acme Tech",
    vendorId: "cbe6bd93-31e8-4b5e-acc4-2031d535b283",
  },
  {
    id: "priya-sharma",
    name: "Priya Sharma",
    email: "supplier@globalcloud.com",
    title: "Supplier Partner (Global Cloud)",
    roles: ["SUPPLIER", "SUPPLIER_ADMIN"],
    portalKey: "supplier",
    portalName: "Supplier Portal",
    path: "/rfqs",
    icon: "🌐",
    description: "Bid submission, contracts, advance shipping & billing for Global Cloud",
    vendorId: "4d7fcf31-0a60-4780-8b4e-ce358dc75f00",
  },
];

export function getPersonaById(id: string): EnterprisePersona | undefined {
  if (id === "superadmin") return SUPERADMIN_PERSONA;
  return ENTERPRISE_PERSONAS.find((p) => p.id === id);
}

export interface RouteAccessResult {
  allowed: boolean;
  moduleName: string;
  requiredRoles: string[];
  reason?: string;
}

export function checkRouteAccess(
  pathname: string,
  portalKey: "buyer" | "supplier" | "admin",
  userRoles: string[],
): RouteAccessResult {
  const upperRoles = userRoles.map((r) => String(r).toUpperCase());

  // Omnipotent bypass for SUPERADMIN
  if (upperRoles.includes("SUPERADMIN")) {
    return {
      allowed: true,
      moduleName: "Universal Workspace",
      requiredRoles: ["SUPERADMIN"],
    };
  }

  // --- Admin Portal Policy ---
  if (portalKey === "admin") {
    const adminRoles = ["ORG_ADMIN", "PROCUREMENT_ADMIN", "PROCUREMENT_MANAGER", "SUPERADMIN"];
    const hasAdminAccess = adminRoles.some((r) => upperRoles.includes(r));
    return {
      allowed: hasAdminAccess,
      moduleName: "Administration Management",
      requiredRoles: ["ORG_ADMIN", "PROCUREMENT_ADMIN", "PROCUREMENT_MANAGER"],
      reason: hasAdminAccess
        ? undefined
        : "The Administration Portal requires system administrative authority (ORG_ADMIN or PROCUREMENT_ADMIN).",
    };
  }

  // --- Supplier Portal Policy ---
  if (portalKey === "supplier") {
    const supplierRoles = ["SUPPLIER", "SUPPLIER_ADMIN", "SUPPLIER_USER", "SUPERADMIN"];
    const hasSupplierAccess = supplierRoles.some((r) => upperRoles.includes(r));
    return {
      allowed: hasSupplierAccess,
      moduleName: "Supplier Operations",
      requiredRoles: ["SUPPLIER", "SUPPLIER_ADMIN"],
      reason: hasSupplierAccess
        ? undefined
        : "The Supplier Portal is restricted to external registered vendor partners.",
    };
  }

  // --- Buyer Portal Route Policy ---
  const path = pathname.toLowerCase();

  // 1. Invoices & 3-Way Match & Reconciliation
  if (path.startsWith("/invoices") || path.startsWith("/payments")) {
    const req = ["FINANCE_CONTROLLER", "CFO", "SUPERADMIN"];
    const allowed = req.some((r) => upperRoles.includes(r));
    return {
      allowed,
      moduleName: path.startsWith("/payments") ? "Payments & Treasury" : "Invoices & 3-Way Match",
      requiredRoles: ["FINANCE_CONTROLLER", "CFO"],
      reason: allowed
        ? undefined
        : "Access is restricted to Finance Controllers, Accounts Payable Leads, and CFOs.",
    };
  }

  // 2. Approvals & Workflow Tasks
  if (path.startsWith("/tasks") || path.startsWith("/approvals")) {
    const req = ["APPROVER", "PROCUREMENT_HEAD", "FINANCE_CONTROLLER", "CFO", "SUPERADMIN"];
    const allowed = req.some((r) => upperRoles.includes(r));
    return {
      allowed,
      moduleName: "Approvals & Workflow Tasks",
      requiredRoles: ["APPROVER", "PROCUREMENT_HEAD", "FINANCE_CONTROLLER", "CFO"],
      reason: allowed
        ? undefined
        : "Access is restricted to authorized approval authorities and department heads.",
    };
  }

  // 3. Goods Receipts (GRN) & Dock Scan
  if (path.startsWith("/grn") || path.startsWith("/goods-receipts")) {
    const req = ["BUYER", "PROCUREMENT_OFFICER", "SUPERADMIN"];
    const allowed = req.some((r) => upperRoles.includes(r));
    return {
      allowed,
      moduleName: "Goods Receipts & Warehouse Intake (GRN)",
      requiredRoles: ["BUYER", "PROCUREMENT_OFFICER"],
      reason: allowed
        ? undefined
        : "Access is restricted to Logistics, Warehouse Receiving, and Procurement Officers.",
    };
  }

  // 4. Sourcing, RFQs, Auctions, Unmapped PRs
  if (
    path.startsWith("/rfqs") ||
    path.startsWith("/auctions") ||
    path.startsWith("/unmapped-prs") ||
    path.startsWith("/sourcing")
  ) {
    const req = ["BUYER", "SOURCING_MANAGER", "PROCUREMENT_OFFICER", "PROCUREMENT_MANAGER", "SUPERADMIN"];
    const allowed = req.some((r) => upperRoles.includes(r));
    return {
      allowed,
      moduleName: "Sourcing RFQs & Bidding Events",
      requiredRoles: ["BUYER", "SOURCING_MANAGER", "PROCUREMENT_OFFICER"],
      reason: allowed
        ? undefined
        : "Access is restricted to Buyers and Sourcing Specialists.",
    };
  }

  // 5. Contracts
  if (path.startsWith("/contracts")) {
    const req = ["BUYER", "PROCUREMENT_MANAGER", "PROCUREMENT_HEAD", "FINANCE_CONTROLLER", "SUPERADMIN"];
    const allowed = req.some((r) => upperRoles.includes(r));
    return {
      allowed,
      moduleName: "Contracts & Agreements",
      requiredRoles: ["BUYER", "PROCUREMENT_HEAD", "FINANCE_CONTROLLER"],
      reason: allowed
        ? undefined
        : "Access is restricted to Contract Managers, Procurement Heads, and Buyers.",
    };
  }

  // 6. Vendor Directory & Risk
  if (path.startsWith("/vendors")) {
    const req = [
      "BUYER",
      "PROCUREMENT_OFFICER",
      "PROCUREMENT_MANAGER",
      "PROCUREMENT_HEAD",
      "VENDOR_ADMIN",
      "COMPLIANCE_OFFICER",
      "SUPERADMIN",
    ];
    const allowed = req.some((r) => upperRoles.includes(r));
    return {
      allowed,
      moduleName: "Vendor Directory & Risk Assessments",
      requiredRoles: ["BUYER", "PROCUREMENT_OFFICER", "VENDOR_ADMIN", "COMPLIANCE_OFFICER"],
      reason: allowed
        ? undefined
        : "Access is restricted to Vendor Management and Sourcing Officers.",
    };
  }

  // 7. Analytics & Compliance
  if (path.startsWith("/analytics") || path.startsWith("/compliance")) {
    const req = [
      "PROCUREMENT_HEAD",
      "PROCUREMENT_MANAGER",
      "FINANCE_CONTROLLER",
      "CFO",
      "ORG_ADMIN",
      "COMPLIANCE_OFFICER",
      "SUPERADMIN",
    ];
    const allowed = req.some((r) => upperRoles.includes(r));
    return {
      allowed,
      moduleName: "Analytics, Spend & Compliance",
      requiredRoles: ["PROCUREMENT_HEAD", "FINANCE_CONTROLLER", "CFO", "ORG_ADMIN"],
      reason: allowed
        ? undefined
        : "Access is restricted to Executive Leadership, Procurement Heads, and Finance Managers.",
    };
  }

  // 8. Requisitions & Marketplace
  if (path.startsWith("/requisitions") || path.startsWith("/marketplace")) {
    const req = [
      "REQUESTOR",
      "BUYER",
      "PROCUREMENT_OFFICER",
      "PROCUREMENT_MANAGER",
      "PROCUREMENT_HEAD",
      "SUPERADMIN",
    ];
    const allowed = req.some((r) => upperRoles.includes(r));
    return {
      allowed,
      moduleName: "Purchase Requisitions & Catalogs",
      requiredRoles: ["REQUESTOR", "BUYER", "PROCUREMENT_OFFICER"],
      reason: allowed
        ? undefined
        : "Access is restricted to Requisitioners and Procurement Staff.",
    };
  }

  // 9. Support Tickets & generic routes
  return {
    allowed: true,
    moduleName: "General Workspace",
    requiredRoles: [],
  };
}
