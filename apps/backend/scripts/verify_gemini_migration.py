"""Verify the Gemini consent rename against the configured PostgreSQL database."""

from sqlalchemy import text

from harambeeone_api.database import close_database, get_engine

EXPECTED_REVISION = "a8c4e2f19b70"
EXPECTED_COLUMNS = [
    ("support_consents", "gemini_processing"),
    ("support_referrals", "gemini_processing"),
]


def main() -> None:
    with get_engine().connect() as connection:
        revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        columns = connection.execute(
            text(
                """
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name IN ('support_referrals', 'support_consents')
                  AND column_name IN ('gemini_processing', 'gemma_processing')
                ORDER BY table_name, column_name
                """
            )
        ).tuples().all()
    close_database()
    assert revision == EXPECTED_REVISION, f"Unexpected Alembic revision: {revision}"
    assert columns == EXPECTED_COLUMNS, f"Unexpected AI consent columns: {columns}"
    print(f"Gemini database migration verified at {revision}.")


if __name__ == "__main__":
    main()
