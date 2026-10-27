"""Add Stellar testnet support destination and transaction replay protection."""

from alembic import op

revision = "e6b3f91a7c42"
down_revision = "c4f8a1d29e60"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("support_payment_destinations") as batch:
        batch.drop_constraint("ck_support_payment_destinations_channel", type_="check")
        batch.create_check_constraint(
            "ck_support_payment_destinations_channel",
            "channel in ('schoolpay','bank','mobile_money','stellar')",
        )
    op.create_unique_constraint(
        "uq_stellar_anchors_transaction_hash", "stellar_anchors", ["transaction_hash"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_stellar_anchors_transaction_hash", "stellar_anchors", type_="unique"
    )
    with op.batch_alter_table("support_payment_destinations") as batch:
        batch.drop_constraint("ck_support_payment_destinations_channel", type_="check")
        batch.create_check_constraint(
            "ck_support_payment_destinations_channel",
            "channel in ('schoolpay','bank','mobile_money')",
        )
