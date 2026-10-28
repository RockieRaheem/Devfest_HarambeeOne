import os
import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Literal, Protocol, cast

import jwt
from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as firebase_auth
from firebase_admin import exceptions as firebase_exceptions
from firebase_admin import get_app, initialize_app
from jwt import PyJWKClient
from jwt.exceptions import (
    ExpiredSignatureError,
    ImmatureSignatureError,
    InvalidTokenError,
    PyJWKClientConnectionError,
    PyJWKClientError,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from harambeeone_api.config import get_settings
from harambeeone_api.database import get_session, set_database_identity
from harambeeone_api.models import IdentityProviderAccount, SchoolMembership

Role = Literal["owner", "bursar", "cashier", "auditor"]
Permission = Literal[
    "school:read",
    "school:manage",
    "periods:read",
    "periods:manage",
    "periods:reopen",
    "students:read",
    "students:write",
    "fees:read",
    "fees:write",
    "payments:read",
    "payments:write",
    "reconciliation:read",
    "reconciliation:write",
    "reports:read",
    "audit:read",
    "sponsors:read",
    "sponsors:write",
    "support:read",
    "support:write",
    "support:settle",
    "support:approve",
    "integrations:read",
    "integrations:manage",
]

ALL_PERMISSIONS: frozenset[Permission] = frozenset(
    {
        "school:read",
        "school:manage",
        "periods:read",
        "periods:manage",
        "periods:reopen",
        "students:read",
        "students:write",
        "fees:read",
        "fees:write",
        "payments:read",
        "payments:write",
        "reconciliation:read",
        "reconciliation:write",
        "reports:read",
        "audit:read",
        "sponsors:read",
        "sponsors:write",
        "support:read",
        "support:write",
        "support:settle",
        "support:approve",
        "integrations:read",
        "integrations:manage",
    }
)
ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    "owner": ALL_PERMISSIONS,
    "bursar": ALL_PERMISSIONS
    - {"sponsors:write", "periods:reopen", "support:approve", "integrations:manage"},
    "cashier": frozenset(
        {
            "school:read",
            "periods:read",
            "students:read",
            "fees:read",
            "payments:read",
            "payments:write",
            "support:read",
            "support:settle",
        }
    ),
    "auditor": frozenset(
        {
            "school:read",
            "periods:read",
            "students:read",
            "fees:read",
            "payments:read",
            "reconciliation:read",
            "reports:read",
            "audit:read",
            "sponsors:read",
            "support:read",
            "integrations:read",
        }
    ),
}
ROLE_ALIASES = {"owner_bursar": "owner"}


@dataclass(frozen=True)
class AuthenticatedUser:
    id: uuid.UUID
    email: str | None
    provider: str = "test"
    provider_subject: str | None = None


@dataclass(frozen=True)
class ExternalIdentity:
    provider: Literal["firebase", "supabase"]
    subject: str
    email: str | None
    email_verified: bool


class IdentityTokenError(Exception):
    """A token is invalid and must not establish an application identity."""


class IdentityTokenExpired(IdentityTokenError):
    pass


class IdentityTokenRevoked(IdentityTokenError):
    pass


class IdentityUserDisabled(IdentityTokenError):
    pass


class IdentityProviderUnavailable(Exception):
    pass


class IdentityVerifier(Protocol):
    def verify(self, token: str) -> ExternalIdentity: ...


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    supabase_url = get_settings().supabase_url
    if not supabase_url:
        raise IdentityProviderUnavailable("Supabase rollback authentication is not configured")
    issuer = f"{str(supabase_url).rstrip('/')}/auth/v1"
    return PyJWKClient(
        f"{issuer}/.well-known/jwks.json",
        cache_jwk_set=True,
        lifespan=600,
        timeout=5,
    )


@lru_cache(maxsize=1)
def _firebase_app():
    settings = get_settings()
    if settings.firebase_auth_emulator_host:
        os.environ.setdefault(
            "FIREBASE_AUTH_EMULATOR_HOST", settings.firebase_auth_emulator_host
        )
    try:
        return get_app("harambeeone-auth")
    except ValueError:
        return initialize_app(
            options={"projectId": settings.firebase_project_id},
            name="harambeeone-auth",
        )


class FirebaseSessionVerifier:
    def verify(self, token: str) -> ExternalIdentity:
        try:
            claims = firebase_auth.verify_session_cookie(
                token,
                check_revoked=True,
                app=_firebase_app(),
            )
            subject = claims.get("sub") or claims.get("uid")
            if not isinstance(subject, str) or not subject:
                raise IdentityTokenError("Firebase session has no subject")
            email = claims.get("email")
            return ExternalIdentity(
                provider="firebase",
                subject=subject,
                email=email if isinstance(email, str) else None,
                email_verified=claims.get("email_verified") is True,
            )
        except firebase_auth.ExpiredSessionCookieError as error:
            raise IdentityTokenExpired from error
        except firebase_auth.RevokedSessionCookieError as error:
            raise IdentityTokenRevoked from error
        except firebase_auth.UserDisabledError as error:
            raise IdentityUserDisabled from error
        except (firebase_auth.CertificateFetchError, firebase_exceptions.UnavailableError) as error:
            raise IdentityProviderUnavailable from error
        except IdentityTokenError:
            raise
        except (firebase_auth.InvalidSessionCookieError, ValueError, TypeError) as error:
            raise IdentityTokenError from error


class SupabaseAccessTokenVerifier:
    """Temporary non-production rollback boundary until the final cutover."""

    def verify(self, token: str) -> ExternalIdentity:
        supabase_url = get_settings().supabase_url
        if not supabase_url:
            raise IdentityProviderUnavailable("Supabase rollback authentication is not configured")
        issuer = f"{str(supabase_url).rstrip('/')}/auth/v1"
        try:
            signing_key = _jwks_client().get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
                issuer=issuer,
                options={"require": ["exp", "iat", "sub", "iss", "aud"]},
            )
            subject = str(uuid.UUID(claims["sub"]))
            email = claims.get("email")
            return ExternalIdentity(
                provider="supabase",
                subject=subject,
                email=email if isinstance(email, str) else None,
                email_verified=True,
            )
        except ExpiredSignatureError as error:
            raise IdentityTokenExpired from error
        except ImmatureSignatureError as error:
            raise IdentityTokenError from error
        except PyJWKClientConnectionError as error:
            raise IdentityProviderUnavailable from error
        except (InvalidTokenError, PyJWKClientError, KeyError, TypeError, ValueError) as error:
            raise IdentityTokenError from error


@lru_cache(maxsize=1)
def _identity_verifier() -> IdentityVerifier:
    if get_settings().auth_provider == "supabase":
        return SupabaseAccessTokenVerifier()
    return FirebaseSessionVerifier()


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _resolve_internal_user(session: Session, identity: ExternalIdentity) -> AuthenticatedUser:
    account = session.scalar(
        select(IdentityProviderAccount).where(
            IdentityProviderAccount.provider == identity.provider,
            IdentityProviderAccount.provider_subject == identity.subject,
        )
    )
    if account is None:
        internal_user_id = (
            uuid.UUID(identity.subject) if identity.provider == "supabase" else uuid.uuid4()
        )
        account = IdentityProviderAccount(
            provider=identity.provider,
            provider_subject=identity.subject,
            internal_user_id=internal_user_id,
            normalized_email=identity.email.strip().casefold() if identity.email else None,
            email_verified=identity.email_verified,
        )
        session.add(account)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            account = session.scalar(
                select(IdentityProviderAccount).where(
                    IdentityProviderAccount.provider == identity.provider,
                    IdentityProviderAccount.provider_subject == identity.subject,
                )
            )
            if account is None:
                raise
    return AuthenticatedUser(
        id=account.internal_user_id,
        email=identity.email,
        provider=identity.provider,
        provider_subject=identity.subject,
    )


def get_current_user(
    session: Annotated[Session, Depends(get_session)],
    authorization: str | None = Header(default=None),
) -> AuthenticatedUser:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.casefold() != "bearer" or not token.strip():
        raise _unauthorized("Sign in required")
    token = token.strip()
    try:
        user = _resolve_internal_user(session, _identity_verifier().verify(token))
        set_database_identity(session, user.id)
        return user
    except IdentityTokenExpired as error:
        raise _unauthorized("Your session has expired. Please sign in again.") from error
    except IdentityTokenRevoked as error:
        raise _unauthorized("Your session was revoked. Please sign in again.") from error
    except IdentityUserDisabled as error:
        raise _unauthorized("This account is disabled. Contact your administrator.") from error
    except IdentityProviderUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Secure sign-in verification is temporarily unavailable. Please try again.",
        ) from error
    except IdentityTokenError as error:
        raise _unauthorized("We could not verify your session. Please sign in again.") from error


@dataclass(frozen=True)
class SchoolContext:
    user: AuthenticatedUser
    school_id: uuid.UUID
    role: Role

    @property
    def actor(self) -> str:
        return self.user.email or str(self.user.id)

    def assert_school(self, requested_school_id: uuid.UUID) -> None:
        if requested_school_id != self.school_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this institution",
            )


def get_school_context(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
    active_school_id: Annotated[uuid.UUID | None, Header(alias="X-School-ID")] = None,
) -> SchoolContext:
    membership_query = select(SchoolMembership).where(SchoolMembership.auth_user_id == user.id)
    if active_school_id is not None:
        membership_query = membership_query.where(SchoolMembership.school_id == active_school_id)
    membership = session.scalar(
        membership_query.order_by(SchoolMembership.created_at, SchoolMembership.id)
    )
    if membership is None:
        if active_school_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to the selected school section",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Complete institution setup before using the bursar workspace",
        )
    role_name = ROLE_ALIASES.get(membership.role, membership.role)
    if role_name not in ROLE_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your institution role is not recognized",
        )
    return SchoolContext(user=user, school_id=membership.school_id, role=cast(Role, role_name))


def require_permission(permission: Permission):
    def authorize(
        context: Annotated[SchoolContext, Depends(get_school_context)],
    ) -> SchoolContext:
        if permission not in ROLE_PERMISSIONS[context.role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your institution role does not permit this action",
            )
        return context

    return authorize
