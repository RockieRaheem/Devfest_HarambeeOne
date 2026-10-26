"""rename AI consent fields for Gemini

Revision ID: a8c4e2f19b70
Revises: f7a2d41e6c93
Create Date: 2026-10-26 12:00:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = "a8c4e2f19b70"
down_revision: str | None = "f7a2d41e6c93"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "support_referrals", "gemma_processing", new_column_name="gemini_processing"
    )
    op.alter_column(
        "support_consents", "gemma_processing", new_column_name="gemini_processing"
    )


def downgrade() -> None:
    op.alter_column(
        "support_consents", "gemini_processing", new_column_name="gemma_processing"
    )
    op.alter_column(
        "support_referrals", "gemini_processing", new_column_name="gemma_processing"
    )
