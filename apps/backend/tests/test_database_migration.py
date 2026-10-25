from decimal import Decimal

from sqlalchemy import Column, ForeignKey, Integer, MetaData, Numeric, String, Table, create_engine

from harambeeone_api.database_migration import capture_database_evidence, compare_database_evidence
from scripts.migrate_cloudsql_data import _pg_connection


def _database(amount: str = "12.30"):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    metadata = MetaData()
    schools = Table("schools", metadata, Column("id", Integer, primary_key=True))
    payments = Table(
        "payments", metadata,
        Column("id", Integer, primary_key=True),
        Column("school_id", ForeignKey("schools.id"), nullable=False),
        Column("reference", String, nullable=False),
        Column("amount", Numeric(18, 2), nullable=False),
    )
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(schools.insert(), [{"id": 1}])
        connection.execute(payments.insert(), [{
            "id": 1, "school_id": 1, "reference": "PAY-1", "amount": Decimal(amount)
        }])
    return engine


def test_database_evidence_is_deterministic_and_tracks_exact_totals():
    source = capture_database_evidence(_database())
    target = capture_database_evidence(_database())
    assert compare_database_evidence(source, target) == []
    assert source.tables["payments"].numeric_totals == {"amount": "12.30"}
    assert source.tables["payments"].foreign_key_violations == 0


def test_database_evidence_detects_changed_financial_data():
    source = capture_database_evidence(_database("12.30"))
    target = capture_database_evidence(_database("12.31"))
    assert compare_database_evidence(source, target) == ["table evidence differs: payments"]


def test_postgres_child_process_arguments_never_contain_password():
    arguments, environment = _pg_connection(
        "postgresql+psycopg://migration:p%40ss@db.example:5433/harambeeone?sslmode=require"
    )

    assert all("p@ss" not in argument for argument in arguments)
    assert environment["PGPASSWORD"] == "p@ss"
    assert environment["PGSSLMODE"] == "require"
