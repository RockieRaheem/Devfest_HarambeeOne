import logging
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from harambeeone_api.config import get_settings
from harambeeone_api.database import get_engine
from harambeeone_api.models import (
    AuditEvent,
    School,
    SupportCampaignMedia,
    SupportCase,
    SupportPledge,
)

logger = logging.getLogger(__name__)

PUBLIC_CODE = "HS-E80EEC6A77"
EXPECTED_SCHOOL = "Kampala Community School"
EXPECTED_TITLE = "Help a candidate get lunch during exams"
EXPECTED_TARGET = Decimal("24000.00")
EXPECTED_VERIFIED_AMOUNT = Decimal("19985.00")
AUDIT_MARKER = "owner-request:HS-E80EEC6A77:2026-10-30"


def withdraw_requested_campaign() -> None:
    """Withdraw one owner-approved campaign while retaining its financial evidence."""
    settings = get_settings()
    session_info = (
        {"database_server_role": settings.cloud_sql_server_role}
        if settings.database_provider == "cloud_sql"
        else None
    )
    with Session(get_engine(), expire_on_commit=False, info=session_info) as session:
        with session.begin():
            row = session.execute(
                select(SupportCase, School.name)
                .join(School, School.id == SupportCase.school_id)
                .where(SupportCase.public_code == PUBLIC_CODE)
                .with_for_update()
            ).one_or_none()
            if row is None:
                logger.info("Requested campaign withdrawal skipped; campaign is absent")
                return

            support_case, school_name = row
            if support_case.status == "withdrawn":
                logger.info("Requested campaign withdrawal already complete")
                return
            if (
                school_name != EXPECTED_SCHOOL
                or support_case.title != EXPECTED_TITLE
                or support_case.target_amount != EXPECTED_TARGET
                or support_case.status != "published"
            ):
                raise RuntimeError("Requested campaign identity changed; refusing withdrawal")

            pledge_count, verified_count, verified_amount, posted_count = session.execute(
                select(
                    func.count(SupportPledge.id),
                    func.count(SupportPledge.id).filter(
                        SupportPledge.status == "verified"
                    ),
                    func.coalesce(
                        func.sum(SupportPledge.amount).filter(
                            SupportPledge.status == "verified"
                        ),
                        0,
                    ),
                    func.count(SupportPledge.id).filter(
                        SupportPledge.status == "verified",
                        SupportPledge.payment_id.is_not(None),
                    ),
                ).where(SupportPledge.case_id == support_case.id)
            ).one()
            if (
                pledge_count != 1
                or verified_count != 1
                or posted_count != 1
                or verified_amount != EXPECTED_VERIFIED_AMOUNT
            ):
                raise RuntimeError(
                    "Requested campaign financial evidence changed; refusing withdrawal"
                )

            existing_marker = session.scalar(
                select(AuditEvent.id).where(
                    AuditEvent.entity_type == "support_case",
                    AuditEvent.entity_id == support_case.id,
                    AuditEvent.summary == AUDIT_MARKER,
                )
            )
            if existing_marker is not None:
                raise RuntimeError("Withdrawal marker exists but campaign remains public")

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
                    summary=AUDIT_MARKER,
                )
            )
            logger.info(
                "Requested campaign withdrawn; verified financial evidence retained"
            )
