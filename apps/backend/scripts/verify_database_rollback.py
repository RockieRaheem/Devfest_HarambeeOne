import os
from dataclasses import dataclass
from time import monotonic

from sqlalchemy import text

from harambeeone_api.config import get_settings
from harambeeone_api.database import close_database, get_engine


@dataclass(frozen=True)
class CheckResult:
    provider: str
    revision: str
    seconds: float


def _clear_runtime() -> None:
    get_engine.cache_clear()
    get_settings.cache_clear()


def _check_provider(provider: str) -> CheckResult:
    os.environ["DATABASE_PROVIDER"] = provider
    _clear_runtime()
    started = monotonic()
    try:
        settings = get_settings()
        if settings.database_provider != provider:
            raise RuntimeError(f"Expected {provider}, loaded {settings.database_provider}")
        with get_engine().connect() as connection:
            if connection.execute(text("select 1")).scalar_one() != 1:
                raise RuntimeError(f"{provider} readiness query failed")
            revision = connection.execute(
                text("select version_num from public.alembic_version")
            ).scalar_one()
        return CheckResult(provider=provider, revision=revision, seconds=monotonic() - started)
    finally:
        close_database()


def main() -> None:
    original = os.environ.get("DATABASE_PROVIDER")
    try:
        results = [_check_provider(provider) for provider in ("url", "cloud_sql", "url")]
    finally:
        if original is None:
            os.environ.pop("DATABASE_PROVIDER", None)
        else:
            os.environ["DATABASE_PROVIDER"] = original
        _clear_runtime()

    revisions = {result.revision for result in results}
    if len(revisions) != 1:
        raise RuntimeError("Source and Cloud SQL Alembic revisions differ")
    timings = ", ".join(f"{result.provider}={result.seconds:.2f}s" for result in results)
    print(
        "Configuration rollback passed: URL -> Cloud SQL -> URL; "
        f"revision={results[0].revision}; {timings}."
    )


if __name__ == "__main__":
    main()
