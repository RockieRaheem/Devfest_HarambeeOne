from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from google.cloud.sql.connector import IPTypes

from harambeeone_api import database


@pytest.fixture(autouse=True)
def clear_engine_cache():
    database.get_engine.cache_clear()
    yield
    database.get_engine.cache_clear()


def _settings(provider: str):
    return SimpleNamespace(
        database_provider=provider,
        database_url="postgresql+psycopg://user:password@source.example/app",
        cloud_sql_instance="project:europe-west1:instance",
        cloud_sql_database="harambeeone",
        cloud_sql_user="api@project.iam",
    )


def test_url_database_uses_bounded_remote_pool(monkeypatch):
    create_engine = Mock(return_value=object())
    monkeypatch.setattr(database, "get_settings", lambda: _settings("url"))
    monkeypatch.setattr(database, "create_engine", create_engine)
    database.get_engine()

    create_engine.assert_called_once_with(
        "postgresql+psycopg://user:password@source.example/app",
        connect_args={"connect_timeout": 5},
        pool_size=5,
        max_overflow=5,
        pool_timeout=10,
        pool_pre_ping=False,
        pool_recycle=120,
    )


def test_cloud_sql_database_uses_automatic_iam_authentication(monkeypatch):
    captured = {}
    connector = Mock()

    def create_engine(url, **options):
        captured.update(url=url, **options)
        return object()

    monkeypatch.setattr(database, "get_settings", lambda: _settings("cloud_sql"))
    monkeypatch.setattr(database, "get_cloud_sql_connector", lambda: connector)
    monkeypatch.setattr(database, "create_engine", create_engine)
    database.get_engine()
    captured["creator"]()

    assert captured["url"] == "postgresql+psycopg://"
    assert "connect_args" not in captured
    connector.connect.assert_called_once_with(
        "project:europe-west1:instance",
        "psycopg",
        user="api@project.iam",
        db="harambeeone",
        enable_iam_auth=True,
        ip_type=IPTypes.PUBLIC,
    )


def test_cloud_sql_shutdown_releases_pool_and_connector(monkeypatch):
    engine = Mock()
    connector = Mock()
    engine_factory = Mock(return_value=engine)
    engine_factory.cache_clear = Mock()
    connector_factory = Mock(return_value=connector)
    connector_factory.cache_clear = Mock()
    monkeypatch.setattr(database, "get_settings", lambda: _settings("cloud_sql"))
    monkeypatch.setattr(database, "get_engine", engine_factory)
    monkeypatch.setattr(database, "get_cloud_sql_connector", connector_factory)

    database.close_database()

    engine.dispose.assert_called_once_with()
    connector.close.assert_called_once_with()
    engine_factory.cache_clear.assert_called_once_with()
    connector_factory.cache_clear.assert_called_once_with()
