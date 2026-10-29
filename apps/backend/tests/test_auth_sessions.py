import time

from fastapi.testclient import TestClient

from harambeeone_api import auth_sessions
from harambeeone_api.main import app

client = TestClient(app)


def test_exchanges_recent_verified_id_token(monkeypatch):
    monkeypatch.setattr(auth_sessions, 'firebase_auth_app', lambda: object())
    monkeypatch.setattr(
        auth_sessions.firebase_auth,
        'verify_id_token',
        lambda *_args, **_kwargs: {
            'auth_time': int(time.time()),
            'email': 'owner@example.test',
            'email_verified': True,
            'name': 'School Owner',
        },
    )
    monkeypatch.setattr(
        auth_sessions.firebase_auth,
        'create_session_cookie',
        lambda *_args, **_kwargs: 'signed-session',
    )

    response = client.post('/api/v1/auth/sessions', json={'id_token': 'valid-id-token'})

    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    assert response.json() == {
        'session_cookie': 'signed-session',
        'email': 'owner@example.test',
        'display_name': 'School Owner',
    }


def test_rejects_stale_or_unverified_sign_in(monkeypatch):
    monkeypatch.setattr(auth_sessions, 'firebase_auth_app', lambda: object())
    monkeypatch.setattr(
        auth_sessions.firebase_auth,
        'verify_id_token',
        lambda *_args, **_kwargs: {
            'auth_time': int(time.time()) - 301,
            'email': 'owner@example.test',
            'email_verified': True,
        },
    )
    stale = client.post('/api/v1/auth/sessions', json={'id_token': 'stale-token'})
    assert stale.status_code == 401

    monkeypatch.setattr(
        auth_sessions.firebase_auth,
        'verify_id_token',
        lambda *_args, **_kwargs: {
            'auth_time': int(time.time()),
            'email': 'owner@example.test',
            'email_verified': False,
        },
    )
    unverified = client.post('/api/v1/auth/sessions', json={'id_token': 'unverified-token'})
    assert unverified.status_code == 403


def test_verifies_and_revokes_session_without_database(monkeypatch):
    revoked = []
    monkeypatch.setattr(auth_sessions, 'firebase_auth_app', lambda: object())
    monkeypatch.setattr(
        auth_sessions.firebase_auth,
        'verify_session_cookie',
        lambda *_args, **_kwargs: {
            'sub': 'firebase-user',
            'email': 'owner@example.test',
            'name': 'School Owner',
        },
    )
    monkeypatch.setattr(
        auth_sessions.firebase_auth,
        'revoke_refresh_tokens',
        lambda uid, **_kwargs: revoked.append(uid),
    )

    verified = client.post(
        '/api/v1/auth/sessions/verify', json={'session_cookie': 'signed-session'}
    )
    revoked_response = client.post(
        '/api/v1/auth/sessions/revoke', json={'session_cookie': 'signed-session'}
    )

    assert verified.status_code == 200
    assert verified.json()['email'] == 'owner@example.test'
    assert revoked_response.json() == {'revoked': True}
    assert revoked == ['firebase-user']


def test_returns_stable_error_when_firebase_is_unavailable(monkeypatch):
    monkeypatch.setattr(auth_sessions, 'firebase_auth_app', lambda: object())
    monkeypatch.setattr(
        auth_sessions.firebase_auth,
        'verify_id_token',
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            auth_sessions.firebase_exceptions.UnavailableError('unavailable')
        ),
    )

    response = client.post('/api/v1/auth/sessions', json={'id_token': 'valid-shape'})

    assert response.status_code == 503
    assert response.json() == {
        'detail': 'Secure sign-in verification is temporarily unavailable.'
    }
