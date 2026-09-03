"""Seed default organization, incoterms, roles, and permissions

Revision ID: 0027_data_seed
Revises: 0026_sequences
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0027_data_seed'
down_revision: Union[str, None] = '0026_sequences'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

INCOTERMS = [
    ("EXW", "Ex Works", "Seller premises"),
    ("FCA", "Free Carrier", "Named place of delivery"),
    ("CPT", "Carriage Paid To", "Named place of destination"),
    ("CIP", "Carriage and Insurance Paid To", "Named place of destination"),
    ("DAP", "Delivered at Place", "Named place of destination"),
    ("DPU", "Delivered at Place Unloaded", "Named place of destination"),
    ("DDP", "Delivered Duty Paid", "Named place of destination"),
    ("FAS", "Free Alongside Ship", "Named port of shipment"),
    ("FOB", "Free on Board", "Named port of shipment"),
    ("CFR", "Cost and Freight", "Named port of destination"),
    ("CIF", "Cost, Insurance and Freight", "Named port of destination"),
    ("DAT", "Delivered at Terminal", "Named terminal at port"),
    ("DAF", "Delivered at Frontier", "Named place at frontier"),
    ("DES", "Delivered Ex Ship", "Named port of destination"),
    ("DEQ", "Delivered Ex Quay", "Named port of destination"),
    ("DDU", "Delivered Duty Unpaid", "Named place of destination"),
    ("CIP_AIR", "Carriage and Insurance Paid (Air)", "Airport of destination"),
    ("CPT_ROAD", "Carriage Paid To (Road)", "Road terminal of destination"),
    ("FCA_RAIL", "Free Carrier (Rail)", "Rail terminal of shipment"),
    ("EXW_FACTORY", "Ex Works (Factory)", "Manufacturer factory gate"),
]

PERMISSIONS = [
    'admin.manage_roles', 'admin.manage_settings', 'admin.manage_system', 'admin.view_audit_log',
    'admin.view_health', 'admin.view_settings', 'analytics.export', 'analytics.manage_custom',
    'analytics.view_dashboard', 'analytics.view_reports', 'award.approve', 'award.recommend',
    'award.reject', 'award.split', 'bid.evaluate', 'bid.open', 'bid.revise', 'bid.submit',
    'bid.view_all', 'bid.view_own', 'bid.withdraw', 'contract.activate', 'contract.amend',
    'contract.create', 'contract.manage_milestones', 'contract.renew', 'contract.terminate',
    'contract.view_all', 'contract.view_own', 'document.delete', 'document.manage_templates',
    'document.upload', 'document.view_all', 'document.view_own', 'eval.override', 'eval.score',
    'eval.submit_recommendation', 'eval.view', 'eval.view_comparative', 'grn.approve', 'grn.create',
    'grn.reject', 'grn.view_all', 'grn.view_own', 'integration.configure', 'integration.manage_mappings',
    'integration.trigger', 'integration.view', 'integration.view_logs', 'invoice.approve',
    'invoice.match', 'invoice.reject', 'invoice.submit', 'invoice.view_all', 'invoice.view_own',
    'master.create', 'master.delete', 'master.export', 'master.import', 'master.update', 'master.view',
    'notification.manage_channels', 'notification.manage_templates', 'notification.send_manual',
    'notification.view_own', 'org.manage_license', 'org.manage_settings', 'org.manage_users',
    'org.update', 'org.view', 'org.view_audit', 'payment.approve', 'payment.initiate', 'payment.process',
    'payment.view_all', 'payment.view_own', 'po.acknowledge', 'po.amend', 'po.approve', 'po.cancel',
    'po.close', 'po.create', 'po.view_all', 'po.view_own', 'pr.approve', 'pr.cancel', 'pr.create',
    'pr.reject', 'pr.submit', 'pr.view_all', 'pr.view_bu', 'pr.view_own', 'rfq.amend', 'rfq.cancel',
    'rfq.close', 'rfq.create', 'rfq.extend', 'rfq.manage_committee', 'rfq.publish', 'rfq.view_all',
    'rfq.view_bids_before_opening', 'rfq.view_own', 'rules.create', 'rules.delete', 'rules.test',
    'rules.update', 'rules.view', 'unmapped_pr.assign', 'unmapped_pr.escalate', 'unmapped_pr.map',
    'unmapped_pr.reject', 'unmapped_pr.view', 'user.assign_role', 'user.create', 'user.deactivate',
    'user.manage_permissions', 'user.update_all', 'user.update_own', 'user.view_all', 'user.view_own',
    'vendor.activate', 'vendor.blacklist_approve', 'vendor.blacklist_initiate', 'vendor.invite',
    'vendor.manage_categories', 'vendor.qualify', 'vendor.reinstate', 'vendor.reject', 'vendor.suspend',
    'vendor.update_compliance', 'vendor.view_all', 'vendor.view_own', 'workflow.activate',
    'workflow.create', 'workflow.deactivate', 'workflow.update', 'workflow.view'
]

ROLES = [
    ("SUPERADMIN", "Super Administrator", True, False),
    ("ORG_ADMIN", "Organization Administrator", True, False),
    ("PROCUREMENT_MANAGER", "Procurement Manager", True, False),
    ("PROCUREMENT_OFFICER", "Procurement Officer", True, False),
    ("FINANCE_MANAGER", "Finance Manager", True, False),
    ("FINANCE_OFFICER", "Finance Officer", True, False),
    ("WAREHOUSE_MANAGER", "Warehouse Manager", True, False),
    ("AUDITOR", "Internal / External Auditor", True, False),
    ("VENDOR_MANAGER", "Vendor Relationship Manager", True, False),
    ("CATEGORY_MANAGER", "Category Manager", True, False),
    ("REQUESTOR", "Requisition Requestor", True, False),
    ("BUYER", "Sourcing Buyer", True, False),
    ("APPROVER", "Workflow Approver", True, False),
    ("SUPPLIER", "Supplier Portal User", False, True),
]

def upgrade() -> None:
    # 1. Insert Default Organization
    op.execute(f"""
    INSERT INTO organizations (id, name, legal_name, country_code, base_currency, cost_of_capital_rate, settings)
    VALUES ('{DEFAULT_ORG_ID}', 'Default Organization', 'Default Organization Private Limited', 'IN', 'INR', 0.1200, '{{}}')
    ON CONFLICT (id) DO NOTHING;
    """)

    # 2. Insert Incoterms
    for code, name, point in INCOTERMS:
        op.execute(f"""
        INSERT INTO incoterms (org_id, code, name, edition_year, risk_transfer_point, is_active)
        VALUES ('{DEFAULT_ORG_ID}', '{code}', '{name}', 2020, '{point}', true)
        ON CONFLICT (org_id, code) DO NOTHING;
        """)

    # 3. Insert Permissions
    for perm in PERMISSIONS:
        module = perm.split('.')[0]
        name = perm.replace('.', ' ').title()
        op.execute(f"""
        INSERT INTO permissions (code, name, module, description)
        VALUES ('{perm}', '{name}', '{module}', 'Permission to {perm}')
        ON CONFLICT (code) DO NOTHING;
        """)

    # 4. Insert Default Roles
    for code, name, is_system, is_supplier in ROLES:
        op.execute(f"""
        INSERT INTO roles (org_id, code, name, is_system_role, is_supplier_role, is_active)
        VALUES ('{DEFAULT_ORG_ID}', '{code}', '{name}', {str(is_system).lower()}, {str(is_supplier).lower()}, true)
        ON CONFLICT (org_id, code) DO NOTHING;
        """)

def downgrade() -> None:
    for code, _, _, _ in ROLES:
        op.execute(f"DELETE FROM roles WHERE org_id = '{DEFAULT_ORG_ID}' AND code = '{code}';")

    for perm in PERMISSIONS:
        op.execute(f"DELETE FROM permissions WHERE code = '{perm}';")

    for code, _, _ in INCOTERMS:
        op.execute(f"DELETE FROM incoterms WHERE org_id = '{DEFAULT_ORG_ID}' AND code = '{code}';")

    op.execute(f"DELETE FROM organizations WHERE id = '{DEFAULT_ORG_ID}';")
