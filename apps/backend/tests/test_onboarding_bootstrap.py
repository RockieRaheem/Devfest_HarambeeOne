import uuid

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from harambeeone_api.auth import AuthenticatedUser, get_current_user
from harambeeone_api.database import Base, get_server_session
from harambeeone_api.main import app
from harambeeone_api.models import AuditEvent, School, SchoolMembership, SchoolOrganization


def test_authenticated_owner_can_bootstrap_first_school_with_server_session():
    engine = create_engine(
        'sqlite+pysqlite://',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    user_id = uuid.uuid4()

    def server_session_override():
        with Session(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_server_session] = server_session_override
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        id=user_id,
        email='owner@example.test',
    )
    try:
        response = TestClient(app).post(
            '/api/v1/onboarding/school',
            json={
                'name': 'Kampala Community Primary School',
                'district': 'Kampala',
                'programme_codes': ['primary'],
                'canonical_codes': ['P1', 'P2'],
                'default_streams': [],
            },
        )

        assert response.status_code == 201
        with Session(engine) as session:
            school = session.scalar(select(School))
            membership = session.scalar(select(SchoolMembership))
            assert session.scalar(select(func.count()).select_from(SchoolOrganization)) == 1
            assert school is not None
            assert membership is not None
            assert membership.school_id == school.id
            assert membership.auth_user_id == user_id
            assert membership.role == 'owner'
            assert session.scalar(select(func.count()).select_from(AuditEvent)) == 1
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_school_bootstrap_still_requires_authentication():
    response = TestClient(app).post(
        '/api/v1/onboarding/school',
        json={
            'name': 'Unauthorized School',
            'programme_codes': ['primary'],
            'canonical_codes': ['P1'],
            'default_streams': [],
        },
    )

    assert response.status_code == 401
    assert response.json()['detail'] == 'Sign in required'
