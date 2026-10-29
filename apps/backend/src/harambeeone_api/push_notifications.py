import re
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import exceptions as firebase_exceptions
from firebase_admin import messaging
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from harambeeone_api.auth import AuthenticatedUser, firebase_auth_app, get_current_user
from harambeeone_api.database import get_server_session, get_session
from harambeeone_api.models import (
    IdentityProviderAccount,
    PushDelivery,
    PushInstallation,
    SchoolMembership,
    SupportNotification,
    SupportNotificationOutbox,
)

router = APIRouter(prefix="/api/v1/push", tags=["push notifications"])
MAX_DELIVERY_ATTEMPTS = 5
TARGET_PATTERN = re.compile(r"^[A-Za-z0-9_:\-]{20,512}$")


class InstallationRegistration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    installation_id: str = Field(min_length=20, max_length=512)
    target_kind: str = Field(pattern="^(fid|token)$")
    device_label: str = Field(min_length=1, max_length=100)


class InstallationRevocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    installation_id: str = Field(min_length=20, max_length=512)


def _clean_target(value: str) -> str:
    value = value.strip()
    if not TARGET_PATTERN.fullmatch(value):
        raise HTTPException(status_code=422, detail="Invalid Firebase installation identifier")
    return value


def _installation_payload(item: PushInstallation) -> dict:
    return {
        "id": item.id,
        "device_label": item.device_label,
        "target_kind": item.target_kind,
        "consented_at": item.consented_at,
        "last_seen_at": item.last_seen_at,
        "active": item.revoked_at is None,
    }


@router.get("/installations")
def list_installations(
    user: AuthenticatedUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.scalars(
        select(PushInstallation)
        .where(PushInstallation.auth_user_id == user.id)
        .order_by(PushInstallation.created_at.desc())
    ).all()
    return {"items": [_installation_payload(item) for item in rows]}


@router.post("/installations", status_code=201)
def register_installation(
    payload: InstallationRegistration,
    user: AuthenticatedUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    target = _clean_target(payload.installation_id)
    now = datetime.now(UTC)
    installation = session.scalar(
        select(PushInstallation).where(PushInstallation.installation_id == target)
    )
    if installation is not None and installation.auth_user_id != user.id:
        raise HTTPException(status_code=409, detail="This browser belongs to another account")
    if installation is None:
        installation = PushInstallation(
            auth_user_id=user.id,
            installation_id=target,
            target_kind=payload.target_kind,
            device_label=payload.device_label.strip(),
            consented_at=now,
            last_seen_at=now,
        )
        session.add(installation)
    else:
        installation.target_kind = payload.target_kind
        installation.device_label = payload.device_label.strip()
        installation.last_seen_at = now
        installation.revoked_at = None
        installation.consented_at = now
    session.commit()
    session.refresh(installation)
    return _installation_payload(installation)


@router.delete("/installations/{installation_id}")
def disable_installation(
    installation_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    installation = session.scalar(
        select(PushInstallation).where(
            PushInstallation.id == installation_id,
            PushInstallation.auth_user_id == user.id,
        )
    )
    if installation is None:
        raise HTTPException(status_code=404, detail="Push installation not found")
    installation.revoked_at = datetime.now(UTC)
    session.commit()
    return {"id": installation.id, "active": False}


@router.post("/disable-all")
def disable_all_installations(
    user: AuthenticatedUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    now = datetime.now(UTC)
    rows = session.scalars(
        select(PushInstallation).where(
            PushInstallation.auth_user_id == user.id,
            PushInstallation.revoked_at.is_(None),
        )
    ).all()
    for row in rows:
        row.revoked_at = now
    session.commit()
    return {"disabled": len(rows)}


@router.post("/installations/revoke")
def revoke_current_installation(
    payload: InstallationRevocation,
    user: AuthenticatedUser = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    target = _clean_target(payload.installation_id)
    installation = session.scalar(
        select(PushInstallation).where(
            PushInstallation.installation_id == target,
            PushInstallation.auth_user_id == user.id,
        )
    )
    if installation is not None and installation.revoked_at is None:
        installation.revoked_at = datetime.now(UTC)
        session.commit()
    return {"active": False}


def _event_category(event_type: str) -> str:
    event = event_type.casefold()
    if "invited" in event or "linked" in event:
        return "invitation"
    if "consent" in event or "referral" in event:
        return "consent"
    if "changes" in event:
        return "changes_requested"
    if "published" in event:
        return "publication"
    if "pledge_created" in event:
        return "pledge"
    if "rejected" in event or "declined" in event:
        return "rejection"
    if "verified" in event or "settlement" in event:
        return "settlement"
    if "funded" in event:
        return "funded"
    if "receipt" in event:
        return "receipt"
    if "outcome" in event or "attestation" in event:
        return "outcome"
    return "update"


def safe_push_payload(notification: SupportNotification) -> dict[str, str]:
    href = notification.href if notification.href.startswith("/") else "/"
    return {
        "event": _event_category(notification.event_type),
        "href": href[:300],
        "notification_id": str(notification.id),
    }


def _recipient_user_ids(session: Session, notification: SupportNotification) -> set[uuid.UUID]:
    recipients: set[uuid.UUID] = set()
    if notification.recipient_auth_user_id:
        recipients.add(notification.recipient_auth_user_id)
    if notification.recipient_email:
        recipients.update(
            session.scalars(
                select(IdentityProviderAccount.internal_user_id).where(
                    IdentityProviderAccount.normalized_email
                    == notification.recipient_email.casefold()
                )
            ).all()
        )
    if notification.recipient_type == "school":
        recipients.update(
            session.scalars(
                select(SchoolMembership.auth_user_id).where(
                    SchoolMembership.school_id == notification.school_id
                )
            ).all()
        )
    return recipients


def _message(notification: SupportNotification, installation: PushInstallation):
    data = safe_push_payload(notification)
    options = {
        "data": data,
    }
    options[installation.target_kind] = installation.installation_id
    return messaging.Message(**options)


def _error_code(error: Exception) -> str:
    return getattr(error, "code", None) or error.__class__.__name__


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def deliver_push_batch(
    session: Session,
    *,
    limit: int = 20,
    sender: Callable[[messaging.Message], str] | None = None,
    now: datetime | None = None,
) -> dict[str, int]:
    """Deliver a bounded outbox batch; the durable in-app record remains authoritative."""
    now = now or datetime.now(UTC)
    sender = sender or (lambda message: messaging.send(message, app=firebase_auth_app()))
    outboxes = session.scalars(
        select(SupportNotificationOutbox)
        .where(
            SupportNotificationOutbox.status.in_(("ready", "failed")),
            SupportNotificationOutbox.available_at <= now,
        )
        .order_by(SupportNotificationOutbox.available_at)
        .limit(max(1, min(limit, 100)))
        .with_for_update(skip_locked=True)
    ).all()
    summary = {"outboxes": len(outboxes), "delivered": 0, "retried": 0, "invalid": 0}
    for outbox in outboxes:
        notification = session.get(SupportNotification, outbox.notification_id)
        if notification is None:
            outbox.status = "cancelled"
            outbox.last_error = "notification_missing"
            continue
        recipients = _recipient_user_ids(session, notification)
        installations = session.scalars(
            select(PushInstallation).where(
                PushInstallation.auth_user_id.in_(recipients),
                PushInstallation.revoked_at.is_(None),
            )
        ).all() if recipients else []
        if not installations:
            outbox.channel = "fcm"
            outbox.status = "delivered"
            outbox.delivered_at = now
            outbox.last_error = "no_consenting_installations"
            continue
        pending = False
        for installation in installations:
            delivery = session.scalar(
                select(PushDelivery).where(
                    PushDelivery.outbox_id == outbox.id,
                    PushDelivery.installation_id == installation.id,
                )
            )
            if delivery is None:
                delivery = PushDelivery(
                    outbox_id=outbox.id,
                    installation_id=installation.id,
                    status="pending",
                    next_attempt_at=now,
                )
                session.add(delivery)
                session.flush()
            if delivery.status in {"delivered", "invalid", "failed"}:
                continue
            if _as_utc(delivery.next_attempt_at) > now:
                pending = True
                continue
            delivery.attempt_count += 1
            outbox.attempt_count += 1
            try:
                delivery.provider_message_id = sender(_message(notification, installation))
                delivery.status = "delivered"
                delivery.delivered_at = now
                delivery.last_error_code = None
                summary["delivered"] += 1
            except (messaging.UnregisteredError, messaging.SenderIdMismatchError):
                delivery.status = "invalid"
                delivery.last_error_code = "unregistered"
                installation.revoked_at = now
                summary["invalid"] += 1
            except (firebase_exceptions.FirebaseError, OSError, ValueError) as error:
                delivery.last_error_code = _error_code(error)[:80]
                if delivery.attempt_count >= MAX_DELIVERY_ATTEMPTS:
                    delivery.status = "failed"
                else:
                    delivery.status = "retry"
                    delivery.next_attempt_at = now + timedelta(
                        minutes=min(60, 2 ** delivery.attempt_count)
                    )
                    pending = True
                    summary["retried"] += 1
        outbox.channel = "fcm"
        deliveries = session.scalars(
            select(PushDelivery).where(PushDelivery.outbox_id == outbox.id)
        ).all()
        if pending:
            retry_times = [
                item.next_attempt_at
                for item in session.scalars(
                    select(PushDelivery).where(
                        PushDelivery.outbox_id == outbox.id,
                        PushDelivery.status == "retry",
                    )
                ).all()
            ]
            outbox.status = "failed"
            outbox.available_at = min(retry_times) if retry_times else now + timedelta(minutes=2)
            outbox.last_error = "temporary_fcm_failure"
        elif any(item.status == "delivered" for item in deliveries):
            outbox.status = "delivered"
            outbox.delivered_at = now
            outbox.last_error = None
        else:
            outbox.status = "cancelled"
            outbox.last_error = "no_deliverable_installations"
    session.commit()
    return summary


def run_push_delivery_once(limit: int = 20) -> dict[str, int]:
    session_iterator = get_server_session()
    session = next(session_iterator)
    try:
        return deliver_push_batch(session, limit=limit)
    finally:
        session_iterator.close()
