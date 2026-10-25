import json
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from firebase_admin import auth as firebase_auth
from sqlalchemy import select
from sqlalchemy.orm import Session

from harambeeone_api.models import IdentityProviderAccount

_BCRYPT_HASH = re.compile(r"\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}")


@dataclass(frozen=True)
class MigrationUser:
    internal_user_id: uuid.UUID
    firebase_uid: str
    email: str
    email_verified: bool
    display_name: str | None
    password_hash: bytes | None
    provider_data: tuple[firebase_auth.UserProvider, ...]

    @property
    def requires_password_reset(self) -> bool:
        return self.password_hash is None and not self.provider_data

    def to_import_record(self) -> firebase_auth.ImportUserRecord:
        return firebase_auth.ImportUserRecord(
            uid=self.firebase_uid,
            email=self.email,
            email_verified=self.email_verified,
            display_name=self.display_name,
            password_hash=self.password_hash,
            provider_data=list(self.provider_data) or None,
        )


def _normalized_email(value: Any) -> str:
    if not isinstance(value, str) or "@" not in value:
        raise ValueError("Every exported user must have a valid email address")
    return value.strip().casefold()


def _provider_data(row: dict[str, Any], email: str) -> tuple[firebase_auth.UserProvider, ...]:
    providers: list[firebase_auth.UserProvider] = []
    for identity in row.get("identities") or []:
        if not isinstance(identity, dict) or identity.get("provider") != "google":
            continue
        provider_uid = identity.get("id")
        if not isinstance(provider_uid, str) or not provider_uid:
            raise ValueError("Google identity is missing its provider subject")
        data = (
            identity.get("identity_data")
            if isinstance(identity.get("identity_data"), dict)
            else {}
        )
        providers.append(
            firebase_auth.UserProvider(
                uid=provider_uid,
                provider_id="google.com",
                email=email,
                display_name=data.get("full_name") or data.get("name"),
                photo_url=data.get("avatar_url"),
            )
        )
    return tuple(providers)


def parse_export(path: Path) -> list[MigrationUser]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("users") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError("Expected a JSON array or an object containing a users array")

    users: list[MigrationUser] = []
    seen_ids: set[uuid.UUID] = set()
    seen_emails: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Every exported user must be a JSON object")
        internal_user_id = uuid.UUID(str(row.get("id")))
        email = _normalized_email(row.get("email"))
        if internal_user_id in seen_ids or email in seen_emails:
            raise ValueError("The export contains a duplicate user ID or normalized email")
        seen_ids.add(internal_user_id)
        seen_emails.add(email)
        metadata = row.get("raw_user_meta_data")
        display_name = None
        if isinstance(metadata, dict):
            candidate = metadata.get("full_name") or metadata.get("name")
            display_name = (
                candidate.strip()
                if isinstance(candidate, str) and candidate.strip()
                else None
            )
        encrypted_password = row.get("encrypted_password")
        password_hash = (
            encrypted_password.encode("utf-8")
            if isinstance(encrypted_password, str)
            and _BCRYPT_HASH.fullmatch(encrypted_password)
            else None
        )
        users.append(
            MigrationUser(
                internal_user_id=internal_user_id,
                firebase_uid=str(internal_user_id),
                email=email,
                email_verified=bool(row.get("email_confirmed_at")),
                display_name=display_name,
                password_hash=password_hash,
                provider_data=_provider_data(row, email),
            )
        )
    return users


def store_identity_mapping(session: Session, user: MigrationUser) -> None:
    now = datetime.now(UTC)
    for provider, subject in (
        ("supabase", str(user.internal_user_id)),
        ("firebase", user.firebase_uid),
    ):
        existing = session.scalar(
            select(IdentityProviderAccount).where(
                IdentityProviderAccount.provider == provider,
                IdentityProviderAccount.provider_subject == subject,
            )
        )
        if existing:
            if existing.internal_user_id != user.internal_user_id:
                raise ValueError("Identity subject is already linked to another internal user")
            continue
        conflicting = session.scalar(
            select(IdentityProviderAccount).where(
                IdentityProviderAccount.provider == provider,
                IdentityProviderAccount.internal_user_id == user.internal_user_id,
            )
        )
        if conflicting:
            raise ValueError("Internal user is already linked to another provider subject")
        session.add(
            IdentityProviderAccount(
                provider=provider,
                provider_subject=subject,
                internal_user_id=user.internal_user_id,
                normalized_email=user.email,
                email_verified=user.email_verified,
                migrated_at=now,
            )
        )


def migrate_users(users: list[MigrationUser], session: Session) -> dict[str, int]:
    existing_count = 0
    imported_count = 0
    reset_count = sum(user.requires_password_reset for user in users)
    pending: list[MigrationUser] = []

    for user in users:
        try:
            existing = firebase_auth.get_user(user.firebase_uid)
        except firebase_auth.UserNotFoundError:
            try:
                firebase_auth.get_user_by_email(user.email)
            except firebase_auth.UserNotFoundError:
                pending.append(user)
            else:
                raise ValueError(
                    "A Firebase account already uses an exported email with another UID"
                ) from None
        else:
            if existing.email and existing.email.casefold() != user.email:
                raise ValueError("Existing Firebase UID has a different email address")
            existing_count += 1
            store_identity_mapping(session, user)

    for offset in range(0, len(pending), 1000):
        batch = pending[offset : offset + 1000]
        result = firebase_auth.import_users(
            [user.to_import_record() for user in batch],
            hash_alg=firebase_auth.UserImportHash.bcrypt(),
        )
        if result.failure_count:
            raise RuntimeError(
                f"Firebase rejected {result.failure_count} user records; "
                "no identity mappings were committed"
            )
        imported_count += result.success_count
        for user in batch:
            store_identity_mapping(session, user)

    session.commit()
    return {
        "validated": len(users),
        "imported": imported_count,
        "existing": existing_count,
        "password_reset_required": reset_count,
    }
