from collections.abc import Iterator
from functools import lru_cache

from google.cloud.sql.connector import Connector, IPTypes
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session

from harambeeone_api.config import get_settings


class Base(DeclarativeBase):
    pass


# Import model modules so Alembic can discover their metadata.
from harambeeone_api import models  # noqa: E402, F401


@lru_cache
def get_cloud_sql_connector() -> Connector:
    return Connector(refresh_strategy="lazy")


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    shared_options = {
        "pool_size": 5,
        "max_overflow": 5,
        "pool_timeout": 10,
        # The managed PostgreSQL service is remote; pre-ping doubles the network
        # round trips for every request. Short recycling keeps pooled connections
        # fresh without putting an extra query on the critical path.
        "pool_pre_ping": False,
        "pool_recycle": 120,
    }
    if settings.database_provider == "cloud_sql":
        def connect():
            return get_cloud_sql_connector().connect(
                settings.cloud_sql_instance,
                "psycopg",
                user=settings.cloud_sql_user,
                db=settings.cloud_sql_database,
                enable_iam_auth=True,
                ip_type=IPTypes.PUBLIC,
            )

        return create_engine("postgresql+psycopg://", creator=connect, **shared_options)
    return create_engine(
        settings.database_url,
        connect_args={"connect_timeout": 5},
        **shared_options,
    )


def close_database() -> None:
    provider = get_settings().database_provider
    get_engine().dispose()
    get_engine.cache_clear()
    if provider == "cloud_sql":
        get_cloud_sql_connector().close()
        get_cloud_sql_connector.cache_clear()


def get_session() -> Iterator[Session]:
    with Session(get_engine(), expire_on_commit=False) as session:
        yield session


def database_is_ready() -> bool:
    with get_engine().connect() as connection:
        return connection.execute(text("select 1")).scalar_one() == 1
