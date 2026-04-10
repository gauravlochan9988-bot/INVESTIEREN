"""Ensure dashboard watchlist API universe matches configured watchlist (no hardcoded 6-ticker cap)."""

from __future__ import annotations

from app.api.deps import get_dashboard_watchlist_symbols
from app.core.config import DEFAULT_WATCHLIST, get_settings

# Symbols shown in the static dashboard sidebar (app.js DEFAULT_SIDEBAR_ITEMS).
_FRONTEND_SIDEBAR_DEFAULTS = frozenset(
    {
        "AAPL",
        "MSFT",
        "NVDA",
        "AMZN",
        "META",
        "TSLA",
        "GOOGL",
        "AMD",
        "NFLX",
        "SPY",
    }
)


def test_get_dashboard_watchlist_symbols_matches_settings_watchlist() -> None:
    get_settings.cache_clear()
    symbols = get_dashboard_watchlist_symbols()
    assert tuple(get_settings().watchlist.keys()) == symbols
    assert set(symbols) == set(DEFAULT_WATCHLIST.keys())


def test_dashboard_watchlist_covers_frontend_sidebar_defaults() -> None:
    get_settings.cache_clear()
    symbols = set(get_dashboard_watchlist_symbols())
    assert _FRONTEND_SIDEBAR_DEFAULTS.issubset(symbols)
    for sym in ("GOOGL", "AMD", "NFLX", "SPY"):
        assert sym in symbols
