import base64
import hashlib
import json
import uuid
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import MetaData, Table, create_engine, func, inspect, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.sql.sqltypes import Numeric


@dataclass(frozen=True)
class TableEvidence:
    rows: int
    sha256: str
    numeric_totals: dict[str, str]
    foreign_key_violations: int


@dataclass(frozen=True)
class DatabaseEvidence:
    revision: str | None
    tables: dict[str, TableEvidence]

    def write(self, path: Path) -> None:
        path.write_text(json.dumps(asdict(self), indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _canonical(value: Any) -> Any:
    if value is None or isinstance(value, bool | int | str):
        return value
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime | date | time):
        return value.isoformat()
    if isinstance(value, bytes):
        return {"base64": base64.b64encode(value).decode("ascii")}
    if isinstance(value, Mapping):
        return {str(key): _canonical(item) for key, item in sorted(value.items())}
    if isinstance(value, list | tuple):
        return [_canonical(item) for item in value]
    return str(value)


def _table_hash(connection, table: Table) -> tuple[int, str]:
    columns = list(table.columns)
    statement = select(*columns)
    if table.primary_key.columns:
        statement = statement.order_by(*table.primary_key.columns)
    digest = hashlib.sha256()
    rows = 0
    for row in connection.execute(statement):
        encoded = json.dumps(
            [_canonical(value) for value in row], ensure_ascii=False, separators=(",", ":")
        ).encode()
        digest.update(len(encoded).to_bytes(8, "big"))
        digest.update(encoded)
        rows += 1
    return rows, digest.hexdigest()


def _numeric_totals(connection, table: Table) -> dict[str, str]:
    totals: dict[str, str] = {}
    for column in table.columns:
        if isinstance(column.type, Numeric):
            value = connection.scalar(select(func.coalesce(func.sum(column), 0)))
            totals[column.name] = format(Decimal(value), "f")
    return totals


def _foreign_key_violations(connection, table: Table, metadata: MetaData) -> int:
    violations = 0
    for constraint in table.foreign_key_constraints:
        local_columns = list(constraint.columns)
        elements = list(constraint.elements)
        remote_table = metadata.tables[elements[0].column.table.key]
        matches = [
            element.column == local
            for element, local in zip(elements, local_columns, strict=True)
        ]
        invalid = select(func.count()).select_from(table).where(
            *(local.is_not(None) for local in local_columns),
            ~select(1).select_from(remote_table).where(*matches).exists(),
        )
        violations += int(connection.scalar(invalid) or 0)
    return violations


def capture_database_evidence(engine: Engine) -> DatabaseEvidence:
    schema = "public" if engine.dialect.name == "postgresql" else None
    inspector = inspect(engine)
    table_names = sorted(
        name for name in inspector.get_table_names(schema=schema) if name != "alembic_version"
    )
    metadata = MetaData(schema=schema)
    metadata.reflect(bind=engine, schema=schema, only=table_names)
    evidence: dict[str, TableEvidence] = {}
    with engine.connect() as connection:
        revision = (
            connection.scalar(text("select version_num from alembic_version"))
            if inspector.has_table("alembic_version", schema=schema)
            else None
        )
        for table_name in table_names:
            table = metadata.tables[f"{schema}.{table_name}" if schema else table_name]
            rows, sha256 = _table_hash(connection, table)
            evidence[table_name] = TableEvidence(
                rows=rows,
                sha256=sha256,
                numeric_totals=_numeric_totals(connection, table),
                foreign_key_violations=_foreign_key_violations(connection, table, metadata),
            )
    return DatabaseEvidence(revision=revision, tables=evidence)


def compare_database_evidence(source: DatabaseEvidence, target: DatabaseEvidence) -> list[str]:
    errors: list[str] = []
    if source.revision != target.revision:
        errors.append(f"revision differs: {source.revision!r} != {target.revision!r}")
    if source.tables.keys() != target.tables.keys():
        missing = sorted(source.tables.keys() - target.tables.keys())
        extra = sorted(target.tables.keys() - source.tables.keys())
        errors.append(f"table set differs: missing={missing}, extra={extra}")
    for name in sorted(source.tables.keys() & target.tables.keys()):
        if source.tables[name] != target.tables[name]:
            errors.append(f"table evidence differs: {name}")
        if target.tables[name].foreign_key_violations:
            errors.append(f"foreign-key violations in {name}")
    return errors


def connect_database(url: str) -> Engine:
    return create_engine(url, connect_args={"connect_timeout": 10})
