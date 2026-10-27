"""Verify Firebase push delivery controls against the configured PostgreSQL database."""

from sqlalchemy import text

from harambeeone_api.database import close_database, get_engine

EXPECTED_REVISION = "c4f8a1d29e60"
TABLES = {"push_installations", "push_deliveries"}
REQUIRED_INDEXES = {
    "ix_push_installations_user_active",
    "ix_push_deliveries_status_time",
    "uq_push_delivery_outbox_installation",
}


def main() -> None:
    with get_engine().connect() as connection:
        revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        tables = set(
            connection.execute(
                text(
                    """
                    SELECT tablename FROM pg_tables
                    WHERE schemaname = 'public' AND tablename = ANY(:tables)
                    """
                ),
                {"tables": sorted(TABLES)},
            ).scalars()
        )
        rls_tables = set(
            connection.execute(
                text(
                    """
                    SELECT c.relname FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = ANY(:tables)
                      AND c.relrowsecurity
                    """
                ),
                {"tables": sorted(TABLES)},
            ).scalars()
        )
        exposed_grants = connection.execute(
            text(
                """
                SELECT count(*) FROM information_schema.role_table_grants
                WHERE table_schema = 'public' AND table_name = ANY(:tables)
                  AND grantee IN ('anon','authenticated')
                """
            ),
            {"tables": sorted(TABLES)},
        ).scalar_one()
        indexes = set(
            connection.execute(
                text(
                    """
                    SELECT indexname FROM pg_indexes
                    WHERE schemaname = 'public' AND tablename = ANY(:tables)
                    """
                ),
                {"tables": sorted(TABLES)},
            ).scalars()
        )
        policies = set(
            connection.execute(
                text(
                    """
                    SELECT policyname FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = ANY(:tables)
                    """
                ),
                {"tables": sorted(TABLES)},
            ).scalars()
        )
    close_database()
    assert revision == EXPECTED_REVISION, f"Unexpected Alembic revision: {revision}"
    assert tables == TABLES, f"Missing push tables: {TABLES - tables}"
    assert rls_tables == TABLES, f"Push tables without RLS: {TABLES - rls_tables}"
    assert exposed_grants == 0, "Push delivery tables are exposed through the Data API"
    assert REQUIRED_INDEXES <= indexes, f"Missing push indexes: {REQUIRED_INDEXES - indexes}"
    assert policies == {"push_installations_self_access", "push_deliveries_self_read"}
    print("FCM migration verified: ownership, RLS, grants, deduplication and retry indexes passed.")


if __name__ == "__main__":
    main()
