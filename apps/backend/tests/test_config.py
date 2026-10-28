import pytest
from pydantic import ValidationError

from harambeeone_api.config import Settings


def production_settings(**overrides):
    values = {
        "NODE_ENV": "production",
        "CORS_ALLOWED_ORIGINS": "https://give.example.org",
        "database_url": "postgresql://example.invalid/harambeeone",
        "supabase_url": "https://example.supabase.co",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "test-public-key",
        "AUTH_PROVIDER": "firebase",
        "STELLAR_HORIZON_URL": "https://horizon-testnet.stellar.org",
        "STELLAR_DEMO_FAUCET_ENABLED": False,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_production_accepts_explicit_https_cors_origin():
    settings = production_settings()

    assert settings.allowed_origins == ["https://give.example.org"]


def test_firebase_production_does_not_require_supabase_configuration():
    settings = production_settings(
        supabase_url=None,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=None,
    )

    assert settings.auth_provider == "firebase"


def test_supabase_rollback_requires_its_configuration():
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            NODE_ENV="development",
            CORS_ALLOWED_ORIGINS="http://localhost:3000",
            database_url="postgresql://example.invalid/harambeeone",
            AUTH_PROVIDER="supabase",
        )


@pytest.mark.parametrize("origin", ["*", "http://give.example.org"])
def test_production_rejects_unsafe_cors_origin(origin):
    with pytest.raises(ValidationError):
        production_settings(CORS_ALLOWED_ORIGINS=origin)


def test_production_rejects_demo_faucet():
    with pytest.raises(ValidationError):
        production_settings(STELLAR_DEMO_FAUCET_ENABLED=True)
