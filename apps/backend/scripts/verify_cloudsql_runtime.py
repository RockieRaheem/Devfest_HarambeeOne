from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from harambeeone_api.config import get_settings
from harambeeone_api.database import close_database, get_engine


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def _subject(connection, user_id: uuid.UUID) -> None:
    connection.execute(text("RESET ROLE"))
    connection.execute(
        text("select set_config('request.jwt.claim.sub', :subject, true)"),
        {"subject": str(user_id)},
    )


def main() -> None:
    settings = get_settings()
    if settings.database_provider != "cloud_sql":
        raise RuntimeError("Refusing to run unless DATABASE_PROVIDER=cloud_sql")
    marker = f"HarambeeOne RLS probe {uuid.uuid4()}"
    organization_a, organization_b = uuid.uuid4(), uuid.uuid4()
    learner_identity_a, learner_identity_b = uuid.uuid4(), uuid.uuid4()
    school_a, school_b = uuid.uuid4(), uuid.uuid4()
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
            "Cloud SQL runtime controls passed: owner, bursar, cashier, auditor, guardian, "
            "donor, unknown-user, server-only access, duplicate rejection, and rollback."
        )
    finally:
        close_database()


if __name__ == "__main__":
    main()
