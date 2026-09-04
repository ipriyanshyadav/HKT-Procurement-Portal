"""live_auction tables

Revision ID: 0028_live_auction
Revises: 0029_rfq_bid_spec10_11
Create Date: 2026-09-04 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET

revision: str = '0028_live_auction'
down_revision: Union[str, None] = '0029_rfq_bid_spec10_11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # bidding_mode on rfqs
    op.execute("CREATE TYPE biddingmode AS ENUM ('SEALED', 'LIVE_AUCTION', 'HYBRID')")
    op.execute("ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'AUCTION'")
    op.add_column('rfqs', sa.Column('bidding_mode', sa.Text(), nullable=False,
        server_default='SEALED'))
    op.add_column('rfqs', sa.Column('auction_config', JSONB(), nullable=True))

    op.create_table('live_auctions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True), nullable=False),
        sa.Column('rfq_id', UUID(as_uuid=True), sa.ForeignKey('rfqs.id'), nullable=False),
        sa.Column('status', sa.Text(), nullable=False, server_default='SCHEDULED'),
        sa.Column('config', JSONB(), nullable=False),
        sa.Column('scheduled_start_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('actual_start_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('current_close_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('extension_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('winner_vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendors.id'), nullable=True),
        sa.Column('winning_bid_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
    )

    op.create_table('live_bids',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True), nullable=False),
        sa.Column('auction_id', UUID(as_uuid=True), sa.ForeignKey('live_auctions.id'), nullable=False),
        sa.Column('rfq_id', UUID(as_uuid=True), sa.ForeignKey('rfqs.id'), nullable=False),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendors.id'), nullable=False),
        sa.Column('lot_id', UUID(as_uuid=True), sa.ForeignKey('rfq_lots.id'), nullable=True),
        sa.Column('bid_amount_inr', sa.Numeric(20, 4), nullable=False),
        sa.Column('bid_sequence', sa.Integer(), nullable=False),
        sa.Column('is_valid', sa.Boolean(), nullable=False, server_default='TRUE'),
        sa.Column('invalidation_reason', sa.Text(), nullable=True),
        sa.Column('submitted_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('client_ip', INET(), nullable=True),
        sa.Column('session_id', sa.Text(), nullable=True),
    )

    op.create_table('auction_rank_snapshots',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True), nullable=False),
        sa.Column('auction_id', UUID(as_uuid=True), sa.ForeignKey('live_auctions.id'), nullable=False),
        sa.Column('snapshot_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('trigger_bid_id', UUID(as_uuid=True), sa.ForeignKey('live_bids.id'), nullable=True),
        sa.Column('ranks', JSONB(), nullable=False),
    )

    op.create_table('auction_participants',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True), nullable=False),
        sa.Column('auction_id', UUID(as_uuid=True), sa.ForeignKey('live_auctions.id'), nullable=False),
        sa.Column('vendor_id', UUID(as_uuid=True), sa.ForeignKey('vendors.id'), nullable=False),
        sa.Column('joined_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('left_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('is_connected', sa.Boolean(), nullable=False, server_default='FALSE'),
        sa.Column('proxy_floor_inr', sa.Numeric(20, 4), nullable=True),
    )

    # Indexes
    with op.get_context().autocommit_block():
        op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_bids_auction_vendor ON live_bids(auction_id, vendor_id, bid_amount_inr ASC) WHERE is_valid = TRUE")
        op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_bids_auction_sequence ON live_bids(auction_id, bid_sequence DESC)")
        op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_auctions_status_close ON live_auctions(status, current_close_at) WHERE deleted_at IS NULL")
        op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_auctions_start ON live_auctions(status, scheduled_start_at) WHERE deleted_at IS NULL")
        op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auction_participants_lookup ON auction_participants(auction_id, vendor_id)")

def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_auction_participants_lookup")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_live_auctions_start")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_live_auctions_status_close")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_live_bids_auction_sequence")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_live_bids_auction_vendor")
    op.drop_table('auction_participants')
    op.drop_table('auction_rank_snapshots')
    op.drop_table('live_bids')
    op.drop_table('live_auctions')
    op.drop_column('rfqs', 'auction_config')
    op.drop_column('rfqs', 'bidding_mode')
    op.execute("DROP TYPE IF EXISTS biddingmode")
