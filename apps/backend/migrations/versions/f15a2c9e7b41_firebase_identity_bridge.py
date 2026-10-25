"""add Firebase identity bridge

Revision ID: f15a2c9e7b41
Revises: a72d5e8c19f4
Create Date: 2026-10-25 14:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f15a2c9e7b41"
down_revision: str | None = "a72d5e8c19f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "identity_provider_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_subject", sa.String(length=128), nullable=False),
        sa.Column("internal_user_id", sa.Uuid(), nullable=False),
        sa.Column("normalized_email", sa.String(length=254), nullable=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("migrated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "provider in ('firebase','supabase')", name="ck_identity_provider_name"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider", "internal_user_id", name="uq_identity_provider_internal_user"
        ),
        sa.UniqueConstraint(
            "provider", "provider_subject", name="uq_identity_provider_subject"
        ),
    )
    op.create_index(
        "ix_identity_provider_accounts_internal_user_id",
        "identity_provider_accounts",
        ["internal_user_id"],
    )
    op.create_index(
        "ix_identity_provider_email",
        "identity_provider_accounts",
        ["provider", "normalized_email"],
    )


def downgrade() -> None:
    op.drop_index("ix_identity_provider_email", table_name="identity_provider_accounts")
    op.drop_index(
        "ix_identity_provider_accounts_internal_user_id",
        table_name="identity_provider_accounts",
    )
    op.drop_table("identity_provider_accounts")
