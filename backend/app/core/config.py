import os
from functools import lru_cache
from pathlib import Path
from typing import Dict

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent


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
    market_cache_ttl_seconds: int = 45
    macro_cache_ttl_seconds: int = 900
    news_cache_ttl_seconds: int = 600
    news_headline_limit: int = 8
    macro_market_symbol: str = "SPY"
    macro_usd_symbol: str = "UUP"
    macro_interest_rate_effect: str = "neutral"
    finnhub_api_key: str = ""
    openai_api_key: str = ""
    openai_model: str = "gpt-5.4"
    watchlist: Dict[str, str] = Field(default_factory=lambda: DEFAULT_WATCHLIST.copy())

    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(BACKEND_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
