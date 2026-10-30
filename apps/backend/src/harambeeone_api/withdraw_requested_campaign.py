from decimal import Decimal
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from harambeeone_api.database import close_database, get_engine
from harambeeone_api.models import (
    AuditEvent,
    School,
    SupportCampaignMedia,
    SupportCase,
    SupportPledge,
)


PUBLIC_CODE = "HS-E80EEC6A77"
EXPECTED_CASE_ID = UUID("2e6b318b-73de-48d2-a357-f2fa238d3c5d")
EXPECTED_SCHOOL = "Kampala Community School"
EXPECTED_VERIFIED_AMOUNT = Decimal("19985.00")


def withdraw() -> None:
    try:
        with Session(get_engine()) as session, session.begin():
            support_case, school_name = session.execute(
                select(SupportCase, School.name)
                .join(School, School.id == SupportCase.school_id)
                .where(SupportCase.public_code == PUBLIC_CODE)
                .with_for_update()
            ).one()
            if support_case.id != EXPECTED_CASE_ID or school_name != EXPECTED_SCHOOL:
                raise RuntimeError("Campaign identity changed; refusing withdrawal")

            pledge_count, verified_amount = session.execute(
                select(func.count(SupportPledge.id), func.sum(SupportPledge.amount)).where(
                    SupportPledge.case_id == support_case.id,
                    SupportPledge.status == "verified",
                    SupportPledge.payment_id.is_not(None),
                )
            ).one()
            if pledge_count != 1 or verified_amount != EXPECTED_VERIFIED_AMOUNT:
                raise RuntimeError("Campaign financial evidence changed; refusing withdrawal")

            if support_case.status != "withdrawn":
                now = datetime.now(UTC)
                support_case.status = "withdrawn"
                support_case.closed_at = now
                media = session.scalar(
                    select(SupportCampaignMedia).where(
                        SupportCampaignMedia.case_id == support_case.id
                    )
                )
                if media is not None and media.status != "removed":
                    media.status = "removed"
                    media.content = b""
                    media.byte_size = 0
                    media.removed_by = "system:owner-request"
                    media.removed_at = now
                session.add(
                    AuditEvent(
                        school_id=support_case.school_id,
                        entity_type="support_case",
                        entity_id=support_case.id,
                        action="withdrawn",
                        actor="system:owner-request",
                        summary=(
                            f"Withdrew campaign {PUBLIC_CODE} from public access at owner "
                            "request; verified financial evidence retained"
                        ),
                    )
                )
            print("WITHDRAWN", PUBLIC_CODE, support_case.id, pledge_count, verified_amount)
    finally:
        close_database()


if __name__ == "__main__":
    withdraw()
