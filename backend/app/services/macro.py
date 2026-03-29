from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

from app.core.config import get_settings
from app.schemas.analysis import InterestRateEffect, MacroContext, MacroTrend, UsdStrength
from app.schemas.stocks import HistoryPoint
from app.services.cache import TTLCache


MIN_HISTORY_POINTS = 60
MARKET_MOMENTUM_LOOKBACK = 10
USD_MOMENTUM_LOOKBACK = 10


class MacroDataProvider(Protocol):
    def fetch_history(self, symbol: str, period: str) -> list[HistoryPoint]:
        ...


@dataclass
class MacroSnapshot:
    market_trend: MacroTrend
    interest_rate_effect: InterestRateEffect
    usd_strength: UsdStrength
    macro_score: int
    market_trend_strength: float
    market_price_vs_sma50: float
    market_momentum_10d: float
    usd_price_vs_sma50: float
    usd_momentum_10d: float

    def to_context(self) -> MacroContext:
        return MacroContext(
            market_trend=self.market_trend,
            interest_rate_effect=self.interest_rate_effect,
            usd_strength=self.usd_strength,
            macro_score=self.macro_score,
        )


class MacroContextService:
    def __init__(
        self,
        provider: MacroDataProvider,
        ttl_seconds: int | None = None,
        market_symbol: str | None = None,
        usd_symbol: str | None = None,
        interest_rate_effect: str | None = None,
    ):
        settings = get_settings()
        self.provider = provider
        self.market_symbol = (market_symbol or settings.macro_market_symbol).strip().upper()
        self.usd_symbol = (usd_symbol or settings.macro_usd_symbol).strip().upper()
        self.interest_rate_effect = self._normalize_interest_rate_effect(
            interest_rate_effect or settings.macro_interest_rate_effect
        )
        self.cache: TTLCache[MacroSnapshot] = TTLCache(
            ttl_seconds or settings.macro_cache_ttl_seconds
        )

    def get_context(self) -> MacroSnapshot:
        cache_key = (
            f"{self.market_symbol}:{self.usd_symbol}:{self.interest_rate_effect}"
        )
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            snapshot = self._build_snapshot()
        except Exception:
            stale = self.cache.get_stale(cache_key)
            if stale is not None:
                return stale
            snapshot = self._fallback_snapshot()
        return self.cache.set(cache_key, snapshot)

    def _build_snapshot(self) -> MacroSnapshot:
        market_history = self.provider.fetch_history(self.market_symbol, "6mo")
        usd_history = self.provider.fetch_history(self.usd_symbol, "6mo")

        if len(market_history) < MIN_HISTORY_POINTS or len(usd_history) < MIN_HISTORY_POINTS:
            return self._fallback_snapshot()

        market_closes = [point.close for point in market_history]
        usd_closes = [point.close for point in usd_history]

        market_sma20 = self._sma(market_closes, 20)
        market_sma50 = self._sma(market_closes, 50)
        market_price_vs_sma50 = self._relative_distance(market_closes[-1], market_sma50)
        market_sma20_vs_sma50 = self._relative_distance(market_sma20, market_sma50)
        market_momentum_10d = self._momentum(market_closes, MARKET_MOMENTUM_LOOKBACK)
        market_trend_strength = self._trend_strength(
            market_price_vs_sma50,
            market_sma20_vs_sma50,
        )
        market_trend = self._market_trend(
            price_vs_sma50=market_price_vs_sma50,
            sma20_vs_sma50=market_sma20_vs_sma50,
            momentum_10d=market_momentum_10d,
            trend_strength=market_trend_strength,
        )

        usd_sma50 = self._sma(usd_closes, 50)
        usd_price_vs_sma50 = self._relative_distance(usd_closes[-1], usd_sma50)
        usd_momentum_10d = self._momentum(usd_closes, USD_MOMENTUM_LOOKBACK)
        usd_strength = self._usd_strength(
            price_vs_sma50=usd_price_vs_sma50,
            momentum_10d=usd_momentum_10d,
        )

        macro_score = (
            self._market_score(market_trend)
            + self._rate_score(self.interest_rate_effect)
            + self._usd_score(usd_strength)
        )
        return MacroSnapshot(
            market_trend=market_trend,
            interest_rate_effect=self.interest_rate_effect,
            usd_strength=usd_strength,
            macro_score=macro_score,
            market_trend_strength=round(market_trend_strength, 4),
            market_price_vs_sma50=round(market_price_vs_sma50, 4),
            market_momentum_10d=round(market_momentum_10d, 4),
            usd_price_vs_sma50=round(usd_price_vs_sma50, 4),
            usd_momentum_10d=round(usd_momentum_10d, 4),
        )

    def _fallback_snapshot(self) -> MacroSnapshot:
        macro_score = self._rate_score(self.interest_rate_effect)
        return MacroSnapshot(
            market_trend="neutral",
            interest_rate_effect=self.interest_rate_effect,
            usd_strength="neutral",
            macro_score=macro_score,
            market_trend_strength=0.35,
            market_price_vs_sma50=0.0,
            market_momentum_10d=0.0,
            usd_price_vs_sma50=0.0,
            usd_momentum_10d=0.0,
        )

    def _market_trend(
        self,
        *,
        price_vs_sma50: float,
        sma20_vs_sma50: float,
        momentum_10d: float,
        trend_strength: float,
    ) -> MacroTrend:
        if (
            price_vs_sma50 >= 0.015
            and sma20_vs_sma50 >= 0.01
            and momentum_10d >= 0.008
            and trend_strength >= 0.45
        ):
            return "bullish"
        if (
            price_vs_sma50 <= -0.015
            and sma20_vs_sma50 <= -0.01
            and momentum_10d <= -0.008
            and trend_strength >= 0.4
        ):
            return "bearish"
        return "neutral"

    def _usd_strength(self, *, price_vs_sma50: float, momentum_10d: float) -> UsdStrength:
        if price_vs_sma50 >= 0.01 and momentum_10d >= 0.004:
            return "strong"
        if price_vs_sma50 <= -0.01 and momentum_10d <= -0.004:
            return "weak"
        return "neutral"

    def _normalize_interest_rate_effect(self, effect: str) -> InterestRateEffect:
        normalized = effect.strip().lower()
        if normalized in {"positive", "tailwind", "falling", "lower"}:
            return "positive"
        if normalized in {"negative", "headwind", "rising", "higher"}:
            return "negative"
        return "neutral"

    def _market_score(self, market_trend: MacroTrend) -> int:
        return {"bullish": 1, "neutral": 0, "bearish": -1}[market_trend]

    def _rate_score(self, rate_effect: InterestRateEffect) -> int:
        return {"positive": 1, "neutral": 0, "negative": -1}[rate_effect]

    def _usd_score(self, usd_strength: UsdStrength) -> int:
        return {"weak": 1, "neutral": 0, "strong": -1}[usd_strength]

    def _momentum(self, closes: Sequence[float], window: int) -> float:
        if len(closes) < window + 1:
            return 0.0
        base_price = closes[-(window + 1)]
        if base_price == 0:
            return 0.0
        return (closes[-1] - base_price) / base_price

    def _sma(self, values: Sequence[float], window: int) -> float:
        if len(values) < window:
            return values[-1]
        window_values = values[-window:]
        return sum(window_values) / len(window_values)

    def _relative_distance(self, current: float, reference: float) -> float:
        if reference == 0:
            return 0.0
        return (current - reference) / reference

    def _trend_strength(self, price_vs_sma50: float, sma20_vs_sma50: float) -> float:
        distance_strength = self._clamp(abs(price_vs_sma50) / 0.06, 0.0, 1.0)
        structure_strength = self._clamp(abs(sma20_vs_sma50) / 0.04, 0.0, 1.0)
        return (distance_strength * 0.55) + (structure_strength * 0.45)

    def _clamp(self, value: float, lower: float, upper: float) -> float:
        return max(lower, min(upper, value))
