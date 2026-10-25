import json
import uuid

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from harambeeone_api.database import Base
from harambeeone_api.identity_migration import parse_export, store_identity_mapping
from harambeeone_api.models import IdentityProviderAccount


def test_parses_bcrypt_and_google_identity_without_exposing_hash(tmp_path):
    user_id = uuid.uuid4()
    source = tmp_path / "users.json"
    source.write_text(
        json.dumps(
            {
                "users": [
                    {
                        "id": str(user_id),
                        "email": " Owner@Example.Test ",
                        "encrypted_password": (
                            "$2a$10$abcdefghijklmnopqrstuv"
                            "0123456789012345678901234567890"
                        ),
                        "email_confirmed_at": "2026-10-01T00:00:00Z",
                        "raw_user_meta_data": {"full_name": "School Owner"},
                        "identities": [
                            {
                                "provider": "google",
                                "id": "google-subject",
                                "identity_data": {"name": "School Owner"},
                            }
                        ],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    user = parse_export(source)[0]

    assert user.internal_user_id == user_id
    assert user.firebase_uid == str(user_id)
    assert user.email == "owner@example.test"
    assert user.password_hash and user.password_hash.startswith(b"$2a$")
    assert user.provider_data[0].provider_id == "google.com"
    assert not user.requires_password_reset


def test_invalid_password_hash_requires_controlled_reset(tmp_path):
    source = tmp_path / "users.json"
    source.write_text(
        json.dumps(
            [
                {
                    "id": str(uuid.uuid4()),
                    "email": "owner@example.test",
                    "encrypted_password": "$2a$10$truncated",
                }
            ]
        ),
        encoding="utf-8",
    )

    user = parse_export(source)[0]

    assert user.password_hash is None
    assert user.requires_password_reset


def test_rejects_duplicate_normalized_email(tmp_path):
    source = tmp_path / "users.json"
    source.write_text(
        json.dumps(
            [
                {"id": str(uuid.uuid4()), "email": "owner@example.test"},
                {"id": str(uuid.uuid4()), "email": "OWNER@example.test"},
            ]
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="duplicate"):
        parse_export(source)


def test_mapping_is_idempotent_and_preserves_internal_uuid(tmp_path):
    user_id = uuid.uuid4()
    source = tmp_path / "users.json"
    source.write_text(
        json.dumps([{"id": str(user_id), "email": "owner@example.test"}]),
        encoding="utf-8",
    )
    user = parse_export(source)[0]
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        store_identity_mapping(session, user)
        session.commit()
        store_identity_mapping(session, user)
        session.commit()
        rows = session.scalars(select(IdentityProviderAccount)).all()

    assert len(rows) == 2
    assert {row.provider for row in rows} == {"firebase", "supabase"}
    assert {row.internal_user_id for row in rows} == {user_id}
