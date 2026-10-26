from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from harambeeone_api.auth import AuthenticatedUser, get_current_user
from harambeeone_api.config import get_settings
from harambeeone_api.database import close_database, get_engine, get_session
from harambeeone_api.main import app


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def _subject(connection, user_id: uuid.UUID) -> None:
    connection.execute(text("RESET ROLE"))
    connection.execute(
        text("select set_config('request.jwt.claim.sub', :subject, true)"),
        {"subject": str(user_id)},
    )


def _response(response, status_code: int, label: str) -> dict | list:
    if response.status_code != status_code:
        raise RuntimeError(
            f"{label} returned {response.status_code}: {response.text[:300]}"
        )
    return response.json() if response.content else {}


def _api_matrix(
    connection,
    *,
    role_users: dict[str, uuid.UUID],
    school_a: uuid.UUID,
    school_b: uuid.UUID,
    student: uuid.UUID,
    period: uuid.UUID,
    guardian_user: uuid.UUID,
    donor_user: uuid.UUID,
    marker: str,
) -> None:
    probe_suffix = marker.rsplit(" ", 1)[-1][:8]
    current = {
        "user": AuthenticatedUser(id=role_users["owner"], email="owner@probe.invalid")
    }

    def session_override():
        with Session(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
            info={"database_user_id": str(current["user"].id)},
        ) as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[get_current_user] = lambda: current["user"]
    client = TestClient(app)
    try:
        owner_schools = _response(client.get("/api/v1/schools"), 200, "owner school list")
        _assert(
            [row["id"] for row in owner_schools] == [str(school_a)],
            "Owner API tenant visibility failed",
        )
        _response(
            client.get(f"/api/v1/schools/{school_b}/classes"),
            403,
            "cross-tenant class list",
        )
        _response(
            client.post(
                f"/api/v1/schools/{school_a}/classes",
                json={
                    "name": f"Probe owner {probe_suffix}",
                    "level": "primary",
                    "canonical_code": "P1",
                    "sort_order": 1,
                    "streams": [],
                },
            ),
            201,
            "owner class write",
        )

        current["user"] = AuthenticatedUser(
            id=role_users["bursar"], email="bursar@probe.invalid"
        )
        _response(
            client.post(
                f"/api/v1/schools/{school_a}/classes",
                json={
                    "name": f"Probe bursar {probe_suffix}",
                    "level": "primary",
                    "canonical_code": "P2",
                    "sort_order": 2,
                    "streams": [],
                },
            ),
            201,
            "bursar class write",
        )

        current["user"] = AuthenticatedUser(
            id=role_users["cashier"], email="cashier@probe.invalid"
        )
        payment = _response(
            client.post(
                "/api/v1/payments",
                json={
                    "school_id": str(school_a),
                    "student_id": str(student),
                    "period_id": str(period),
                    "external_reference": f"PROBE-{uuid.uuid4().hex[:16]}",
                    "payer_name": "Cloud SQL probe",
                    "channel": "cash",
                    "amount": "50000.00",
                },
            ),
            201,
            "cashier payment write",
        )
        _assert(payment["amount"] == "50000.00", "Cashier payment amount changed")
        _response(
            client.post(
                "/api/v1/fee-categories",
                json={
                    "school_id": str(school_a),
                    "name": "Forbidden cashier fee",
                    "code": "NOPE",
                    "category_type": "other",
                    "priority": 1,
                },
            ),
            403,
            "cashier fee denial",
        )

        current["user"] = AuthenticatedUser(
            id=role_users["auditor"], email="auditor@probe.invalid"
        )
        payments = _response(
            client.get(f"/api/v1/payments?school_id={school_a}&period_id={period}"),
            200,
            "auditor payment read",
        )
        _assert(len(payments) == 1, "Auditor API did not see the cashier payment")
        _response(
            client.post(
                "/api/v1/fee-categories",
                json={
                    "school_id": str(school_a),
                    "name": "Forbidden auditor fee",
                    "code": "NOAUDIT",
                    "category_type": "other",
                    "priority": 1,
                },
            ),
            403,
            "auditor write denial",
        )

        current["user"] = AuthenticatedUser(
            id=guardian_user, email="guardian@probe.invalid"
        )
        learners = _response(
            client.get("/api/v1/guardian/learners"), 200, "guardian learner list"
        )
        _assert(
            [row["student_id"] for row in learners] == [str(student)],
            "Guardian API isolation failed",
        )

        current["user"] = AuthenticatedUser(id=donor_user, email="donor@probe.invalid")
        donor = _response(client.get("/api/v1/donor/profile"), 200, "donor profile")
        _assert(donor["display_name"] == "Probe donor", "Donor API isolation failed")

        current["user"] = AuthenticatedUser(id=uuid.uuid4(), email="unknown@probe.invalid")
        _response(client.get("/api/v1/schools"), 403, "unknown-user denial")
    finally:
        app.dependency_overrides.clear()


def main() -> None:
    settings = get_settings()
    if settings.database_provider != "cloud_sql":
        raise RuntimeError("Refusing to run unless DATABASE_PROVIDER=cloud_sql")
    marker = f"HarambeeOne RLS probe {uuid.uuid4()}"
    organization_a, organization_b = uuid.uuid4(), uuid.uuid4()
    learner_identity_a, learner_identity_b = uuid.uuid4(), uuid.uuid4()
    school_a, school_b = uuid.uuid4(), uuid.uuid4()
    academic_year, academic_period = uuid.uuid4(), uuid.uuid4()
    role_users = {role: uuid.uuid4() for role in ("owner", "bursar", "cashier", "auditor")}
    other_owner = uuid.uuid4()
    guardian_user, other_guardian_user = uuid.uuid4(), uuid.uuid4()
    donor_user, other_donor_user = uuid.uuid4(), uuid.uuid4()
    generated_ids = [uuid.uuid4() for _ in range(12)]
    (
        learner_person,
        guardian_person,
        other_learner_person,
        other_guardian_person,
        student,
        other_student,
        guardian_link,
        other_guardian_link,
        invitation,
        other_invitation,
        account_link,
        other_account_link,
    ) = generated_ids

    engine = get_engine()
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                connection.execute(text(f'SET LOCAL ROLE "{settings.cloud_sql_server_role}"'))
                connection.execute(
                    text(
                        "insert into school_organizations (id, name) values "
                        "(:a, :name_a), (:b, :name_b)"
                    ),
                    {
                        "a": organization_a,
                        "b": organization_b,
                        "name_a": marker + " organization A",
                        "name_b": marker + " organization B",
                    },
                )
                connection.execute(
                    text(
                        "insert into learner_identities (id, organization_id) values "
                        "(:a, :organization_a), (:b, :organization_b)"
                    ),
                    {
                        "a": learner_identity_a,
                        "b": learner_identity_b,
                        "organization_a": organization_a,
                        "organization_b": organization_b,
                    },
                )
                connection.execute(
                    text(
                        "insert into schools "
                        "(id, organization_id, name, unit_name, unit_type) values "
                        "(:a, :organization_a, :name_a, 'Probe A', 'custom'), "
                        "(:b, :organization_b, :name_b, 'Probe B', 'custom')"
                    ),
                    {
                        "a": school_a,
                        "b": school_b,
                        "organization_a": organization_a,
                        "organization_b": organization_b,
                        "name_a": marker + " A",
                        "name_b": marker + " B",
                    },
                )
                memberships = [
                    {"id": uuid.uuid4(), "school": school_a, "user": user, "role": role}
                    for role, user in role_users.items()
                ]
                memberships.append(
                    {"id": uuid.uuid4(), "school": school_b, "user": other_owner, "role": "owner"}
                )
                connection.execute(
                    text(
                        "insert into school_memberships "
                        "(id, school_id, auth_user_id, member_email, role) "
                        "values (:id, :school, :user, null, :role)"
                    ),
                    memberships,
                )
                connection.execute(
                    text(
                        "insert into academic_years "
                        "(id, school_id, name, year, start_date, end_date, status) "
                        "values (:id, :school, :name, 2027, :start, :end, 'open')"
                    ),
                    {
                        "id": academic_year,
                        "school": school_a,
                        "name": marker + " academic year",
                        "start": date(2027, 1, 1),
                        "end": date(2027, 12, 31),
                    },
                )
                connection.execute(
                    text(
                        "insert into academic_periods "
                        "(id, academic_year_id, school_id, name, sequence, opening_date, "
                        "due_date, closing_date, status) values "
                        "(:id, :year, :school, 'Term 1', 1, :opening, :due, :closing, 'open')"
                    ),
                    {
                        "id": academic_period,
                        "year": academic_year,
                        "school": school_a,
                        "opening": date(2027, 1, 1),
                        "due": date(2027, 2, 1),
                        "closing": date(2027, 4, 30),
                    },
                )
                people = (
                    (learner_person, "Probe", "Learner"),
                    (guardian_person, "Probe", "Guardian"),
                    (other_learner_person, "Other", "Learner"),
                    (other_guardian_person, "Other", "Guardian"),
                )
                connection.execute(
                    text(
                        "insert into people (id, first_name, last_name) values (:id, :first, :last)"
                    ),
                    [{"id": item[0], "first": item[1], "last": item[2]} for item in people],
                )
                connection.execute(
                    text(
                        "insert into students "
                        "(id, school_id, learner_identity_id, person_id, admission_no, "
                        "gender, status, boarding_status, nationality) "
                        "values (:id, :school, :identity, :person, :admission, 'other', "
                        "'active', 'day', 'Ugandan')"
                    ),
                    [
                        {
                            "id": student,
                            "school": school_a,
                            "identity": learner_identity_a,
                            "person": learner_person,
                            "admission": "PROBE-A",
                        },
                        {
                            "id": other_student,
                            "school": school_b,
                            "identity": learner_identity_b,
                            "person": other_learner_person,
                            "admission": "PROBE-B",
                        },
                    ],
                )
                connection.execute(
                    text(
                        "insert into guardian_links "
                        "(id, student_id, person_id, relationship, is_primary, "
                        "can_receive_statements) "
                        "values (:id, :student, :person, 'guardian', true, true)"
                    ),
                    [
                        {"id": guardian_link, "student": student, "person": guardian_person},
                        {
                            "id": other_guardian_link,
                            "student": other_student,
                            "person": other_guardian_person,
                        },
                    ],
                )
                expires_at = datetime.now(UTC) + timedelta(hours=1)
                connection.execute(
                    text(
                        "insert into guardian_invitations "
                        "(id, school_id, guardian_link_id, token_hash, invited_email, status, "
                        "expires_at, created_by, accepted_by_user_id) "
                        "values (:id, :school, :guardian, :token, :email, 'accepted', "
                        ":expires, 'system:cloudsql-probe', :user)"
                    ),
                    [
                        {
                            "id": invitation,
                            "school": school_a,
                            "guardian": guardian_link,
                            "token": uuid.uuid4().hex * 2,
                            "email": "probe-a@example.invalid",
                            "expires": expires_at,
                            "user": guardian_user,
                        },
                        {
                            "id": other_invitation,
                            "school": school_b,
                            "guardian": other_guardian_link,
                            "token": uuid.uuid4().hex * 2,
                            "email": "probe-b@example.invalid",
                            "expires": expires_at,
                            "user": other_guardian_user,
                        },
                    ],
                )
                connection.execute(
                    text(
                        "insert into guardian_account_links "
                        "(id, auth_user_id, school_id, guardian_link_id, invitation_id) "
                        "values (:id, :user, :school, :guardian, :invitation)"
                    ),
                    [
                        {
                            "id": account_link,
                            "user": guardian_user,
                            "school": school_a,
                            "guardian": guardian_link,
                            "invitation": invitation,
                        },
                        {
                            "id": other_account_link,
                            "user": other_guardian_user,
                            "school": school_b,
                            "guardian": other_guardian_link,
                            "invitation": other_invitation,
                        },
                    ],
                )
                connection.execute(
                    text(
                        "insert into donor_profiles (auth_user_id, display_name, show_public_name) "
                        "values (:user, :name, false)"
                    ),
                    [
                        {"user": donor_user, "name": "Probe donor"},
                        {"user": other_donor_user, "name": "Other donor"},
                    ],
                )

                for role, user_id in role_users.items():
                    _subject(connection, user_id)
                    schools = (
                        connection.execute(text("select id from schools order by id"))
                        .scalars()
                        .all()
                    )
                    _assert(schools == [school_a], f"{role} tenant visibility failed")
                    result = connection.execute(
                        text("update schools set unit_name = unit_name where id = :school"),
                        {"school": school_a},
                    )
                    _assert(
                        result.rowcount == (1 if role == "owner" else 0),
                        f"{role} write policy failed",
                    )

                _subject(connection, guardian_user)
                guardian_rows = (
                    connection.execute(text("select id from guardian_account_links order by id"))
                    .scalars()
                    .all()
                )
                _assert(guardian_rows == [account_link], "Guardian isolation failed")

                _subject(connection, donor_user)
                donor_rows = (
                    connection.execute(
                        text("select auth_user_id from donor_profiles order by auth_user_id")
                    )
                    .scalars()
                    .all()
                )
                _assert(donor_rows == [donor_user], "Donor isolation failed")

                _subject(connection, uuid.uuid4())
                _assert(
                    connection.execute(text("select count(*) from schools")).scalar_one() == 0,
                    "Unknown user saw tenant data",
                )

                _api_matrix(
                    connection,
                    role_users=role_users,
                    school_a=school_a,
                    school_b=school_b,
                    student=student,
                    period=academic_period,
                    guardian_user=guardian_user,
                    donor_user=donor_user,
                    marker=marker,
                )

                connection.execute(text(f'SET LOCAL ROLE "{settings.cloud_sql_server_role}"'))
                _assert(
                    connection.execute(
                        text("select count(*) from schools where id in (:a, :b)"),
                        {"a": school_a, "b": school_b},
                    ).scalar_one()
                    == 2,
                    "Server workflow lacks explicit access",
                )
                savepoint = connection.begin_nested()
                try:
                    connection.execute(
                        text(
                            "insert into school_memberships "
                            "(id, school_id, auth_user_id, member_email, role) "
                            "values (:id, :school, :user, null, 'owner')"
                        ),
                        {"id": uuid.uuid4(), "school": school_a, "user": role_users["owner"]},
                    )
                    raise RuntimeError("Duplicate membership constraint did not reject a replay")
                except DBAPIError as error:
                    _assert(
                        getattr(error.orig, "sqlstate", None) == "23505",
                        "Unexpected duplicate error",
                    )
                finally:
                    savepoint.rollback()
            finally:
                transaction.rollback()

        with engine.connect() as connection:
            with connection.begin():
                connection.execute(text(f'SET LOCAL ROLE "{settings.cloud_sql_server_role}"'))
                remaining = connection.execute(
                    text("select count(*) from schools where name like :marker"),
                    {"marker": marker + "%"},
                ).scalar_one()
                _assert(remaining == 0, "Rollback left synthetic Cloud SQL rows behind")
        print(
            "Cloud SQL runtime and API controls passed: owner, bursar, cashier, auditor, "
            "guardian, donor, tenant isolation, unknown-user denial, server-only access, "
            "duplicate rejection, and rollback."
        )
    finally:
        close_database()


if __name__ == "__main__":
    main()
