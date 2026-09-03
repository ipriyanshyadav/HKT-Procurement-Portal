# SPEC_03_DATABASE.md

## Title
Enterprise S2P Procurement Portal — Complete Database Specification

## Purpose
Define the complete PostgreSQL 16 data model including all ENUM types, full DDL for all 70+ tables, indexes, constraints, triggers, partition strategy, RLS policies, SQLAlchemy 2.0 async model definitions, and Alembic migration strategy.

## Scope
Covers every table in the system, their relationships, all indexes (composite, GIN, partial), immutable audit trigger, row-level security, soft delete pattern, partitioning, PgBouncer configuration, and ORM mapping.

## Dependencies
- SPEC_01_PROJECT_OVERVIEW.md (module inventory)
- SPEC_02_ARCHITECTURE.md (service module registry, directory structure)

## Version
1.0

## Last Updated
2026-06-27

---

## 1. PostgreSQL 16 Features Used

| Feature | Usage |
|---|---|
| `UUID` with `gen_random_uuid()` | Primary key default for all tables |
| `JSONB` | Approval rule conditions, workflow template steps, field changes in audit, OCR extracted data, event payloads |
| Custom `ENUM` types | All status fields, category classifications |
| Partial indexes | Filtered indexes on active records, pending status queries |
| Composite indexes | `(org_id, status)`, `(org_id, created_at)` on all entity tables |
| GIN indexes | JSONB columns (conditions, approval_steps, field_changes) |
| Range partitioning | `audit_logs` partitioned by month on `created_at` |
| Row-Level Security (RLS) | `org_id` enforcement on all tables via RLS policies |
| `FOR UPDATE SKIP LOCKED` | Outbox worker message claiming, budget lock |

---

## 2. ENUM Type Definitions

```sql
-- User and Auth
CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED', 'TERMINATED', 'PENDING_ACTIVATION');

-- Vendor
CREATE TYPE vendor_status AS ENUM (
    'INVITED', 'REGISTRATION_IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW',
    'RESUBMISSION_REQUESTED', 'QUALIFIED', 'ACTIVE', 'SUSPENDED',
    'COMPLIANCE_HOLD', 'BLACKLISTED', 'DEACTIVATED'
);

-- Purchase Requisition
CREATE TYPE pr_status AS ENUM (
    'DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
    'WITHDRAWN', 'IN_SOURCING', 'CONVERTED', 'CANCELLED', 'UNMAPPED',
    'AMENDMENT_PENDING', 'SPLIT'
);
CREATE TYPE pr_source AS ENUM ('MANUAL', 'ERP_API', 'ERP_BATCH', 'MOBILE', 'CATALOG', 'EMAIL');

-- RFQ
CREATE TYPE rfq_status AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'BID_OPEN',
    'BID_CLOSED', 'BIDS_OPENED', 'UNDER_EVALUATION', 'CS_GENERATED',
    'CS_APPROVED', 'AWARDED', 'CANCELLED', 'NO_BIDS', 'COMPLIANCE_HOLD',
    'AMENDMENT_PENDING'
);
CREATE TYPE rfq_type AS ENUM (
    'OPEN_TENDER', 'LIMITED_TENDER', 'SINGLE_VENDOR', 'RATE_CONTRACT',
    'FRAMEWORK_AGREEMENT', 'EMERGENCY'
);
CREATE TYPE sourcing_type AS ENUM (
    'GOODS', 'SERVICES', 'WORKS', 'GOODS_AND_SERVICES', 'TURNKEY', 'AMC'
);
CREATE TYPE evaluation_type AS ENUM (
    'L1_PRICE_ONLY', 'QCBS_QUALITY_COST', 'TECHNICAL_MERIT', 'REVERSE_AUCTION'
);

-- Bid
CREATE TYPE bid_status AS ENUM (
    'INVITED', 'ACCEPTED', 'REGRETTED', 'DRAFT', 'SUBMITTED', 'REOPENED',
    'OPENED', 'TECHNICALLY_QUALIFIED', 'TECHNICALLY_DISQUALIFIED',
    'EVALUATED', 'AWARDED', 'NOT_AWARDED', 'WITHDRAWN', 'INTEGRITY_FAIL'
);

-- Approval
CREATE TYPE approval_task_status AS ENUM (
    'PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'DELEGATED',
    'FORCE_APPROVED', 'CANCELLED', 'TIMED_OUT'
);

-- Contract
CREATE TYPE contract_status AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PENDING_SIGNATURE',
    'PARTIALLY_SIGNED', 'EXECUTED', 'ACTIVE', 'AMENDMENT_PENDING',
    'SUSPENDED', 'EXPIRED', 'TERMINATED', 'RENEWED'
);

-- Purchase Order
CREATE TYPE po_status AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RELEASED', 'SYNC_PENDING',
    'ACKNOWLEDGED', 'REJECTED_BY_SUPPLIER', 'PARTIALLY_RECEIVED',
    'FULLY_RECEIVED', 'AMENDMENT_PENDING', 'CANCELLED', 'CLOSED'
);

-- Invoice
CREATE TYPE invoice_status AS ENUM (
    'DRAFT', 'SUBMITTED', 'MATCHING', 'MATCHED', 'PARTIALLY_MATCHED',
    'DISPUTED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'PAID',
    'PARTIALLY_PAID', 'CANCELLED', 'CREDIT_NOTE_ISSUED'
);

-- Payment
CREATE TYPE payment_status AS ENUM (
    'PENDING', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED',
    'REVERSED', 'DISPUTED'
);

-- Notification
CREATE TYPE notification_channel AS ENUM ('EMAIL', 'SMS', 'IN_APP', 'WHATSAPP', 'DIGEST');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

-- Integration
CREATE TYPE integration_job_status AS ENUM (
    'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED',
    'RETRY_SCHEDULED', 'MAX_RETRIES_EXCEEDED', 'MANUALLY_RESOLVED'
);

-- Document
CREATE TYPE document_category AS ENUM (
    'TENDER', 'BID', 'COMPLIANCE', 'CONTRACT', 'PURCHASE_ORDER',
    'GRN_SES', 'INVOICE', 'AUDIT'
);

-- Procurement
CREATE TYPE procurement_type AS ENUM ('CAPEX', 'OPEX', 'PROJECT', 'MRO', 'SERVICES');
CREATE TYPE tax_type AS ENUM ('CGST', 'SGST', 'IGST', 'UTGST', 'CESS', 'VAT', 'CUSTOMS_DUTY', 'EXEMPT');

-- Unmapped PR
CREATE TYPE unmapped_pr_status AS ENUM (
    'PENDING', 'ASSIGNED', 'MAPPED', 'CHECKER_PENDING', 'APPROVED',
    'REPROCESSING', 'REPROCESSING_FAILED', 'RESOLVED', 'MANUAL_INTERVENTION_REQUIRED'
);

-- Workflow
CREATE TYPE workflow_instance_status AS ENUM (
    'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED', 'PENDING_RULE_RESOLUTION'
);
CREATE TYPE task_action AS ENUM (
    'APPROVE', 'REJECT', 'RETURN', 'ESCALATE', 'DELEGATE',
    'FORCE_APPROVE', 'CANCEL', 'REASSIGN'
);

-- Audit
CREATE TYPE audit_entity_type AS ENUM (
    'ORGANIZATION', 'USER', 'ROLE', 'VENDOR', 'REQUISITION', 'RFQ',
    'BID', 'EVALUATION', 'COMPARATIVE_STATEMENT', 'AWARD', 'CONTRACT',
    'PURCHASE_ORDER', 'GRN', 'SES', 'INVOICE', 'PAYMENT', 'DOCUMENT',
    'WORKFLOW', 'APPROVAL_RULE', 'MASTER_DATA', 'NOTIFICATION',
    'INTEGRATION', 'FEATURE_FLAG', 'TENANT_SETTING', 'SESSION'
);
```

---

## 3. Full DDL — All Tables

### 3.1 Base Column Convention

Every table includes the following columns unless explicitly noted:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
org_id UUID NOT NULL REFERENCES organizations(id),
version INTEGER NOT NULL DEFAULT 1,
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
created_by UUID REFERENCES users(id),
updated_by UUID REFERENCES users(id),
deleted_at TIMESTAMP WITH TIME ZONE
```

### 3.2 Organization & Structure Tables

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    legal_name VARCHAR(300) NOT NULL,
    registration_number VARCHAR(50),
    tax_id VARCHAR(50),
    country_code CHAR(2) NOT NULL DEFAULT 'IN',
    base_currency CHAR(3) NOT NULL DEFAULT 'INR',
    cost_of_capital_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1200,
    logo_url TEXT,
    settings JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE legal_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(200) NOT NULL,
    registration_number VARCHAR(50) NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    cin VARCHAR(21),
    address_line1 VARCHAR(300),
    address_line2 VARCHAR(300),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(10),
    country_code CHAR(2) NOT NULL DEFAULT 'IN',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, registration_number)
);

CREATE TABLE business_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    erp_company_code VARCHAR(20),
    default_currency CHAR(3) NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    business_unit_id UUID NOT NULL REFERENCES business_units(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    plant_type VARCHAR(50) NOT NULL DEFAULT 'MANUFACTURING',
    erp_plant_code VARCHAR(20),
    address_line1 VARCHAR(300),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(10),
    country_code CHAR(2) NOT NULL DEFAULT 'IN',
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    default_delivery_location_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    business_unit_id UUID NOT NULL REFERENCES business_units(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    gl_account VARCHAR(20),
    erp_cost_center_code VARCHAR(20),
    annual_budget NUMERIC(18,2) NOT NULL DEFAULT 0,
    available_budget NUMERIC(18,2) NOT NULL DEFAULT 0,
    budget_period_start DATE,
    budget_period_end DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    business_unit_id UUID NOT NULL REFERENCES business_units(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    head_user_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);
```

### 3.3 Master Data Tables

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    parent_id UUID REFERENCES categories(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
    erp_material_group VARCHAR(50),
    gl_account_mapping VARCHAR(20),
    synonyms TEXT[] DEFAULT '{}',
    requires_quality_inspection BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code),
    CONSTRAINT chk_no_circular_ref CHECK (id != parent_id)
);

CREATE TABLE uom_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(10) NOT NULL,
    name VARCHAR(50) NOT NULL,
    erp_uom_code VARCHAR(10),
    base_uom_id UUID REFERENCES uom_master(id),
    conversion_factor NUMERIC(18,8) DEFAULT 1.0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE currency_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code CHAR(3) NOT NULL,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(5),
    decimal_places INTEGER NOT NULL DEFAULT 2,
    exchange_rate_to_base NUMERIC(18,8) NOT NULL DEFAULT 1.0,
    rate_last_updated TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE payment_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    payment_days INTEGER NOT NULL,
    advance_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    retention_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    discount_days INTEGER DEFAULT 0,
    npv_factor NUMERIC(10,8),
    erp_payment_term_code VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE incoterms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(5) NOT NULL,
    name VARCHAR(100) NOT NULL,
    edition_year INTEGER NOT NULL DEFAULT 2020,
    risk_transfer_point TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE tax_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    tax_type tax_type NOT NULL,
    rate NUMERIC(5,2) NOT NULL,
    hsn_code_range_start VARCHAR(10),
    hsn_code_range_end VARCHAR(10),
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code, effective_from)
);

CREATE TABLE delivery_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    plant_id UUID REFERENCES plants(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    address_line1 VARCHAR(300),
    address_line2 VARCHAR(300),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(10),
    country_code CHAR(2) NOT NULL DEFAULT 'IN',
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE document_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(30) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category document_category NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    validity_period_days INTEGER,
    allowed_extensions TEXT[] NOT NULL DEFAULT '{pdf,jpg,jpeg,png,doc,docx,xls,xlsx}',
    max_file_size_mb INTEGER NOT NULL DEFAULT 10,
    ocr_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE supplier_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    qualification_checklist JSONB NOT NULL DEFAULT '[]',
    evaluation_frequency_months INTEGER NOT NULL DEFAULT 12,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE holiday_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    holiday_date DATE NOT NULL,
    name VARCHAR(200) NOT NULL,
    applies_to_bu UUID REFERENCES business_units(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX idx_holiday_master_unique ON holiday_master (org_id, holiday_date, COALESCE(applies_to_bu, '00000000-0000-0000-0000-000000000000'));

CREATE TABLE erp_material_group_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    erp_material_group VARCHAR(50) NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id),
    confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, erp_material_group)
);
```

### 3.4 User & Auth Tables

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50),
    department_id UUID REFERENCES departments(id),
    business_unit_id UUID REFERENCES business_units(id),
    plant_id UUID REFERENCES plants(id),
    phone VARCHAR(20),
    language VARCHAR(5) NOT NULL DEFAULT 'en',
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    status user_status NOT NULL DEFAULT 'PENDING_ACTIVATION',
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    sso_provider VARCHAR(50),
    sso_subject_id VARCHAR(255),
    is_supplier_user BOOLEAN NOT NULL DEFAULT FALSE,
    vendor_id UUID REFERENCES vendors(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, email)
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    token_jti VARCHAR(100) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_reason VARCHAR(100)
);

CREATE TABLE user_mfa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    totp_secret_encrypted VARCHAR(500) NOT NULL,
    backup_codes_hashed TEXT[] NOT NULL DEFAULT '{}',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    enabled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, user_id)
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    is_supplier_role BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    permission_id UUID NOT NULL REFERENCES permissions(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    UNIQUE (org_id, role_id, permission_id)
);

CREATE TABLE user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, user_id, role_id)
);

CREATE TABLE user_category_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    UNIQUE (org_id, user_id, category_id)
);

CREATE TABLE user_bu_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    business_unit_id UUID NOT NULL REFERENCES business_units(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    UNIQUE (org_id, user_id, business_unit_id)
);

CREATE TABLE user_coi_declarations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    relationship_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    declared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE delegation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    delegator_id UUID NOT NULL REFERENCES users(id),
    delegate_id UUID NOT NULL REFERENCES users(id),
    reason VARCHAR(200) NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    entity_types TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT chk_delegation_dates CHECK (valid_until > valid_from),
    CONSTRAINT chk_no_self_delegation CHECK (delegator_id != delegate_id)
);

CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_password_history_user ON password_history (org_id, user_id, created_at DESC);
```

### 3.5 Vendor Tables

```sql
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    vendor_code VARCHAR(20),
    company_name VARCHAR(300) NOT NULL,
    legal_name VARCHAR(300),
    registration_type VARCHAR(50) NOT NULL DEFAULT 'DOMESTIC',
    pan VARCHAR(10),
    pan_encrypted VARCHAR(500),
    gstin VARCHAR(15),
    gstin_encrypted VARCHAR(500),
    cin VARCHAR(21),
    duns_number VARCHAR(13),
    website VARCHAR(500),
    primary_email VARCHAR(255) NOT NULL,
    primary_phone VARCHAR(20),
    address_line1 VARCHAR(300),
    address_line2 VARCHAR(300),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(10),
    country_code CHAR(2) NOT NULL DEFAULT 'IN',
    status vendor_status NOT NULL DEFAULT 'INVITED',
    erp_vendor_code VARCHAR(20),
    erp_sync_status VARCHAR(20) DEFAULT 'NOT_SYNCED',
    erp_last_synced_at TIMESTAMP WITH TIME ZONE,
    onboarding_step INTEGER NOT NULL DEFAULT 0,
    invited_by UUID REFERENCES users(id),
    invitation_token VARCHAR(200),
    invitation_expires_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    qualified_at TIMESTAMP WITH TIME ZONE,
    activated_at TIMESTAMP WITH TIME ZONE,
    blacklisted_at TIMESTAMP WITH TIME ZONE,
    blacklist_reason TEXT,
    blacklist_initiated_by UUID REFERENCES users(id),
    blacklist_confirmed_by UUID REFERENCES users(id),
    suspension_reason TEXT,
    compliance_score NUMERIC(5,2),
    performance_score NUMERIC(5,2),
    last_scorecard_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, vendor_code),
    UNIQUE (org_id, primary_email)
);

CREATE TABLE vendor_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    name VARCHAR(200) NOT NULL,
    designation VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE vendor_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    document_type_id UUID NOT NULL REFERENCES document_types(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    expiry_date DATE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    verification_notes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE vendor_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    account_holder_name VARCHAR(200) NOT NULL,
    bank_name VARCHAR(200) NOT NULL,
    branch_name VARCHAR(200),
    account_number_encrypted VARCHAR(500) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    swift_code VARCHAR(11),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    penny_test_status VARCHAR(20) NOT NULL DEFAULT 'NOT_INITIATED',
    penny_test_reference VARCHAR(100),
    penny_test_initiated_at TIMESTAMP WITH TIME ZONE,
    penny_test_validated_at TIMESTAMP WITH TIME ZONE,
    validated_by UUID REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE vendor_category_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    is_qualified BOOLEAN NOT NULL DEFAULT FALSE,
    qualified_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, vendor_id, category_id)
);

CREATE TABLE vendor_scorecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    on_time_delivery_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    quality_acceptance_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    commercial_compliance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    responsiveness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE vendor_erp_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    sync_direction VARCHAR(20) NOT NULL,
    sync_status VARCHAR(20) NOT NULL,
    erp_vendor_code VARCHAR(20),
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.6 Approval & Workflow Tables

```sql
CREATE TABLE approval_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(200) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    priority INTEGER NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]',
    approval_steps JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    current_version_id UUID,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE approval_rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    approval_rule_id UUID NOT NULL REFERENCES approval_rules(id),
    version_number INTEGER NOT NULL,
    conditions JSONB NOT NULL,
    approval_steps JSONB NOT NULL,
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
    effective_to TIMESTAMP WITH TIME ZONE,
    change_reason TEXT,
    impact_assessment JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    UNIQUE (org_id, approval_rule_id, version_number)
);

CREATE TABLE approval_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE approval_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    approval_group_id UUID NOT NULL REFERENCES approval_groups(id),
    user_id UUID NOT NULL REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    UNIQUE (org_id, approval_group_id, user_id)
);

CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    steps JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, code)
);

CREATE TABLE workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    template_id UUID NOT NULL REFERENCES workflow_templates(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    status workflow_instance_status NOT NULL DEFAULT 'ACTIVE',
    current_step_number INTEGER NOT NULL DEFAULT 1,
    entity_context JSONB NOT NULL DEFAULT '{}',
    rule_version_id UUID REFERENCES approval_rule_versions(id),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    cancelled_by UUID REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
    step_number INTEGER NOT NULL,
    assigned_to UUID NOT NULL REFERENCES users(id),
    assigned_role VARCHAR(50),
    status approval_task_status NOT NULL DEFAULT 'PENDING',
    action task_action,
    comment TEXT,
    acted_at TIMESTAMP WITH TIME ZONE,
    sla_deadline TIMESTAMP WITH TIME ZONE,
    sla_status VARCHAR(20) DEFAULT 'WITHIN_SLA',
    parallel_task_group_id UUID,
    delegated_from UUID REFERENCES users(id),
    is_maker_checker_enforced BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
    workflow_task_id UUID REFERENCES workflow_tasks(id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    actor_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.7 Requisition Tables

```sql
CREATE TABLE requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    pr_number VARCHAR(30) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    source pr_source NOT NULL DEFAULT 'MANUAL',
    status pr_status NOT NULL DEFAULT 'DRAFT',
    procurement_type procurement_type NOT NULL DEFAULT 'OPEX',
    requestor_id UUID NOT NULL REFERENCES users(id),
    business_unit_id UUID NOT NULL REFERENCES business_units(id),
    plant_id UUID REFERENCES plants(id),
    department_id UUID REFERENCES departments(id),
    cost_center_id UUID NOT NULL REFERENCES cost_centers(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    estimated_value NUMERIC(18,2) NOT NULL DEFAULT 0,
    budget_check_status VARCHAR(20) DEFAULT 'NOT_CHECKED',
    budget_reserved_amount NUMERIC(18,2) DEFAULT 0,
    is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
    is_capex BOOLEAN NOT NULL DEFAULT FALSE,
    required_by_date DATE,
    delivery_location_id UUID REFERENCES delivery_locations(id),
    erp_pr_number VARCHAR(30),
    erp_sync_status VARCHAR(20) DEFAULT 'NOT_SYNCED',
    merged_from UUID[],
    split_into UUID[],
    split_from UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    aging_alert_level INTEGER DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, pr_number)
);

CREATE TABLE requisition_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    requisition_id UUID NOT NULL REFERENCES requisitions(id),
    line_number INTEGER NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    item_code VARCHAR(50),
    category_id UUID NOT NULL REFERENCES categories(id),
    uom_id UUID NOT NULL REFERENCES uom_master(id),
    quantity NUMERIC(18,4) NOT NULL,
    estimated_unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
    estimated_total NUMERIC(18,2) GENERATED ALWAYS AS (quantity * estimated_unit_price) STORED,
    hsn_code VARCHAR(10),
    specifications TEXT,
    required_by_date DATE,
    delivery_location_id UUID REFERENCES delivery_locations(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, requisition_id, line_number)
);

CREATE TABLE unmapped_pr_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    requisition_id UUID NOT NULL REFERENCES requisitions(id),
    failed_fields JSONB NOT NULL,
    status unmapped_pr_status NOT NULL DEFAULT 'PENDING',
    assigned_to UUID REFERENCES users(id),
    sla_deadline TIMESTAMP WITH TIME ZONE,
    sla_breach_level INTEGER DEFAULT 0,
    proposed_mappings JSONB,
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    reprocessing_attempts INTEGER NOT NULL DEFAULT 0,
    last_reprocessing_error TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE unmapped_pr_mapping_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    exception_id UUID NOT NULL REFERENCES unmapped_pr_exceptions(id),
    field_name VARCHAR(50) NOT NULL,
    source_value VARCHAR(200) NOT NULL,
    mapped_to_id UUID NOT NULL,
    mapped_to_label VARCHAR(200) NOT NULL,
    mapping_method VARCHAR(20) NOT NULL,
    confidence NUMERIC(3,2),
    mapped_by UUID NOT NULL REFERENCES users(id),
    checked_by UUID REFERENCES users(id),
    checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.8 RFQ & Bid Tables

```sql
CREATE TABLE rfqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_number VARCHAR(30) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    rfq_type rfq_type NOT NULL DEFAULT 'LIMITED_TENDER',
    sourcing_type sourcing_type NOT NULL DEFAULT 'GOODS',
    evaluation_type evaluation_type NOT NULL DEFAULT 'L1_PRICE_ONLY',
    procurement_type procurement_type NOT NULL DEFAULT 'OPEX',
    status rfq_status NOT NULL DEFAULT 'DRAFT',
    buyer_id UUID NOT NULL REFERENCES users(id),
    business_unit_id UUID NOT NULL REFERENCES business_units(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    estimated_value NUMERIC(18,2) NOT NULL DEFAULT 0,
    payment_term_id UUID REFERENCES payment_terms(id),
    incoterm_id UUID REFERENCES incoterms(id),
    delivery_location_id UUID REFERENCES delivery_locations(id),
    bid_open_at TIMESTAMP WITH TIME ZONE,
    bid_close_at TIMESTAMP WITH TIME ZONE,
    technical_close_at TIMESTAMP WITH TIME ZONE,
    bid_validity_days INTEGER NOT NULL DEFAULT 90,
    is_multi_lot BOOLEAN NOT NULL DEFAULT FALSE,
    lot_participation_mode VARCHAR(20) DEFAULT 'MANDATORY_ALL',
    is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
    is_single_vendor BOOLEAN NOT NULL DEFAULT FALSE,
    single_vendor_justification TEXT,
    requires_co_authorization BOOLEAN NOT NULL DEFAULT FALSE,
    amendment_count INTEGER NOT NULL DEFAULT 0,
    wizard_step INTEGER NOT NULL DEFAULT 1,
    wizard_completed BOOLEAN NOT NULL DEFAULT FALSE,
    linked_pr_ids UUID[] DEFAULT '{}',
    published_at TIMESTAMP WITH TIME ZONE,
    bids_opened_at TIMESTAMP WITH TIME ZONE,
    bids_opened_by UUID REFERENCES users(id),
    co_authorized_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, rfq_number)
);

CREATE TABLE rfq_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_id UUID NOT NULL REFERENCES rfqs(id),
    lot_number INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    estimated_value NUMERIC(18,2) DEFAULT 0,
    payment_term_override_id UUID REFERENCES payment_terms(id),
    incoterm_override_id UUID REFERENCES incoterms(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, rfq_id, lot_number)
);

CREATE TABLE rfq_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_id UUID NOT NULL REFERENCES rfqs(id),
    lot_id UUID REFERENCES rfq_lots(id),
    line_number INTEGER NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    item_code VARCHAR(50),
    category_id UUID NOT NULL REFERENCES categories(id),
    uom_id UUID NOT NULL REFERENCES uom_master(id),
    quantity NUMERIC(18,4) NOT NULL,
    estimated_unit_price NUMERIC(18,4) DEFAULT 0,
    hsn_code VARCHAR(10),
    specifications TEXT,
    delivery_location_id UUID REFERENCES delivery_locations(id),
    required_by_date DATE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, rfq_id, line_number)
);

CREATE TABLE rfq_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_id UUID NOT NULL REFERENCES rfqs(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    invitation_status VARCHAR(20) NOT NULL DEFAULT 'INVITED',
    accepted_at TIMESTAMP WITH TIME ZONE,
    regretted_at TIMESTAMP WITH TIME ZONE,
    regret_reason TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, rfq_id, vendor_id)
);

CREATE TABLE rfq_clarifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_id UUID NOT NULL REFERENCES rfqs(id),
    question TEXT NOT NULL,
    answer TEXT,
    asked_by UUID NOT NULL REFERENCES users(id),
    asked_by_vendor_id UUID REFERENCES vendors(id),
    answered_by UUID REFERENCES users(id),
    answered_at TIMESTAMP WITH TIME ZONE,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE rfq_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_id UUID NOT NULL REFERENCES rfqs(id),
    amendment_number INTEGER NOT NULL,
    changes_summary TEXT NOT NULL,
    field_changes JSONB NOT NULL,
    previous_bid_close_at TIMESTAMP WITH TIME ZONE,
    new_bid_close_at TIMESTAMP WITH TIME ZONE,
    bids_reset BOOLEAN NOT NULL DEFAULT TRUE,
    admin_waiver BOOLEAN NOT NULL DEFAULT FALSE,
    amended_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, rfq_id, amendment_number)
);

CREATE TABLE bid_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_id UUID NOT NULL REFERENCES rfqs(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    status bid_status NOT NULL DEFAULT 'INVITED',
    bid_validity_date DATE,
    covering_letter TEXT,
    payment_terms_proposed_id UUID REFERENCES payment_terms(id),
    commercial_deviations TEXT,
    total_amount NUMERIC(18,2) DEFAULT 0,
    bid_hash VARCHAR(64),
    bid_sealed_at TIMESTAMP WITH TIME ZONE,
    bid_opened_at TIMESTAMP WITH TIME ZONE,
    technical_score NUMERIC(5,2),
    is_technically_qualified BOOLEAN,
    current_version INTEGER NOT NULL DEFAULT 1,
    submitted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, rfq_id, vendor_id)
);

CREATE TABLE bid_line_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    bid_id UUID NOT NULL REFERENCES bid_responses(id),
    rfq_line_id UUID NOT NULL REFERENCES rfq_lines(id),
    lot_id UUID REFERENCES rfq_lots(id),
    unit_price NUMERIC(18,4) NOT NULL,
    tax_rate_declared NUMERIC(5,2) NOT NULL DEFAULT 0,
    freight_quoted NUMERIC(18,2) NOT NULL DEFAULT 0,
    delivery_lead_time_days INTEGER NOT NULL,
    country_of_origin CHAR(2) DEFAULT 'IN',
    remarks TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, bid_id, rfq_line_id)
);

CREATE TABLE bid_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    bid_id UUID NOT NULL REFERENCES bid_responses(id),
    version_number INTEGER NOT NULL,
    version_data JSONB NOT NULL,
    bid_hash VARCHAR(64) NOT NULL,
    versioned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, bid_id, version_number)
);

CREATE TABLE bid_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    bid_id UUID NOT NULL REFERENCES bid_responses(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    document_type VARCHAR(20) NOT NULL,
    is_technical BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.9 Evaluation & Award Tables

```sql
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_id UUID NOT NULL REFERENCES rfqs(id),
    evaluation_type evaluation_type NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    evaluated_by UUID NOT NULL REFERENCES users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE evaluation_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id),
    bid_id UUID NOT NULL REFERENCES bid_responses(id),
    criterion VARCHAR(200) NOT NULL,
    max_score NUMERIC(5,2) NOT NULL,
    awarded_score NUMERIC(5,2) NOT NULL,
    remarks TEXT,
    scored_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE comparative_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_id UUID NOT NULL REFERENCES rfqs(id),
    cs_number VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    cost_of_capital_rate NUMERIC(5,4) NOT NULL,
    evaluation_methodology TEXT NOT NULL,
    total_estimated_value NUMERIC(18,2) NOT NULL,
    l1_total_value NUMERIC(18,2),
    savings_percentage NUMERIC(5,2),
    recommendations TEXT,
    generated_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    pdf_document_id UUID REFERENCES documents(id),
    cs_version INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, cs_number)
);

CREATE TABLE cs_line_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    cs_id UUID NOT NULL REFERENCES comparative_statements(id),
    rfq_line_id UUID NOT NULL REFERENCES rfq_lines(id),
    bid_id UUID NOT NULL REFERENCES bid_responses(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    raw_unit_price NUMERIC(18,4) NOT NULL,
    freight_per_unit NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax_per_unit NUMERIC(18,4) NOT NULL DEFAULT 0,
    landed_cost NUMERIC(18,4) NOT NULL,
    npv_adjusted_cost NUMERIC(18,4) NOT NULL,
    rank INTEGER NOT NULL,
    tax_discrepancy BOOLEAN NOT NULL DEFAULT FALSE,
    supplier_declared_rate NUMERIC(5,2),
    hsn_master_rate NUMERIC(5,2),
    tie_breaking_applied BOOLEAN NOT NULL DEFAULT FALSE,
    tie_breaking_reason VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE negotiations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_id UUID NOT NULL REFERENCES rfqs(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    round_number INTEGER NOT NULL DEFAULT 1,
    proposed_price NUMERIC(18,4),
    counter_price NUMERIC(18,4),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    notes TEXT,
    negotiated_by UUID NOT NULL REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE award_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    rfq_id UUID NOT NULL REFERENCES rfqs(id),
    cs_id UUID NOT NULL REFERENCES comparative_statements(id),
    arn_number VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    justification TEXT NOT NULL,
    recommended_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, arn_number)
);

CREATE TABLE award_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    arn_id UUID NOT NULL REFERENCES award_recommendations(id),
    rfq_line_id UUID REFERENCES rfq_lines(id),
    lot_id UUID REFERENCES rfq_lots(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    bid_id UUID NOT NULL REFERENCES bid_responses(id),
    awarded_unit_price NUMERIC(18,4) NOT NULL,
    awarded_quantity NUMERIC(18,4) NOT NULL,
    awarded_total NUMERIC(18,2) NOT NULL,
    award_type VARCHAR(20) NOT NULL DEFAULT 'FULL',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.10 Contract Tables

```sql
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    contract_number VARCHAR(30) NOT NULL,
    title VARCHAR(300) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    rfq_id UUID REFERENCES rfqs(id),
    arn_id UUID REFERENCES award_recommendations(id),
    status contract_status NOT NULL DEFAULT 'DRAFT',
    contract_type VARCHAR(50) NOT NULL DEFAULT 'RATE_CONTRACT',
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    total_value NUMERIC(18,2) NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    payment_term_id UUID REFERENCES payment_terms(id),
    incoterm_id UUID REFERENCES incoterms(id),
    business_unit_id UUID NOT NULL REFERENCES business_units(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    template_id UUID,
    signing_log JSONB DEFAULT '[]',
    signed_document_id UUID REFERENCES documents(id),
    esign_request_id VARCHAR(200),
    esign_provider VARCHAR(50),
    amendment_count INTEGER NOT NULL DEFAULT 0,
    renewal_alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    erp_contract_number VARCHAR(30),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, contract_number),
    CONSTRAINT chk_contract_dates CHECK (end_date > start_date)
);

CREATE TABLE contract_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    contract_id UUID NOT NULL REFERENCES contracts(id),
    line_number INTEGER NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uom_master(id),
    contracted_quantity NUMERIC(18,4),
    unit_rate NUMERIC(18,4) NOT NULL,
    utilized_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
    hsn_code VARCHAR(10),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, contract_id, line_number)
);

CREATE TABLE contract_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    contract_id UUID NOT NULL REFERENCES contracts(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    document_purpose VARCHAR(50) NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE contract_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    contract_id UUID NOT NULL REFERENCES contracts(id),
    amendment_number INTEGER NOT NULL,
    changes_summary TEXT NOT NULL,
    field_changes JSONB NOT NULL,
    new_document_id UUID REFERENCES documents(id),
    amended_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, contract_id, amendment_number)
);

CREATE TABLE contract_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    contract_id UUID NOT NULL REFERENCES contracts(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    responsible_party VARCHAR(20) NOT NULL,
    responsible_user_id UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.11 Purchase Order Tables

```sql
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    po_number VARCHAR(30) NOT NULL,
    title VARCHAR(300) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    rfq_id UUID REFERENCES rfqs(id),
    arn_id UUID REFERENCES award_recommendations(id),
    contract_id UUID REFERENCES contracts(id),
    status po_status NOT NULL DEFAULT 'DRAFT',
    business_unit_id UUID NOT NULL REFERENCES business_units(id),
    plant_id UUID REFERENCES plants(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    total_value NUMERIC(18,2) NOT NULL DEFAULT 0,
    payment_term_id UUID REFERENCES payment_terms(id),
    incoterm_id UUID REFERENCES incoterms(id),
    delivery_location_id UUID REFERENCES delivery_locations(id),
    expected_delivery_date DATE,
    buyer_id UUID NOT NULL REFERENCES users(id),
    erp_po_number VARCHAR(30),
    erp_sync_status VARCHAR(20) DEFAULT 'NOT_SYNCED',
    po_pdf_document_id UUID REFERENCES documents(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    rejected_reason TEXT,
    amendment_count INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, po_number)
);

CREATE TABLE po_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    po_id UUID NOT NULL REFERENCES purchase_orders(id),
    line_number INTEGER NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    item_code VARCHAR(50),
    uom_id UUID NOT NULL REFERENCES uom_master(id),
    ordered_quantity NUMERIC(18,4) NOT NULL,
    unit_price NUMERIC(18,4) NOT NULL,
    total_price NUMERIC(18,2) GENERATED ALWAYS AS (ordered_quantity * unit_price) STORED,
    awarded_unit_price NUMERIC(18,4),
    hsn_code VARCHAR(10),
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    open_quantity NUMERIC(18,4) NOT NULL,
    invoiced_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
    delivery_date DATE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, po_id, line_number)
);

CREATE TABLE po_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    po_id UUID NOT NULL REFERENCES purchase_orders(id),
    amendment_number INTEGER NOT NULL,
    reason TEXT NOT NULL,
    field_changes JSONB NOT NULL,
    value_change NUMERIC(18,2) DEFAULT 0,
    re_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    amended_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, po_id, amendment_number)
);
```

### 3.12 GRN / SES Tables

```sql
CREATE TABLE goods_receipt_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    grn_number VARCHAR(30) NOT NULL,
    po_id UUID NOT NULL REFERENCES purchase_orders(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    receipt_date DATE NOT NULL,
    received_by UUID NOT NULL REFERENCES users(id),
    challan_number VARCHAR(50),
    challan_date DATE,
    transporter_name VARCHAR(200),
    lr_number VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    erp_grn_number VARCHAR(30),
    notes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, grn_number)
);

CREATE TABLE grn_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    grn_id UUID NOT NULL REFERENCES goods_receipt_notes(id),
    po_line_id UUID NOT NULL REFERENCES po_lines(id),
    received_quantity NUMERIC(18,4) NOT NULL,
    accepted_quantity NUMERIC(18,4) NOT NULL,
    rejected_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    qc_required BOOLEAN NOT NULL DEFAULT FALSE,
    qc_status VARCHAR(20) DEFAULT 'NOT_REQUIRED',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE service_entry_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    ses_number VARCHAR(30) NOT NULL,
    po_id UUID NOT NULL REFERENCES purchase_orders(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    service_period_start DATE NOT NULL,
    service_period_end DATE NOT NULL,
    certified_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    erp_ses_number VARCHAR(30),
    notes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, ses_number)
);

CREATE TABLE ses_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    ses_id UUID NOT NULL REFERENCES service_entry_sheets(id),
    po_line_id UUID NOT NULL REFERENCES po_lines(id),
    service_description VARCHAR(500) NOT NULL,
    completed_quantity NUMERIC(18,4) NOT NULL,
    completion_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE quality_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    grn_line_id UUID NOT NULL REFERENCES grn_lines(id),
    inspector_id UUID NOT NULL REFERENCES users(id),
    inspection_date DATE NOT NULL,
    result VARCHAR(20) NOT NULL,
    accepted_quantity NUMERIC(18,4) NOT NULL,
    rejected_quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
    remarks TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.13 Invoice & Payment Tables

```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    invoice_number VARCHAR(50) NOT NULL,
    vendor_invoice_number VARCHAR(50) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    po_id UUID NOT NULL REFERENCES purchase_orders(id),
    status invoice_status NOT NULL DEFAULT 'DRAFT',
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    subtotal NUMERIC(18,2) NOT NULL,
    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18,2) NOT NULL,
    match_status VARCHAR(20) DEFAULT 'NOT_MATCHED',
    price_tolerance NUMERIC(5,4) NOT NULL DEFAULT 0.0050,
    erp_invoice_number VARCHAR(50),
    erp_sync_status VARCHAR(20) DEFAULT 'NOT_SYNCED',
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (org_id, vendor_id, vendor_invoice_number)
);

CREATE TABLE invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    po_line_id UUID NOT NULL REFERENCES po_lines(id),
    grn_line_id UUID REFERENCES grn_lines(id),
    line_number INTEGER NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    quantity NUMERIC(18,4) NOT NULL,
    unit_price NUMERIC(18,4) NOT NULL,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(18,2) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, invoice_id, line_number)
);

CREATE TABLE invoice_match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    invoice_line_id UUID NOT NULL REFERENCES invoice_lines(id),
    po_line_id UUID NOT NULL REFERENCES po_lines(id),
    price_match BOOLEAN NOT NULL,
    price_deviation NUMERIC(10,4),
    quantity_match BOOLEAN NOT NULL,
    quantity_deviation NUMERIC(18,4),
    po_reference_valid BOOLEAN NOT NULL,
    tax_match BOOLEAN NOT NULL DEFAULT TRUE,
    tax_deviation NUMERIC(5,2) DEFAULT 0,
    overall_match BOOLEAN NOT NULL,
    mismatch_reasons TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    payment_date DATE NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    utr_number VARCHAR(50),
    payment_method VARCHAR(30),
    erp_payment_reference VARCHAR(50),
    status payment_status NOT NULL DEFAULT 'COMPLETED',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    reason_code VARCHAR(30) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    raised_by UUID NOT NULL REFERENCES users(id),
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    resolution_action VARCHAR(30),
    credit_note_amount NUMERIC(18,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT chk_dispute_reason CHECK (reason_code IN (
        'PRICE_MISMATCH', 'QUANTITY_MISMATCH', 'WRONG_PO', 'DUPLICATE',
        'QUALITY_ISSUE', 'PAYMENT_OVERDUE', 'OTHER'
    ))
);

CREATE TABLE dispute_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    dispute_id UUID NOT NULL REFERENCES disputes(id),
    sender_id UUID NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    attachments UUID[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.14 Document Tables

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    category document_category NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    stored_filename VARCHAR(500) NOT NULL,
    minio_bucket VARCHAR(50) NOT NULL,
    minio_key VARCHAR(1000) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    scan_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    scan_result VARCHAR(20),
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    encryption_key_ref VARCHAR(200),
    ocr_extracted_data JSONB,
    current_version INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    version_number INTEGER NOT NULL,
    minio_key VARCHAR(1000) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, document_id, version_number)
);
```

### 3.15 Notification Tables

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    notification_type VARCHAR(100) NOT NULL,
    channel notification_channel NOT NULL,
    title VARCHAR(300) NOT NULL,
    body TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    status notification_status NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    provider_message_id VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    notification_type VARCHAR(100) NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    inapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    digest_mode BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, user_id, notification_type)
);

CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    template_code VARCHAR(100) NOT NULL,
    channel notification_channel NOT NULL,
    language VARCHAR(5) NOT NULL DEFAULT 'en',
    subject_template VARCHAR(500),
    body_template TEXT NOT NULL,
    variables TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, template_code, channel, language)
);

CREATE TABLE communication_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    subject VARCHAR(300) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    thread_id UUID NOT NULL REFERENCES communication_threads(id),
    sender_id UUID NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    attachments UUID[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### 3.16 Audit, Outbox, Integration, Admin Tables

```sql
-- Partitioned audit_logs (see Section 7 for partition setup)
CREATE TABLE audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    entity_type audit_entity_type NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id UUID,
    actor_email VARCHAR(255),
    actor_ip INET,
    field_changes JSONB,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    trace_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE outbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    exchange VARCHAR(100) NOT NULL,
    routing_key VARCHAR(200) NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    CONSTRAINT chk_outbox_status CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED'))
);

CREATE TABLE integration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    job_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    direction VARCHAR(10) NOT NULL,
    adapter_type VARCHAR(30) NOT NULL,
    status integration_job_status NOT NULL DEFAULT 'PENDING',
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 7,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    flag_key VARCHAR(100) NOT NULL,
    flag_value BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID,
    UNIQUE (org_id, flag_key)
);

CREATE TABLE tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID,
    UNIQUE (org_id, setting_key)
);

CREATE TABLE scheduled_job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID,
    job_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    contract_type VARCHAR(50) NOT NULL,
    template_content JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMP WITH TIME ZONE
);
```

---

## 4. Critical Indexes

```sql
-- Composite (org_id, status) indexes on all entity tables
CREATE INDEX idx_users_org_status ON users (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_org_status ON vendors (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_requisitions_org_status ON requisitions (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_rfqs_org_status ON rfqs (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_bid_responses_org_status ON bid_responses (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_org_status ON contracts (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_pos_org_status ON purchase_orders (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_org_status ON invoices (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflow_instances_org_status ON workflow_instances (org_id, status);
CREATE INDEX idx_workflow_tasks_org_status ON workflow_tasks (org_id, status);

-- Time-based indexes
CREATE INDEX idx_requisitions_org_created ON requisitions (org_id, created_at DESC);
CREATE INDEX idx_rfqs_org_created ON rfqs (org_id, created_at DESC);
CREATE INDEX idx_invoices_org_created ON invoices (org_id, created_at DESC);
CREATE INDEX idx_notifications_user_created ON notifications (org_id, user_id, created_at DESC);

-- GIN indexes on JSONB columns
CREATE INDEX idx_approval_rules_conditions ON approval_rules USING GIN (conditions);
CREATE INDEX idx_approval_rules_steps ON approval_rules USING GIN (approval_steps);
CREATE INDEX idx_workflow_templates_steps ON workflow_templates USING GIN (steps);
CREATE INDEX idx_audit_logs_field_changes ON audit_logs USING GIN (field_changes);
CREATE INDEX idx_unmapped_failed_fields ON unmapped_pr_exceptions USING GIN (failed_fields);

-- Partial indexes for audit queries
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs (actor_id, created_at DESC) WHERE actor_id IS NOT NULL;

-- Workflow task assignment lookups
CREATE INDEX idx_workflow_tasks_assigned ON workflow_tasks (org_id, assigned_to, status) WHERE status = 'PENDING';
CREATE INDEX idx_workflow_tasks_sla ON workflow_tasks (sla_deadline) WHERE status = 'PENDING' AND sla_deadline IS NOT NULL;

-- Outbox processing
CREATE INDEX idx_outbox_pending ON outbox_messages (status, created_at) WHERE status = 'PENDING';

-- Integration job retry
CREATE INDEX idx_integration_retry ON integration_jobs (status, next_retry_at) WHERE status IN ('FAILED', 'RETRY_SCHEDULED');

-- Bid deadline queries
CREATE INDEX idx_rfqs_bid_close ON rfqs (org_id, bid_close_at) WHERE status IN ('PUBLISHED', 'BID_OPEN');

-- Vendor duplicate detection
CREATE INDEX idx_vendors_pan ON vendors (org_id, pan) WHERE pan IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_vendors_gstin ON vendors (org_id, gstin) WHERE gstin IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_vendor_bank_ifsc ON vendor_bank_accounts (org_id, ifsc_code) WHERE deleted_at IS NULL;
```

---

## 5. Audit Log Immutability Trigger

```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are prohibited.'
        USING ERRCODE = 'restrict_violation';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();
```

The application connects to PostgreSQL using a dedicated `app_audit_writer` role that has `INSERT`-only privilege on `audit_logs`:

```sql
CREATE ROLE app_audit_writer;
GRANT INSERT ON audit_logs TO app_audit_writer;
REVOKE UPDATE, DELETE ON audit_logs FROM app_audit_writer;
```

---

## 6. Row-Level Security Policies

```sql
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendors_org_isolation ON vendors
    USING (org_id = current_setting('app.current_org_id')::UUID);

ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY requisitions_org_isolation ON requisitions
    USING (org_id = current_setting('app.current_org_id')::UUID);

ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY rfqs_org_isolation ON rfqs
    USING (org_id = current_setting('app.current_org_id')::UUID);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY pos_org_isolation ON purchase_orders
    USING (org_id = current_setting('app.current_org_id')::UUID);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_org_isolation ON invoices
    USING (org_id = current_setting('app.current_org_id')::UUID);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contracts_org_isolation ON contracts
    USING (org_id = current_setting('app.current_org_id')::UUID);
```

RLS is applied to all entity tables following the same pattern. The application sets `app.current_org_id` on each database session via `SET LOCAL app.current_org_id = '{org_id}'` as the first statement after connection checkout. This provides defense-in-depth alongside application-layer `WHERE org_id = :org_id` filtering.

---

## 7. Audit Log Partitioning

```sql
-- Create monthly partitions (automated via Celery task or pg_partman)
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... continued monthly

-- Automated partition creation (pg_partman or Celery task creates 3 months ahead)
-- Old partitions (>10 years) detached and moved to cold storage
```

---

## 8. Soft Delete Pattern

All entity tables include `deleted_at TIMESTAMP WITH TIME ZONE` column. SQLAlchemy applies a global filter:

```python
# app/db/base.py
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import event

class BaseModel(DeclarativeBase):
    __abstract__ = True

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(nullable=False, index=True)
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(default=None)

# Soft delete filter applied at query level in repository base class:
# query = query.where(Model.deleted_at.is_(None))
```

---

## 9. Alembic Migration Strategy

- **Naming convention:** `{rev}_{slug}.py` (e.g., `0001_initial_schema.py`)
- **Async env.py:** Uses `asyncpg` driver with `run_async` wrapper
- **Autogenerate:** Configured to detect table additions, column changes, index changes; ENUM type changes require manual migration
- **Migration review:** All migrations reviewed before merge; destructive migrations (DROP COLUMN, DROP TABLE) require explicit approval
- **Rollback:** Every migration includes `downgrade()` function; tested in CI

```python
# alembic/env.py
from sqlalchemy.ext.asyncio import create_async_engine
from app.db.base import BaseModel

target_metadata = BaseModel.metadata

async def run_migrations_online():
    engine = create_async_engine(config.get_main_option("sqlalchemy.url"))
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()
```

---

## 10. PgBouncer Configuration

```ini
[databases]
procurement = host=postgresql-primary port=5432 dbname=procurement

[pgbouncer]
pool_mode = transaction
default_pool_size = 50
max_client_conn = 200
min_pool_size = 10
reserve_pool_size = 5
reserve_pool_timeout = 3
max_db_connections = 100
idle_transaction_timeout = 30
server_idle_timeout = 600
log_connections = 0
log_disconnections = 0
stats_period = 60
```

**Connection flow:** FastAPI → PgBouncer (port 6432) → PostgreSQL (port 5432). PgBouncer handles connection pooling in `transaction` mode, allowing connection reuse across requests while maintaining transaction isolation.
