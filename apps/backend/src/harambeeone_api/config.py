import re
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "HarambeeOne API"
    app_environment: str = Field(default="development", alias="NODE_ENV")
    cors_allowed_origins: str = Field(
        default="http://localhost:3000,http://localhost:3002", alias="CORS_ALLOWED_ORIGINS"
    )
    database_provider: Literal["url", "cloud_sql"] = "url"
    database_url: str | None = None
    migration_database_url: str | None = None
    cloud_sql_instance: str | None = None
    cloud_sql_database: str | None = None
    cloud_sql_user: str | None = None
    cloud_sql_server_role: str | None = None
    supabase_url: AnyHttpUrl | None = None
    supabase_publishable_key: str | None = Field(
        default=None, alias="NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    )
    firebase_project_id: str = Field(default="demo-harambeeone", alias="FIREBASE_PROJECT_ID")
    firebase_auth_emulator_host: str | None = Field(
        default=None, alias="FIREBASE_AUTH_EMULATOR_HOST"
    )
    auth_provider: Literal["firebase", "supabase"] = Field(
        default="firebase", alias="AUTH_PROVIDER"
    )
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-3.1-flash-lite", alias="GEMINI_MODEL")
    fcm_delivery_enabled: bool = Field(default=False, alias="FCM_DELIVERY_ENABLED")
    fcm_delivery_interval_seconds: int = Field(
        default=30, ge=10, le=300, alias="FCM_DELIVERY_INTERVAL_SECONDS"
    )
    stellar_horizon_url: str = Field(
        default="https://horizon-testnet.stellar.org", alias="STELLAR_HORIZON_URL"
    )
    stellar_demo_ugx_per_xlm: Decimal = Field(
        default=Decimal("1000"), gt=0, alias="STELLAR_DEMO_UGX_PER_XLM"
    )
    stellar_demo_faucet_enabled: bool = Field(
        default=False, alias="STELLAR_DEMO_FAUCET_ENABLED"
    )

    @model_validator(mode="after")
    def reject_supabase_auth_in_production(self) -> "Settings":
        if self.database_provider == "url" and not self.database_url:
            raise ValueError("DATABASE_URL is required when DATABASE_PROVIDER=url")
        if self.database_provider == "cloud_sql" and not all(
            (
                self.cloud_sql_instance,
                self.cloud_sql_database,
                self.cloud_sql_user,
                self.cloud_sql_server_role,
            )
        ):
            raise ValueError(
                "CLOUD_SQL_INSTANCE, CLOUD_SQL_DATABASE, CLOUD_SQL_USER, and "
                "CLOUD_SQL_SERVER_ROLE are required"
            )
        if self.cloud_sql_server_role and not re.fullmatch(
            r"[A-Za-z_][A-Za-z0-9_]{0,62}", self.cloud_sql_server_role
        ):
            raise ValueError("CLOUD_SQL_SERVER_ROLE must be a safe PostgreSQL identifier")
        if self.app_environment == "production" and self.auth_provider != "firebase":
            raise ValueError("Production authentication must use Firebase")
        if self.auth_provider == "supabase" and not (
            self.supabase_url and self.supabase_publishable_key
        ):
            raise ValueError(
                "SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required "
                "only when AUTH_PROVIDER=supabase"
            )
        if self.app_environment == "production" and self.firebase_auth_emulator_host:
            raise ValueError("Firebase Auth emulator must not be configured in production")
        origins = [item.strip() for item in self.cors_allowed_origins.split(",") if item.strip()]
        if not origins or "*" in origins:
            raise ValueError("CORS_ALLOWED_ORIGINS must list explicit application origins")
        if self.app_environment == "production" and any(
            not origin.startswith("https://") for origin in origins
        ):
            raise ValueError("Production CORS origins must use HTTPS")
        if self.stellar_horizon_url.rstrip("/") != "https://horizon-testnet.stellar.org":
            raise ValueError("STELLAR_HORIZON_URL must use the official Stellar testnet Horizon")
        if self.app_environment == "production" and self.stellar_demo_faucet_enabled:
            raise ValueError("The Stellar testnet demo faucet cannot run in production")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_allowed_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
