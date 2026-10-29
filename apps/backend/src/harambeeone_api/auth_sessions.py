'''Exchange Firebase browser credentials for revocation-aware server sessions.'''

import time
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from firebase_admin import auth as firebase_auth
from firebase_admin import exceptions as firebase_exceptions
from pydantic import BaseModel, ConfigDict, Field

from harambeeone_api.auth import firebase_auth_app

router = APIRouter(prefix='/api/v1/auth/sessions', tags=['authentication'])
SESSION_LIFETIME = timedelta(days=5)
RECENT_LOGIN_SECONDS = 5 * 60


class IdTokenExchange(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id_token: str = Field(min_length=1, max_length=8192)


class SessionCredential(BaseModel):
    model_config = ConfigDict(extra='forbid')
    session_cookie: str = Field(min_length=1, max_length=8192)


def _identity(claims: dict[str, Any]) -> dict[str, str | None]:
    email = claims.get('email')
    name = claims.get('name')
    return {
        'email': email if isinstance(email, str) else None,
        'display_name': name if isinstance(name, str) else None,
    }


def _firebase_error(error: Exception) -> HTTPException:
    invalid_errors = (
        firebase_auth.ExpiredIdTokenError,
        firebase_auth.ExpiredSessionCookieError,
        firebase_auth.RevokedIdTokenError,
        firebase_auth.RevokedSessionCookieError,
        firebase_auth.UserDisabledError,
        firebase_auth.InvalidIdTokenError,
        firebase_auth.InvalidSessionCookieError,
        ValueError,
        TypeError,
    )
    if isinstance(error, invalid_errors):
        return HTTPException(401, 'Sign-in could not be verified.')
    unavailable_errors = (
        firebase_auth.CertificateFetchError,
        firebase_exceptions.UnavailableError,
    )
    if isinstance(error, unavailable_errors):
        return HTTPException(503, 'Secure sign-in verification is temporarily unavailable.')
    return HTTPException(503, 'Secure sign-in verification is temporarily unavailable.')


@router.post('')
def create_session(payload: IdTokenExchange, response: Response) -> dict[str, str | None]:
    response.headers['Cache-Control'] = 'no-store'
    try:
        app = firebase_auth_app()
        claims = firebase_auth.verify_id_token(payload.id_token, check_revoked=True, app=app)
        auth_time = claims.get('auth_time')
        login_is_stale = (
            isinstance(auth_time, int | float)
            and time.time() - auth_time > RECENT_LOGIN_SECONDS
        )
        if not isinstance(auth_time, int | float) or login_is_stale:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Sign in again to create a secure session.',
            )
        if not isinstance(claims.get('email'), str) or claims.get('email_verified') is not True:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Verify your email address before signing in.',
            )
        cookie = firebase_auth.create_session_cookie(
            payload.id_token,
            expires_in=SESSION_LIFETIME,
            app=app,
        )
        return {'session_cookie': cookie, **_identity(claims)}
    except HTTPException:
        raise
    except Exception as error:
        raise _firebase_error(error) from error


@router.post('/verify')
def verify_session(payload: SessionCredential, response: Response) -> dict[str, str | None]:
    response.headers['Cache-Control'] = 'no-store'
    try:
        claims = firebase_auth.verify_session_cookie(
            payload.session_cookie,
            check_revoked=True,
            app=firebase_auth_app(),
        )
        return _identity(claims)
    except Exception as error:
        raise _firebase_error(error) from error


@router.post('/revoke')
def revoke_session(payload: SessionCredential, response: Response) -> dict[str, bool]:
    response.headers['Cache-Control'] = 'no-store'
    try:
        app = firebase_auth_app()
        claims = firebase_auth.verify_session_cookie(
            payload.session_cookie,
            check_revoked=True,
            app=app,
        )
        subject = claims.get('sub') or claims.get('uid')
        if not isinstance(subject, str) or not subject:
            raise ValueError('Firebase session has no subject')
        firebase_auth.revoke_refresh_tokens(subject, app=app)
        return {'revoked': True}
    except Exception as error:
        raise _firebase_error(error) from error
