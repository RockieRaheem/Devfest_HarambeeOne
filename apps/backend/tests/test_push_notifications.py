import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from firebase_admin import exceptions as firebase_exceptions
from firebase_admin import messaging
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from harambeeone_api.auth import AuthenticatedUser, get_current_user
from harambeeone_api.database import Base, get_session
from harambeeone_api.main import app
from harambeeone_api.models import (
    PushDelivery,
    PushInstallation,
    School,
    SchoolMembership,
    SupportNotificationOutbox,
)
from harambeeone_api.push_notifications import (
    _event_category,
    deliver_push_batch,
    safe_push_payload,
)
from harambeeone_api.support_notifications import emit_support_notification


@pytest.fixture
def push_workspace():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    users = {"first": uuid.uuid4(), "second": uuid.uuid4()}
    with Session(engine) as session:
        school = School(name="Push Test School")
        session.add(school)
        session.flush()
        session.add(
            SchoolMembership(
                school_id=school.id,
                auth_user_id=users["first"],
                role="owner",
            )
        )
        session.commit()
        school_id = school.id

    current = {"id": users["first"]}

    def override_session():
        with Session(engine, expire_on_commit=False) as session:
            yield session

    def override_user():
        return AuthenticatedUser(
            id=current["id"], email=f"{current['id']}@example.test"
        )

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user] = override_user
    try:
        yield engine, users, current, school_id, TestClient(app)
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)


def _registration(fid: str, label: str = "Chrome on laptop") -> dict:
    return {"installation_id": fid, "target_kind": "fid", "device_label": label}


@pytest.mark.parametrize(
    ("event_type", "category"),
    [
        ("guardian_invited", "invitation"),
        ("consent_granted", "consent"),
        ("case_changes_requested", "changes_requested"),
        ("case_published", "publication"),
        ("pledge_created", "pledge"),
        ("pledge_verified", "settlement"),
        ("pledge_rejected", "rejection"),
        ("case_funded", "funded"),
        ("receipt_issued", "receipt"),
        ("outcome_approved", "outcome"),
    ],
)
def test_required_events_have_generic_push_categories(event_type, category):
    assert _event_category(event_type) == category


def test_push_registration_is_explicit_owned_and_revocable(push_workspace):
    _engine, users, current, _school_id, client = push_workspace
    fid = "fid_first_browser_1234567890"
    created = client.post("/api/v1/push/installations", json=_registration(fid))
    assert created.status_code == 201
    assert created.json()["active"] is True

    current["id"] = users["second"]
    conflict = client.post("/api/v1/push/installations", json=_registration(fid))
    assert conflict.status_code == 409
    assert client.get("/api/v1/push/installations").json()["items"] == []

    current["id"] = users["first"]
    disabled = client.post(
        "/api/v1/push/installations/revoke", json={"installation_id": fid}
    )
    assert disabled.status_code == 200
    assert client.get("/api/v1/push/installations").json()["items"][0]["active"] is False


def test_delivery_targets_only_recipient_and_sends_generic_payload(push_workspace):
    engine, users, _current, school_id, client = push_workspace
    first_fid = "fid_owner_browser_12345678901"
    second_fid = "fid_other_browser_12345678901"
    assert (
        client.post("/api/v1/push/installations", json=_registration(first_fid)).status_code
        == 201
    )
    with Session(engine) as session:
        session.add(
            PushInstallation(
                auth_user_id=users["second"],
                installation_id=second_fid,
                target_kind="fid",
                device_label="Other browser",
                consented_at=datetime.now(UTC),
                last_seen_at=datetime.now(UTC),
            )
        )
        notification = emit_support_notification(
            session,
            school_id=school_id,
            recipient_type="guardian",
            recipient_auth_user_id=users["first"],
            event_type="pledge_verified",
            title="Amina received UGX 500,000",
            body="Receipt RCPT-123 and payment MM-PRIVATE were verified.",
            href="/donor/receipts/private-id",
            related_type="support_case",
            related_id=uuid.uuid4(),
            dedup_key="push:test:private",
        )
        session.commit()
        sent: list[messaging.Message] = []
        result = deliver_push_batch(
            session,
            sender=lambda message: sent.append(message) or "provider-message-1",
        )
        assert result["delivered"] == 1
        assert len(sent) == 1 and sent[0].fid == first_fid
        assert sent[0].notification is None and sent[0].webpush is None
        encoded = json.dumps(sent[0].data)
        assert sent[0].data["event"] == "settlement"
        for private_value in ("Amina", "500,000", "RCPT-123", "MM-PRIVATE"):
            assert private_value not in encoded
        assert set(safe_push_payload(notification)) == {
            "event",
            "href",
            "notification_id",
        }
        outbox = session.scalar(select(SupportNotificationOutbox))
        assert "recipient" not in outbox.payload_json
        assert session.scalar(select(func.count(PushDelivery.id))) == 1


def test_retry_is_idempotent_and_does_not_duplicate_outbox(push_workspace):
    engine, users, _current, school_id, client = push_workspace
    fid = "fid_retry_browser_123456789012"
    assert client.post("/api/v1/push/installations", json=_registration(fid)).status_code == 201
    start = datetime.now(UTC)
    with Session(engine) as session:
        emit_support_notification(
            session,
            school_id=school_id,
            recipient_type="guardian",
            recipient_auth_user_id=users["first"],
            event_type="case_changes_requested",
            title="Changes requested",
            body="Open the secure workspace.",
            href="/guardian",
            related_type="support_case",
            related_id=uuid.uuid4(),
            dedup_key="push:test:retry",
        )
        session.commit()

        def unavailable(_message):
            raise firebase_exceptions.UnavailableError("FCM temporarily unavailable")

        first = deliver_push_batch(session, sender=unavailable, now=start)
        assert first["retried"] == 1
        assert session.scalar(select(func.count(PushDelivery.id))) == 1
        second = deliver_push_batch(
            session,
            sender=lambda _message: "provider-message-2",
            now=start + timedelta(minutes=3),
        )
        assert second["delivered"] == 1
        assert session.scalar(select(func.count(PushDelivery.id))) == 1
        delivery = session.scalar(select(PushDelivery))
        assert delivery.status == "delivered" and delivery.attempt_count == 2
        assert session.scalar(select(func.count(SupportNotificationOutbox.id))) == 1


def test_unregistered_installation_is_revoked(push_workspace):
    engine, users, _current, school_id, client = push_workspace
    fid = "fid_invalid_browser_1234567890"
    assert client.post("/api/v1/push/installations", json=_registration(fid)).status_code == 201
    with Session(engine) as session:
        emit_support_notification(
            session,
            school_id=school_id,
            recipient_type="guardian",
            recipient_auth_user_id=users["first"],
            event_type="outcome_approved",
            title="Outcome ready",
            body="A secure outcome is available.",
            href="/guardian",
            related_type="support_case",
            related_id=uuid.uuid4(),
            dedup_key="push:test:invalid",
        )
        session.commit()

        def unregistered(_message):
            raise messaging.UnregisteredError("Installation no longer exists")

        result = deliver_push_batch(session, sender=unregistered)
        assert result["invalid"] == 1
        installation = session.scalar(select(PushInstallation))
        assert installation.revoked_at is not None
        assert session.scalar(select(PushDelivery)).status == "invalid"
