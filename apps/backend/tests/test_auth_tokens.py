import time
import uuid
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from harambeeone_api import auth
from harambeeone_api.database import Base
from harambeeone_api.models import IdentityProviderAccount

ISSUER = "https://project.supabase.co/auth/v1"


def _token(
    private_key,
    user_id: uuid.UUID,
    *,
    expires_at: float,
    issuer: str = ISSUER,
) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "aud": "authenticated",
            "email": "bursar@example.test",
            "exp": int(expires_at),
            "iat": now,
            "iss": issuer,
            "sub": str(user_id),
        },
        private_key,
        algorithm="ES256",
        headers={"kid": "test-key"},
    )


def _configure_supabase(monkeypatch, public_key):
    monkeypatch.setattr(
        auth,
        "get_settings",
        lambda: SimpleNamespace(supabase_url="https://project.supabase.co"),
    )
    monkeypatch.setattr(
        auth,
        "_jwks_client",
        lambda: SimpleNamespace(
            get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=public_key)
        ),
    )


def _session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_verifies_supabase_es256_access_token_during_rollback_boundary(monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())
    _configure_supabase(monkeypatch, private_key.public_key())
    user_id = uuid.uuid4()

    identity = auth.SupabaseAccessTokenVerifier().verify(
        _token(private_key, user_id, expires_at=time.time() + 300)
    )

    assert identity.subject == str(user_id)
    assert identity.email == "bursar@example.test"


def test_reports_expired_session_clearly(monkeypatch):
    monkeypatch.setattr(
        auth,
        "_identity_verifier",
        lambda: SimpleNamespace(
            verify=lambda _token: (_ for _ in ()).throw(auth.IdentityTokenExpired())
        ),
    )

    with _session() as session, pytest.raises(HTTPException) as caught:
        auth.get_current_user(session, "Bearer expired")

    assert caught.value.status_code == 401
    assert caught.value.detail == "Your session has expired. Please sign in again."


@pytest.mark.parametrize(
    ("error", "detail"),
    [
        (auth.IdentityTokenRevoked(), "Your session was revoked. Please sign in again."),
        (
            auth.IdentityUserDisabled(),
            "This account is disabled. Contact your administrator.",
        ),
    ],
)
def test_rejects_revoked_or_disabled_firebase_session(monkeypatch, error, detail):
    monkeypatch.setattr(
        auth,
        "_identity_verifier",
        lambda: SimpleNamespace(verify=lambda _token: (_ for _ in ()).throw(error)),
    )

    with _session() as session, pytest.raises(HTTPException) as caught:
        auth.get_current_user(session, "Bearer rejected")

    assert caught.value.status_code == 401
    assert caught.value.detail == detail


def test_rejects_token_from_another_supabase_issuer(monkeypatch):
    private_key = ec.generate_private_key(ec.SECP256R1())
    _configure_supabase(monkeypatch, private_key.public_key())

    with pytest.raises(auth.IdentityTokenError):
        auth.SupabaseAccessTokenVerifier().verify(
            _token(
                private_key,
                uuid.uuid4(),
                expires_at=time.time() + 300,
                issuer="https://attacker.example/auth/v1",
            )
        )


def test_firebase_subject_maps_to_stable_internal_uuid_without_email_linking(monkeypatch):
    identity = auth.ExternalIdentity(
        provider="firebase",
        subject="firebase-uid-1",
        email="Owner@Example.Test",
        email_verified=True,
    )
    monkeypatch.setattr(
        auth,
        "_identity_verifier",
        lambda: SimpleNamespace(verify=lambda _token: identity),
    )

    with _session() as session:
        first = auth.get_current_user(session, "Bearer valid")
        second = auth.get_current_user(session, "Bearer valid")
        account = session.scalar(select(IdentityProviderAccount))

        assert first.id == second.id == account.internal_user_id
        assert account.normalized_email == "owner@example.test"
        assert first.provider_subject == "firebase-uid-1"


def test_supabase_compatibility_preserves_historical_user_uuid(monkeypatch):
    historical_id = uuid.uuid4()
    identity = auth.ExternalIdentity(
        provider="supabase",
        subject=str(historical_id),
        email="owner@example.test",
        email_verified=True,
    )
    monkeypatch.setattr(
        auth,
        "_identity_verifier",
        lambda: SimpleNamespace(verify=lambda _token: identity),
    )

    with _session() as session:
        user = auth.get_current_user(session, "Bearer valid")
        assert user.id == historical_id
