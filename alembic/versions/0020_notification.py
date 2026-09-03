"""Create notification and communication tables

Revision ID: 0020_notification
Revises: 0019_document
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '0020_notification'
down_revision: Union[str, None] = '0019_document'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
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
    """)

    op.execute("""
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
    """)

    op.execute("""
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
    """)

    op.execute("""
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
    """)

    op.execute("""
    CREATE TABLE communication_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id),
        thread_id UUID NOT NULL REFERENCES communication_threads(id),
        sender_id UUID NOT NULL REFERENCES users(id),
        message TEXT NOT NULL,
        attachments UUID[],
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS communication_messages CASCADE")
    op.execute("DROP TABLE IF EXISTS communication_threads CASCADE")
    op.execute("DROP TABLE IF EXISTS notification_templates CASCADE")
    op.execute("DROP TABLE IF EXISTS notification_preferences CASCADE")
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")
