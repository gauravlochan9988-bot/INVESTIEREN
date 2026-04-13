import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent


# Drives MarketData allowed symbols, search defaults, and `/api/dashboard/watchlist` (via get_dashboard_watchlist_symbols).
DEFAULT_WATCHLIST: Dict[str, str] = {
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "TSLA": "Tesla",
    "NVDA": "NVIDIA",
    "AMZN": "Amazon",
    "GOOGL": "Alphabet",
    "META": "Meta",
    "NFLX": "Netflix",
    "AMD": "AMD",
    "JPM": "JPMorgan",
    "KO": "Coca-Cola",
    "SPY": "SPDR S&P 500 ETF",
}


def env_first(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return ""


class Settings(BaseSettings):
    app_name: str = "Investieren MVP"
    app_env: str = "development"
    debug: bool = True
    database_url: str = Field(
        default_factory=lambda: (
            "sqlite+pysqlite:////tmp/investieren.db"
            if os.getenv("VERCEL")
            else f"sqlite+pysqlite:///{(PROJECT_ROOT / 'investieren.db').as_posix()}"
        )
    )
    market_cache_ttl_seconds: int = 30
    indicators_cache_ttl_seconds: int = 60
    analysis_cache_ttl_seconds: int = 10
    alerts_cache_ttl_seconds: int = 60
    macro_cache_ttl_seconds: int = 900
    news_cache_ttl_seconds: int = 600
    preload_refresh_seconds: int = 180
    news_headline_limit: int = 8
    macro_market_symbol: str = "SPY"
    macro_usd_symbol: str = "UUP"
    macro_interest_rate_effect: str = "neutral"
    finnhub_api_key: str = ""
    openai_api_key: str = ""
    openai_model: str = "gpt-5.4"
    clerk_publishable_key: str = Field(
        default_factory=lambda: env_first(
            "CLERK_PUBLISHABLE_KEY",
            "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
            "VITE_CLERK_PUBLISHABLE_KEY",
        )
    )
    clerk_frontend_api_url: str = Field(
        default_factory=lambda: env_first(
            "CLERK_FRONTEND_API_URL",
            "CLERK_FAPI",
            "NEXT_PUBLIC_CLERK_FAPI",
            "VITE_CLERK_FAPI",
        )
    )
    clerk_secret_key: str = Field(default_factory=lambda: env_first("CLERK_SECRET_KEY"))
    clerk_jwt_key: str = Field(
        default_factory=lambda: env_first("CLERK_JWT_KEY", "CLERK_PEM_PUBLIC_KEY")
    )
    clerk_authorized_parties: str = Field(default_factory=lambda: env_first("CLERK_AUTHORIZED_PARTIES"))
    supabase_url: str = Field(
        default_factory=lambda: env_first(
            "SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_URL",
            "VITE_SUPABASE_URL",
        )
    )
    supabase_anon_key: str = Field(
        default_factory=lambda: env_first(
            "SUPABASE_ANON_KEY",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            "VITE_SUPABASE_ANON_KEY",
        )
    )
    clerk_plan_slug: str = "pro"
    clerk_plan_name: str = "Investieren Pro Monthly"
    frontend_origin: str = "https://gauravtrades.de"
    cors_allow_origins: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = ""
    stripe_price_id: str = ""
    admin_access_code: str = "9988"
    admin_session_secret: str = "investieren-admin-session-secret"
    admin_access_max_attempts: int = 5
    admin_access_lockout_seconds: int = 900
    watchlist: Dict[str, str] = Field(default_factory=lambda: DEFAULT_WATCHLIST.copy())
    cron_secret: str = ""
    favorite_signal_min_confidence_partial: float = 58.0
    owner_auth_subjects: str = ""

    def get_cors_allowed_origins(self) -> List[str]:
        origins: list[str] = [
            "http://127.0.0.1:8000",
            "http://localhost:8000",
            "http://127.0.0.1:8003",
            "http://localhost:8003",
        ]
        if self.frontend_origin:
            origins.append(self.frontend_origin.strip())
        if self.cors_allow_origins:
            origins.extend(
                [part.strip() for part in self.cors_allow_origins.split(",") if part.strip()]
            )
        # Preserve insertion order while deduplicating.
        return list(dict.fromkeys(origins))

    def get_owner_subjects(self) -> List[str]:
        return [part.strip() for part in self.owner_auth_subjects.split(",") if part.strip()]

    def get_clerk_authorized_parties(self) -> List[str]:
        parties: list[str] = []
        if self.frontend_origin:
            parties.append(self.frontend_origin.strip())
        if self.cors_allow_origins:
            parties.extend(part.strip() for part in self.cors_allow_origins.split(",") if part.strip())
        if self.clerk_authorized_parties:
            parties.extend(part.strip() for part in self.clerk_authorized_parties.split(",") if part.strip())

        normalized: list[str] = []
        for value in parties:
            item = value.rstrip("/")
            if item.startswith("http://") or item.startswith("https://"):
                normalized.append(item)
        # Preserve insertion order while deduplicating.
        return list(dict.fromkeys(normalized))

    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url.strip() and self.supabase_anon_key.strip())

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if not isinstance(value, str):
            return value

        value = value.strip()

        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg2://", 1)

        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg2://", 1)

        if value.startswith("postgresql+psycopg://"):
            return value.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)

        return value

    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(BACKEND_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
