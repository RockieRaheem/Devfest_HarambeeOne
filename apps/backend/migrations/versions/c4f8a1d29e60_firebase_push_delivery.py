"""add Firebase push installations and delivery evidence

Revision ID: c4f8a1d29e60
Revises: a8c4e2f19b70
Create Date: 2026-10-26 16:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c4f8a1d29e60"
down_revision: str | None = "a8c4e2f19b70"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "push_installations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("auth_user_id", sa.Uuid(), nullable=False),
        sa.Column("installation_id", sa.String(512), nullable=False, unique=True),
        sa.Column("target_kind", sa.String(16), nullable=False, server_default="fid"),
        sa.Column("device_label", sa.String(100), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "target_kind in ('fid','token')", name="ck_push_installations_target_kind"
        ),
    )
    op.create_index("ix_push_installations_auth_user_id", "push_installations", ["auth_user_id"])
    op.create_index(
        "ix_push_installations_user_active",
        "push_installations",
        ["auth_user_id", "revoked_at"],
    )
    op.create_table(
        "push_deliveries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "outbox_id",
            sa.Uuid(),
            sa.ForeignKey("support_notification_outbox.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "installation_id",
            sa.Uuid(),
            sa.ForeignKey("push_installations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("provider_message_id", sa.String(300)),
        sa.Column("last_error_code", sa.String(80)),
        sa.UniqueConstraint(
            "outbox_id", "installation_id", name="uq_push_delivery_outbox_installation"
        ),
        sa.CheckConstraint(
            "status in ('pending','delivered','retry','invalid','failed')",
            name="ck_push_deliveries_status",
        ),
    )
    op.create_index("ix_push_deliveries_outbox_id", "push_deliveries", ["outbox_id"])
    op.create_index(
        "ix_push_deliveries_installation_id", "push_deliveries", ["installation_id"]
    )
    op.create_index(
        "ix_push_deliveries_status_time", "push_deliveries", ["status", "next_attempt_at"]
    )
    for table in ("push_installations", "push_deliveries"):
        op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'REVOKE ALL ON TABLE public."{table}" FROM anon, authenticated')
    op.execute(
        """
        CREATE POLICY push_installations_self_access ON public.push_installations
        FOR ALL TO authenticated
        USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid())
        """
    )
    op.execute(
        """
        CREATE POLICY push_deliveries_self_read ON public.push_deliveries
        FOR SELECT TO authenticated USING (
            EXISTS (SELECT 1 FROM public.push_installations p
                    WHERE p.id = push_deliveries.installation_id
                      AND p.auth_user_id = auth.uid())
        )
        """
    )


def downgrade() -> None:
    op.drop_table("push_deliveries")
    op.drop_table("push_installations")
