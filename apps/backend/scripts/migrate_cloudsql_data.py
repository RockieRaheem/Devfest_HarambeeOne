import argparse
import os
import shutil
import subprocess
from pathlib import Path

from sqlalchemy.engine import make_url

from harambeeone_api.database_migration import (
    capture_database_evidence,
    compare_database_evidence,
    connect_database,
)


def _secret(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Required environment variable is missing: {name}")
    return value


def _tool(name: str) -> str:
    value = shutil.which(name)
    if not value:
        raise SystemExit(f"Required PostgreSQL client is not installed: {name}")
    return value


def _pg_connection(url_value: str) -> tuple[list[str], dict[str, str]]:
    url = make_url(url_value)
    if url.get_backend_name() != "postgresql" or not url.host or not url.database:
        raise SystemExit("Migration URLs must identify a PostgreSQL host and database")
    arguments = [f"--host={url.host}", f"--port={url.port or 5432}", f"--dbname={url.database}"]
    if url.username:
        arguments.append(f"--username={url.username}")
    environment = os.environ.copy()
    if url.password:
        environment["PGPASSWORD"] = url.password
    if sslmode := url.query.get("sslmode"):
        environment["PGSSLMODE"] = sslmode
    return arguments, environment


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transfer a data-only PostgreSQL snapshot and prove source/target parity."
    )
    parser.add_argument("--dump", type=Path, required=True)
    parser.add_argument("--restore", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--evidence-dir", type=Path, default=Path("migration-evidence"))
    args = parser.parse_args()
    source_url = _secret("SOURCE_DATABASE_URL")
    target_url = _secret("TARGET_DATABASE_URL")
    if args.dump.exists() and not args.overwrite:
        raise SystemExit(
            "Dump already exists; pass --overwrite only after confirming the target path"
        )
    source_connection, source_environment = _pg_connection(source_url)
    target_connection, target_environment = _pg_connection(target_url)
    source_before = capture_database_evidence(connect_database(source_url))
    target_before = capture_database_evidence(connect_database(target_url))
    if source_before.revision != target_before.revision:
        raise SystemExit("Source and target must be at the same Alembic revision before transfer")
    if args.restore and any(table.rows for table in target_before.tables.values()):
        raise SystemExit("Target contains application rows; refusing a non-empty restore")
    args.dump.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            _tool("pg_dump"), "--format=custom", "--data-only", "--schema=public",
            "--exclude-table=public.alembic_version", "--no-owner", "--no-privileges",
            f"--file={args.dump}", *source_connection,
        ],
        check=True,
        env=source_environment,
    )
    if not args.restore:
        print(f"Protected data-only snapshot created at {args.dump}; target was not changed.")
        return
    subprocess.run(
        [
            _tool("pg_restore"), "--data-only", "--no-owner", "--no-privileges",
            "--single-transaction", "--exit-on-error", *target_connection, str(args.dump),
        ],
        check=True,
        env=target_environment,
    )
    source = capture_database_evidence(connect_database(source_url))
    target = capture_database_evidence(connect_database(target_url))
    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    source.write(args.evidence_dir / "source.json")
    target.write(args.evidence_dir / "target.json")
    errors = compare_database_evidence(source, target)
    if errors:
        raise SystemExit("Database parity failed:\n- " + "\n- ".join(errors))
    print(
        "Database parity passed: revisions, rows, hashes, numeric totals, "
        "and foreign keys agree."
    )


if __name__ == "__main__":
    main()
