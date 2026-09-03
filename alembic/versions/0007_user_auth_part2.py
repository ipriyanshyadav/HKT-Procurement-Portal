"""Create users and remaining auth tables

Revision ID: 0007_user_auth_part2
Revises: 0006_vendor
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0007_user_auth_part2'
down_revision: Union[str, None] = '0006_vendor'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
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
    """)

    op.execute("""
    ALTER TABLE password_history
        ADD CONSTRAINT fk_password_history_user FOREIGN KEY (user_id) REFERENCES users(id);
    """)

    op.execute("""
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
    """)

    op.execute("""
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
    """)

    op.execute("""
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
    """)

    op.execute("""
    CREATE TABLE user_category_scopes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        user_id UUID NOT NULL REFERENCES users(id),
        category_id UUID NOT NULL REFERENCES categories(id),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        UNIQUE (org_id, user_id, category_id)
    );
    """)

    op.execute("""
    CREATE TABLE user_bu_scopes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        user_id UUID NOT NULL REFERENCES users(id),
        business_unit_id UUID NOT NULL REFERENCES business_units(id),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by UUID,
        UNIQUE (org_id, user_id, business_unit_id)
    );
    """)

    op.execute("""
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
    """)

    op.execute("""
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
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS delegation_rules CASCADE")
    op.execute("DROP TABLE IF EXISTS user_coi_declarations CASCADE")
    op.execute("DROP TABLE IF EXISTS user_bu_scopes CASCADE")
    op.execute("DROP TABLE IF EXISTS user_category_scopes CASCADE")
    op.execute("DROP TABLE IF EXISTS user_role_assignments CASCADE")
    op.execute("DROP TABLE IF EXISTS user_mfa CASCADE")
    op.execute("DROP TABLE IF EXISTS user_sessions CASCADE")
    op.execute("ALTER TABLE password_history DROP CONSTRAINT IF EXISTS fk_password_history_user")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
