from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
from math import isfinite, sqrt
from typing import Any, Sequence

from sqlalchemy.orm import Session

from app.core.exceptions import ExternalServiceError, NotFoundError, ValidationError
from app.schemas.analysis import (
    AnalysisAlert,
    AnalysisResponse,
    AnalysisSignals,
    DataQuality,
    Recommendation,
    RiskLevel,
    SignalQuality,
    SignalResult,
    Strategy,
    Timeframe,
)
from app.services.macro import MacroContextService, MacroSnapshot
from app.schemas.stocks import HistoryPoint
from app.services.cache import RequestDeduplicator, TTLCache
from app.services.market_data import MarketDataService
from app.services.news import NewsSentimentService, NewsSentimentSnapshot
from app.services.strategy_learning import StrategyLearningProfile, StrategyLearningService
from app.services.summary import SummaryService


MIN_HISTORY_POINTS = 60
MOMENTUM_LOOKBACK = 5
RSI_PERIOD = 14
VOLATILITY_WINDOW = 30
DRAWDOWN_WINDOW = 50
SUPPORT_WINDOW = 20
MAX_WARNINGS = 3
DEFAULT_BUY_BAND_THRESHOLD = 3.0
DEFAULT_SELL_BAND_THRESHOLD = -3.0
MIN_ACTIONABLE_BUY_SCORE = 3
MIN_ACTIONABLE_SELL_SCORE = -3
HIGH_UNCERTAINTY_VOLATILITY = 0.32
EXTREME_UNCERTAINTY_VOLATILITY = 0.40

logger = logging.getLogger(__name__)

SIGNAL_WEIGHTS: dict[str, float] = {
    "trend": 0.19,
    "sma_crossover": 0.13,
    "rsi": 0.09,
    "momentum": 0.18,
    "volatility": 0.09,
    "news_sentiment": 0.12,
    "trend_strength": 0.20,
}


@dataclass(frozen=True)
class DataQualityDecision:
    level: DataQuality
    reason: str
    can_run_strategy: bool


@dataclass(frozen=True)
class PreparedAnalysisInputs:
    context: dict[str, Any]
    macro_context: dict[str, Any]
    data_quality_decision: DataQualityDecision


@dataclass(frozen=True)
class StrategyThresholdConfig:
    buy_threshold: float = DEFAULT_BUY_BAND_THRESHOLD
    sell_threshold: float = DEFAULT_SELL_BAND_THRESHOLD


@dataclass(frozen=True)
class TradeFilterDecision:
    recommendation: Recommendation
    signal_quality: SignalQuality
    confidence: float
    block_reason: str | None = None


class AnalysisService:
    def __init__(
        self,
        market_data_service: MarketDataService,
        macro_context_service: MacroContextService,
        summary_service: SummaryService,
        news_sentiment_service: NewsSentimentService,
        strategy_learning_service: StrategyLearningService | None = None,
        analysis_cache_ttl_seconds: int = 90,
        indicator_cache_ttl_seconds: int = 60,
        alerts_cache_ttl_seconds: int = 60,
    ):
        self.market_data_service = market_data_service
        self.macro_context_service = macro_context_service
        self.summary_service = summary_service
        self.news_sentiment_service = news_sentiment_service
        self.strategy_learning_service = strategy_learning_service or StrategyLearningService()
        self.analysis_cache: TTLCache[AnalysisResponse] = TTLCache(analysis_cache_ttl_seconds)
        self.indicator_cache: TTLCache[PreparedAnalysisInputs] = TTLCache(
            indicator_cache_ttl_seconds
        )
        self.alerts_cache: TTLCache[list[AnalysisAlert]] = TTLCache(alerts_cache_ttl_seconds)
        self.request_deduper: RequestDeduplicator[AnalysisResponse | PreparedAnalysisInputs] = (
            RequestDeduplicator()
        )
        self.strategy_threshold_overrides: ContextVar[dict[str, StrategyThresholdConfig] | None] = (
            ContextVar("strategy_threshold_overrides", default=None)
        )
        self.strategy_thresholds: dict[Strategy, StrategyThresholdConfig] = {
            "simple": StrategyThresholdConfig(buy_threshold=3.0, sell_threshold=-3.0),
            "ai": StrategyThresholdConfig(buy_threshold=2.0, sell_threshold=-2.0),
            "hedgefund": StrategyThresholdConfig(buy_threshold=4.0, sell_threshold=-4.0),
        }

    def set_strategy_thresholds(
        self,
        *,
        strategy: Strategy | str,
        buy_threshold: float,
        sell_threshold: float,
    ) -> None:
        normalized_strategy = str(strategy).strip().lower()
        if normalized_strategy not in self.strategy_thresholds:
            return
        current = self.strategy_thresholds[normalized_strategy]
        updated = StrategyThresholdConfig(
            buy_threshold=round(float(buy_threshold), 2),
            sell_threshold=round(float(sell_threshold), 2),
        )
        self.strategy_thresholds[normalized_strategy] = updated
        if current != updated:
            self.analysis_cache.clear()
            self.alerts_cache.clear()

    def _thresholds_for(self, strategy: Strategy) -> StrategyThresholdConfig:
        overrides = self.strategy_threshold_overrides.get()
        if overrides is not None:
            override = overrides.get(str(strategy))
            if override is not None:
                return override
        return self.strategy_thresholds.get(strategy, StrategyThresholdConfig())

    def _effective_buy_threshold(self, strategy: Strategy) -> int:
        return max(
            MIN_ACTIONABLE_BUY_SCORE,
            int(round(self._thresholds_for(strategy).buy_threshold)),
        )

    def _effective_sell_threshold(self, strategy: Strategy) -> int:
        return min(
            MIN_ACTIONABLE_SELL_SCORE,
            int(round(self._thresholds_for(strategy).sell_threshold)),
        )

    @contextmanager
    def _temporary_threshold_override(
        self,
        *,
        strategy: Strategy,
        thresholds: StrategyThresholdConfig | None,
    ):
        if thresholds is None:
            yield
            return
        active = dict(self.strategy_threshold_overrides.get() or {})
        active[strategy] = thresholds
        token = self.strategy_threshold_overrides.set(active)
        try:
            yield
        finally:
            self.strategy_threshold_overrides.reset(token)

    def _learning_threshold_config(
        self,
        *,
        strategy: Strategy,
        profile: StrategyLearningProfile,
    ) -> StrategyThresholdConfig | None:
        thresholds = profile.effective_thresholds or profile.thresholds
        if thresholds is None:
            return None
        return StrategyThresholdConfig(
            buy_threshold=round(float(thresholds.buy_threshold), 2),
            sell_threshold=round(float(thresholds.sell_threshold), 2),
        )

    def analyze_symbol(
        self,
        symbol: str,
        force_refresh: bool = False,
        strategy: Strategy = "hedgefund",
        db: Session | None = None,
    ) -> AnalysisResponse:
        try:
            normalized_symbol = self.market_data_service.ensure_supported_symbol(symbol)
        except ValidationError:
            return self._no_data_response(
                symbol,
                "No sufficient data available.",
                strategy=strategy,
            )
        if db is not None:
            return self._load_analysis_response(
                normalized_symbol,
                force_refresh=force_refresh,
                strategy=strategy,
                db=db,
            )

        cache_key = self._analysis_cache_key(normalized_symbol, strategy)
        if force_refresh:
            self.analysis_cache.delete(cache_key)
        else:
            cached = self.analysis_cache.get(cache_key)
            if cached is not None:
                return cached

        def load_analysis() -> AnalysisResponse:
            cached_inner = self.analysis_cache.get(cache_key)
            if cached_inner is not None:
                return cached_inner
            response = self._load_analysis_response(
                normalized_symbol,
                force_refresh=force_refresh,
                strategy=strategy,
                db=None,
            )
            return self.analysis_cache.set(cache_key, response)

        return self.request_deduper.run(cache_key, load_analysis)

    def analyze(
        self,
        symbol: str,
        history: Sequence[HistoryPoint],
        strategy: Strategy = "hedgefund",
        db: Session | None = None,
    ) -> AnalysisResponse:
        normalized_symbol = symbol.strip().upper()
        prepared = self._prepare_analysis_inputs(normalized_symbol, history)
        return self._build_analysis_response(
            normalized_symbol,
            prepared,
            strategy=strategy,
            db=db,
        )

    def scan_alerts(
        self,
        *,
        strategy: Strategy = "hedgefund",
        symbols: Sequence[str] | None = None,
        force_refresh: bool = False,
        limit: int = 6,
        db: Session | None = None,
    ) -> list[AnalysisAlert]:
        universe = list(symbols or self.market_data_service.allowed_symbols.keys())
        if db is not None:
            force_refresh = force_refresh
        else:
            cache_key = self._alerts_cache_key(strategy=strategy, symbols=universe, limit=limit)
            if force_refresh:
                self.alerts_cache.delete(cache_key)
            else:
                cached = self.alerts_cache.get(cache_key)
                if cached is not None:
                    return cached
        alerts: list[AnalysisAlert] = []

        for symbol in universe:
            analysis = self.analyze_symbol(
                symbol,
                force_refresh=force_refresh,
                strategy=strategy,
                db=db,
            )
            if analysis.no_data or analysis.recommendation is None or analysis.signals is None:
                continue
            alerts.extend(self._alerts_from_analysis(analysis))

        alerts.sort(key=lambda item: (-item.priority, item.symbol, item.title))
        if db is None and len(alerts) <= limit:
            return self.alerts_cache.set(cache_key, alerts)
        if db is not None and len(alerts) <= limit:
            return alerts

        selected_keys: set[tuple[str, str, str]] = set()
        selected: list[AnalysisAlert] = []

        def include_first(predicate) -> None:
            for alert in alerts:
                key = (alert.symbol, alert.kind, alert.title)
                if key in selected_keys or not predicate(alert):
                    continue
                selected.append(alert)
                selected_keys.add(key)
                return

        include_first(lambda alert: alert.kind == "recommendation" and alert.tone == "bullish")
        include_first(lambda alert: alert.kind == "recommendation" and alert.tone == "bearish")
        include_first(lambda alert: alert.kind == "rsi")

        for alert in alerts:
            if len(selected) >= limit:
                break
            key = (alert.symbol, alert.kind, alert.title)
            if key in selected_keys:
                continue
            selected.append(alert)
            selected_keys.add(key)

        selected.sort(key=lambda item: (-item.priority, item.symbol, item.title))
        if db is not None:
            return selected[:limit]
        return self.alerts_cache.set(cache_key, selected[:limit])

    def _load_analysis_response(
        self,
        symbol: str,
        *,
        force_refresh: bool,
        strategy: Strategy,
        db: Session | None,
    ) -> AnalysisResponse:
        try:
            history = self.market_data_service.get_history(symbol, "1y", force_refresh=force_refresh)
            if len(history) < MIN_HISTORY_POINTS:
                return self._no_data_response(
                    symbol,
                    f"Not enough market history for a meaningful analysis: only {len(history)} daily closes are available.",
                    strategy=strategy,
                )
            prepared = self._get_prepared_inputs(
                symbol,
                history,
                force_refresh=force_refresh,
            )
            return self._build_analysis_response(
                symbol,
                prepared,
                strategy=strategy,
                db=db,
            )
        except NotFoundError as error:
            return self._no_data_response(
                symbol,
                error.message,
                strategy=strategy,
            )
        except ExternalServiceError as error:
            message = error.message.rstrip(".")
            return self._no_data_response(
                symbol,
                f"{message}.",
                strategy=strategy,
            )
        except ValidationError:
            return self._no_data_response(
                symbol,
                "No sufficient data available.",
                strategy=strategy,
            )

    def _analysis_cache_key(self, symbol: str, strategy: Strategy) -> str:
        return f"analysis:{strategy}:{symbol}"

    def _prepared_inputs_cache_key(self, symbol: str) -> str:
        return f"prepared:{symbol}"

    def _alerts_cache_key(
        self, *, strategy: Strategy, symbols: Sequence[str], limit: int
    ) -> str:
        return f"alerts:{strategy}:{limit}:{','.join(symbols)}"

    def prime_symbol(self, symbol: str, force_refresh: bool = False) -> None:
        normalized_symbol = self.market_data_service.ensure_supported_symbol(symbol)
        history = self.market_data_service.get_history(
            normalized_symbol,
            "1y",
            force_refresh=force_refresh,
        )
        if len(history) < MIN_HISTORY_POINTS:
            return
        self._get_prepared_inputs(normalized_symbol, history, force_refresh=force_refresh)

    def _get_prepared_inputs(
        self,
        symbol: str,
        history: Sequence[HistoryPoint],
        *,
        force_refresh: bool = False,
    ) -> PreparedAnalysisInputs:
        cache_key = self._prepared_inputs_cache_key(symbol)
        if force_refresh:
            self.indicator_cache.delete(cache_key)
        else:
            cached = self.indicator_cache.get(cache_key)
            if cached is not None:
                return cached

        def build_prepared() -> PreparedAnalysisInputs:
            cached_inner = self.indicator_cache.get(cache_key)
            if cached_inner is not None:
                return cached_inner
            prepared = self._prepare_analysis_inputs(symbol, history)
            return self.indicator_cache.set(cache_key, prepared)

        return self.request_deduper.run(cache_key, build_prepared)

    def _prepare_analysis_inputs(
        self, symbol: str, history: Sequence[HistoryPoint]
    ) -> PreparedAnalysisInputs:
        normalized_symbol = symbol.strip().upper()
        closes = [point.close for point in history]
        volumes = [max(point.volume, 0) for point in history]
        if len(closes) < MIN_HISTORY_POINTS:
            raise ValidationError(
                "At least 60 daily closes are required to build an analysis view."
            )

        latest_price = closes[-1]
        sma20 = self._sma(closes, min(20, len(closes)))
        sma50 = self._sma(closes, min(50, len(closes)))
        sma200 = self._sma(closes, min(200, len(closes)))
        rsi14 = self._rsi(closes, RSI_PERIOD)
        momentum_5d = self._momentum(closes, MOMENTUM_LOOKBACK)
        volatility_30d = self._volatility(closes, VOLATILITY_WINDOW)
        max_drawdown = self._max_drawdown(closes[-DRAWDOWN_WINDOW:])
        support_level = min(closes[-SUPPORT_WINDOW:])
        support_distance = ((latest_price - support_level) / latest_price) if latest_price else 0.0
        price_vs_sma50 = ((latest_price - sma50) / sma50) if sma50 else 0.0
        sma20_vs_sma50 = ((sma20 - sma50) / sma50) if sma50 else 0.0
        avg_volume_20 = self._average_volume(volumes, min(20, len(volumes)))
        latest_volume = volumes[-1] if volumes else 0
        volume_ratio = (latest_volume / avg_volume_20) if avg_volume_20 else 1.0

        news_snapshot = self.news_sentiment_service.get_sentiment(normalized_symbol)
        macro_snapshot = self.macro_context_service.get_context_for_symbol(normalized_symbol)
        macro_context = macro_snapshot.to_context()

        signal_map = {
            "trend": self._trend_signal(sma50, price_vs_sma50),
            "sma_crossover": self._crossover_signal(sma20, sma50, sma20_vs_sma50),
            "rsi": self._rsi_signal(rsi14),
            "momentum": self._momentum_signal(momentum_5d),
            "volatility": self._volatility_signal(volatility_30d),
            "news_sentiment": self._news_signal(news_snapshot),
            "trend_strength": self._trend_strength_signal(price_vs_sma50, sma20_vs_sma50),
        }
        signals = AnalysisSignals(**signal_map)
        drawdown_risk = self._drawdown_risk(
            support_distance=support_distance,
            volatility_30d=volatility_30d,
            max_drawdown=max_drawdown,
        )
        factor_scores = self._factor_scores(
            latest_price=latest_price,
            sma50=sma50,
            sma200=sma200,
            rsi14=rsi14,
            momentum_5d=momentum_5d,
            volatility_30d=volatility_30d,
            news_snapshot=news_snapshot,
        )
        data_quality_decision = self._evaluate_data_quality(
            latest_price=latest_price,
            sma50=sma50,
            sma200=sma200,
            rsi14=rsi14,
            momentum_5d=momentum_5d,
            volatility_30d=volatility_30d,
            news_snapshot=news_snapshot,
        )
        context = {
            "symbol": normalized_symbol,
            "latest_price": latest_price,
            "sma20": sma20,
            "sma50": sma50,
            "sma200": sma200,
            "rsi14": rsi14,
            "momentum_5d": momentum_5d,
            "volatility_30d": volatility_30d,
            "news_snapshot": news_snapshot,
            "drawdown_risk": drawdown_risk,
            "price_vs_sma50": price_vs_sma50,
            "price_vs_sma200": ((latest_price - sma200) / sma200) if sma200 else 0.0,
            "sma20_vs_sma50": sma20_vs_sma50,
            "support_level": support_level,
            "latest_volume": latest_volume,
            "avg_volume_20": avg_volume_20,
            "volume_ratio": volume_ratio,
            "factor_scores": factor_scores,
            "signal_map": signal_map,
            "signals": signals,
            "base_data_quality_decision": data_quality_decision,
        }
        return PreparedAnalysisInputs(
            context=context,
            macro_context=macro_context,
            data_quality_decision=data_quality_decision,
        )

    def _build_analysis_response(
        self,
        symbol: str,
        prepared: PreparedAnalysisInputs,
        *,
        strategy: Strategy,
        db: Session | None = None,
    ) -> AnalysisResponse:
        normalized_symbol = symbol.strip().upper()
        context = prepared.context
        base_data_quality_decision = prepared.data_quality_decision
        if not base_data_quality_decision.can_run_strategy:
            return self._no_data_response(
                normalized_symbol,
                base_data_quality_decision.reason,
                strategy=strategy,
            )

        learning_profile = (
            self.strategy_learning_service.get_profile(db, strategy)
            if db is not None
            else self.strategy_learning_service.inactive_profile(strategy)
        )
        learning_thresholds = self._learning_threshold_config(
            strategy=strategy,
            profile=learning_profile,
        )
        with self._temporary_threshold_override(
            strategy=strategy,
            thresholds=learning_thresholds,
        ):
            decision = self._strategy_decision(strategy, context)
            data_quality_decision = self._refine_data_quality_for_signals(
                strategy=strategy,
                score=int(decision["score"]),
                conflicts=decision["conflicts"],
                recommendation=decision["recommendation"],
                base_decision=base_data_quality_decision,
            )
            data_quality = data_quality_decision.level
            data_quality_reason = data_quality_decision.reason
            decision["score"] = self._apply_learning_score_adjustment(
                strategy=strategy,
                score=int(decision["score"]),
                profile=learning_profile,
            )
            decision["score"] = self._clamp_normalized_score(int(decision["score"]))
            decision["score_band"] = int(decision["score"])
            decision["recommendation"] = self._recommendation_for_strategy(
                strategy=strategy,
                score_band=int(decision["score_band"]),
                context=context,
            )
            decision["signal_quality"] = self._signal_quality_for_strategy(
                strategy=strategy,
                score=int(decision["score"]),
                recommendation=decision["recommendation"],
                data_quality=data_quality,
                conflicts=decision["conflicts"],
            )
            decision["risk_level"] = self._risk_level_for_strategy(
                strategy=strategy,
                score=int(decision["score"]),
                volatility_30d=context["volatility_30d"],
                conflicts=decision["conflicts"],
            )
            confidence = self._confidence_for_strategy(
                strategy=strategy,
                score=int(decision["score"]),
                risk_level=decision["risk_level"],
                conflicts=decision["conflicts"],
            )
            decision["confidence"] = self._apply_data_quality_to_confidence(
                confidence,
                data_quality,
            )
            decision["confidence"] = self._apply_learning_confidence_adjustment(
                confidence=float(decision["confidence"]),
                profile=learning_profile,
            )
            trade_filter = self._trade_filter_decision(
                strategy=strategy,
                recommendation=decision["recommendation"],
                score=int(decision["score"]),
                signal_quality=decision["signal_quality"],
                confidence=float(decision["confidence"]),
                risk_level=decision["risk_level"],
                context=context,
                conflicts=decision["conflicts"],
            )
            decision["recommendation"] = trade_filter.recommendation
            decision["signal_quality"] = trade_filter.signal_quality
            decision["confidence"] = trade_filter.confidence
            decision["reason"] = self._strategy_reason(
                strategy=strategy,
                context=context,
                recommendation=decision["recommendation"],
                score=int(decision["score"]),
                confidence=float(decision["confidence"]),
            )
            if trade_filter.block_reason:
                decision["reason"] = (
                    f"HOLD because {trade_filter.block_reason}. "
                    f"Confidence {float(decision['confidence']):.0f}/100."
                )
            probability_up = self._probability_from_strategy_score(
                strategy=strategy,
                score=decision["score"],
                recommendation=decision["recommendation"],
            )
        probability_down = round(1 - probability_up, 4)
        timeframe = self._timeframe(
            signal_map=context["signal_map"],
            momentum_5d=context["momentum_5d"],
            price_vs_sma50=context["price_vs_sma50"],
            sma20_vs_sma50=context["sma20_vs_sma50"],
        )
        warnings = self._strategy_warnings(
            strategy=strategy,
            rsi14=context["rsi14"],
            volatility_30d=context["volatility_30d"],
            news_snapshot=context["news_snapshot"],
            conflicts=decision["conflicts"],
            drawdown_risk=context["drawdown_risk"],
            confidence=decision["confidence"],
            risk_level=decision["risk_level"],
            score=decision["score"],
        )
        entry_signal, entry_reason = self._entry_decision_for_strategy(
            recommendation=decision["recommendation"],
            signal_quality=decision["signal_quality"],
            risk_level=decision["risk_level"],
            confidence=decision["confidence"],
            score=decision["score"],
        )
        exit_signal, exit_reason = self._exit_decision_for_strategy(
            recommendation=decision["recommendation"],
            signal_quality=decision["signal_quality"],
            risk_level=decision["risk_level"],
            score=decision["score"],
            warnings=warnings,
        )
        stop_loss_level, stop_loss_reason = self._stop_loss(
            latest_price=context["latest_price"],
            sma50=context["sma50"],
            support_level=context["support_level"],
            volatility_30d=context["volatility_30d"],
        )
        position_size_percent, position_size_reason = self._position_size_for_strategy(
            entry_signal=entry_signal,
            recommendation=decision["recommendation"],
            signal_quality=decision["signal_quality"],
            risk_level=decision["risk_level"],
            confidence=decision["confidence"],
        )
        summary = decision["reason"]

        no_trade = decision["recommendation"] == "HOLD" and decision["signal_quality"] == "PARTIAL"
        no_trade_reason = "Trade evaluation available."
        if no_trade:
            no_trade_reason = (
                f"{trade_filter.block_reason.capitalize()}."
                if trade_filter.block_reason
                else "The setup is only partially confirmed."
            )

        return AnalysisResponse(
            symbol=normalized_symbol,
            strategy=strategy,
            no_data=False,
            no_data_reason=None,
            recommendation=decision["recommendation"],
            signal_quality=decision["signal_quality"],
            score=decision["score"],
            probability_up=probability_up,
            probability_down=probability_down,
            confidence=decision["confidence"],
            risk_level=decision["risk_level"],
            data_quality=data_quality,
            data_quality_reason=data_quality_reason,
            macro=prepared.macro_context,
            no_trade=no_trade,
            no_trade_reason=no_trade_reason,
            entry_signal=entry_signal,
            entry_reason=entry_reason,
            exit_signal=exit_signal,
            exit_reason=exit_reason,
            stop_loss_level=stop_loss_level,
            stop_loss_reason=stop_loss_reason,
            position_size_percent=position_size_percent,
            position_size_reason=position_size_reason,
            timeframe=timeframe,
            warnings=warnings,
            summary=summary,
            generated_at=datetime.now(timezone.utc),
            signals=context["signals"],
            learning=learning_profile.to_learning_insight(),
        )

    def _alerts_from_analysis(self, analysis: AnalysisResponse) -> list[AnalysisAlert]:
        alerts: list[AnalysisAlert] = []
        symbol = analysis.symbol
        confidence = int(round(float(analysis.confidence or 0)))
        rsi_value = analysis.signals.rsi.value

        if analysis.recommendation == "BUY" and analysis.signal_quality == "FULL" and not analysis.no_trade:
            alerts.append(
                AnalysisAlert(
                    symbol=symbol,
                    strategy=analysis.strategy,
                    kind="recommendation",
                    tone="bullish",
                    title=f"{symbol} is now BUY",
                    message=f"{symbol} shows a buy setup with {confidence}% confidence.",
                    priority=100 + confidence,
                )
            )
        elif analysis.recommendation == "SELL" and analysis.signal_quality == "FULL" and not analysis.no_trade:
            alerts.append(
                AnalysisAlert(
                    symbol=symbol,
                    strategy=analysis.strategy,
                    kind="recommendation",
                    tone="bearish",
                    title=f"{symbol} is now SELL",
                    message=f"{symbol} shows a sell setup with {confidence}% confidence.",
                    priority=100 + confidence,
                )
            )

        if rsi_value < 30:
            alerts.append(
                AnalysisAlert(
                    symbol=symbol,
                    strategy=analysis.strategy,
                    kind="rsi",
                    tone="bullish",
                    title=f"{symbol} RSI below 30",
                    message=f"Oversold at RSI {rsi_value:.1f}. Bounce potential is building.",
                    priority=80 + int(round(30 - rsi_value)),
                )
            )
        elif rsi_value > 70:
            alerts.append(
                AnalysisAlert(
                    symbol=symbol,
                    strategy=analysis.strategy,
                    kind="rsi",
                    tone="bearish",
                    title=f"{symbol} RSI above 70",
                    message=f"Overbought at RSI {rsi_value:.1f}. Pullback risk is elevated.",
                    priority=80 + int(round(rsi_value - 70)),
                )
            )

        if analysis.entry_signal:
            alerts.append(
                AnalysisAlert(
                    symbol=symbol,
                    strategy=analysis.strategy,
                    kind="entry",
                    tone="bullish",
                    title=f"{symbol} entry confirmed",
                    message=analysis.entry_reason,
                    priority=70 + confidence,
                )
            )

        if analysis.exit_signal:
            alerts.append(
                AnalysisAlert(
                    symbol=symbol,
                    strategy=analysis.strategy,
                    kind="exit",
                    tone="bearish",
                    title=f"{symbol} exit signal active",
                    message=analysis.exit_reason,
                    priority=70 + confidence,
                )
            )

        return alerts

    def _evaluate_data_quality(
        self,
        *,
        latest_price: float,
        sma50: float,
        sma200: float,
        rsi14: float,
        momentum_5d: float,
        volatility_30d: float,
        news_snapshot: NewsSentimentSnapshot,
    ) -> DataQualityDecision:
        core_inputs = {
            "price": isfinite(latest_price) and latest_price > 0,
            "sma": all(isfinite(value) and value > 0 for value in (sma50, sma200)),
            "rsi": isfinite(rsi14),
            "momentum": isfinite(momentum_5d),
            "news/sentiment": news_snapshot.article_count > 0,
        }
        supplemental_inputs = {
            "volatility": isfinite(volatility_30d),
        }
        core_available_count = sum(1 for available in core_inputs.values() if available)
        core_missing = [name for name, available in core_inputs.items() if not available]
        has_market_structure = core_inputs["price"] and core_inputs["sma"]
        has_full_core = core_available_count == len(core_inputs)

        if has_full_core:
            if supplemental_inputs["volatility"]:
                return DataQualityDecision(
                    level="FULL",
                    reason="Full data quality: all 5/5 core inputs are available.",
                    can_run_strategy=True,
                )
            return DataQualityDecision(
                level="FULL",
                reason=(
                    "Full data quality: all 5/5 core inputs are available. "
                    "Volatility is missing, so risk handling stays conservative."
                ),
                can_run_strategy=True,
            )

        if has_market_structure and core_available_count >= 3:
            return DataQualityDecision(
                level="PARTIAL",
                reason=(
                    f"Partial data quality: {core_available_count}/5 core inputs are available. "
                    f"Missing {', '.join(core_missing)}."
                ),
                can_run_strategy=True,
            )

        missing = ", ".join(core_missing) or "core market inputs"
        if not has_market_structure:
            return DataQualityDecision(
                level="NO_DATA",
                reason=(
                    f"Not enough data for meaningful analysis: only {core_available_count}/5 core inputs are available. "
                    f"Missing {missing}."
                ),
                can_run_strategy=False,
            )

        return DataQualityDecision(
            level="NO_DATA",
            reason=(
                f"Not enough data for meaningful analysis: only {core_available_count}/5 core inputs are available. "
                f"Missing {missing}."
            ),
            can_run_strategy=False,
        )

    def _refine_data_quality_for_signals(
        self,
        *,
        strategy: Strategy,
        score: int,
        conflicts: Sequence[str],
        recommendation: Recommendation,
        base_decision: DataQualityDecision,
    ) -> DataQualityDecision:
        if base_decision.level == "NO_DATA":
            return base_decision

        partial_reasons: list[str] = []
        strong_conflicts = self._strong_conflicts(conflicts)

        if strong_conflicts:
            partial_reasons.append("strong indicator conflicts are present")
        elif conflicts:
            partial_reasons.append("signals are conflicting")

        buy_threshold = self._effective_buy_threshold(strategy)
        sell_threshold = self._effective_sell_threshold(strategy)
        if sell_threshold < score < buy_threshold:
            partial_reasons.append("the score is still near its trade threshold")

        if recommendation == "HOLD" and abs(score) > 0:
            partial_reasons.append("the setup is not clean enough for a full-strength signal")

        if not partial_reasons:
            return base_decision

        reason_prefix = base_decision.reason
        if base_decision.level == "FULL":
            reason_prefix = "Partial data quality: core inputs are available, but signal quality is mixed."

        return DataQualityDecision(
            level="PARTIAL",
            reason=f"{reason_prefix} Confidence is reduced because {' and '.join(partial_reasons)}.",
            can_run_strategy=True,
        )

    def _apply_data_quality_to_confidence(
        self, confidence: float, data_quality: DataQuality
    ) -> float:
        if data_quality == "NO_DATA":
            return 0.0
        if data_quality == "FULL":
            return round(self._clamp(confidence, 20, 95), 1)

        normalized = self._clamp(confidence / 100, 0.0, 1.0)
        reduction_factor = 0.5 + (normalized * 0.2)
        reduced = confidence * reduction_factor
        return round(self._clamp(reduced, 12, 70), 1)

    def _signal_quality_for_strategy(
        self,
        *,
        strategy: Strategy,
        score: int,
        recommendation: Recommendation,
        data_quality: DataQuality,
        conflicts: Sequence[str],
    ) -> SignalQuality:
        buy_threshold = self._effective_buy_threshold(strategy)
        sell_threshold = self._effective_sell_threshold(strategy)
        near_buy = (buy_threshold - 1) <= score < buy_threshold
        near_sell = (sell_threshold + 1) >= score > sell_threshold

        if recommendation in {"BUY", "SELL"}:
            if data_quality == "FULL" and not conflicts:
                return "FULL"
            return "PARTIAL"

        if data_quality == "PARTIAL" or conflicts or near_buy or near_sell:
            return "PARTIAL"
        return "FULL"

    def _strategy_decision(self, strategy: Strategy, context: dict) -> dict[str, object]:
        if strategy == "simple":
            return self._simple_strategy(context)
        if strategy == "ai":
            return self._ai_strategy(context)
        return self._hedgefund_strategy(context)

    def _score_band(self, strategy: Strategy, score: float) -> int:
        if strategy == "simple":
            return int(self._clamp(round(score), -5, 5))
        divisor = 10 if strategy == "ai" else 18
        return int(self._clamp(round(score / divisor), -5, 5))

    def _clamp_normalized_score(self, score: float) -> int:
        return int(self._clamp(round(score), -5, 5))

    def _apply_conflict_score_damping(
        self,
        *,
        strategy: Strategy,
        raw_score: int,
        conflicts: Sequence[str],
    ) -> int:
        thresholds = self._thresholds_for(strategy)
        if not conflicts or raw_score == 0:
            return raw_score

        strong_conflicts = self._strong_conflicts(conflicts)
        if strategy == "simple":
            if abs(raw_score) < thresholds.buy_threshold and not strong_conflicts:
                return raw_score
            penalty = min(len(conflicts) + len(strong_conflicts), 3)
        elif strategy == "ai":
            penalty = min((len(conflicts) * 5) + (len(strong_conflicts) * 2), 16)
        else:
            penalty = min((len(conflicts) * 6) + (len(strong_conflicts) * 3), 21)

        if strategy == "simple" and strong_conflicts and abs(raw_score) <= thresholds.buy_threshold:
            penalty = max(penalty, abs(raw_score))

        if raw_score > 0:
            return max(0, raw_score - penalty)
        return min(0, raw_score + penalty)

    def _apply_score_data_quality_damping(
        self,
        *,
        score: int,
        data_quality: DataQuality,
    ) -> int:
        if data_quality == "NO_DATA":
            return 0
        if data_quality == "PARTIAL":
            return int(round(score * 0.7))
        return score

    def _recommendation_from_score_band(
        self,
        strategy: Strategy,
        score_band: int,
    ) -> Recommendation:
        buy_threshold = self._effective_buy_threshold(strategy)
        sell_threshold = self._effective_sell_threshold(strategy)
        if score_band >= buy_threshold:
            return "BUY"
        if score_band <= sell_threshold:
            return "SELL"
        return "HOLD"

    def _recommendation_for_strategy(
        self,
        *,
        strategy: Strategy,
        score_band: int,
        context: dict[str, Any],
    ) -> Recommendation:
        if strategy != "hedgefund":
            return self._recommendation_from_score_band(strategy, score_band)

        buy_threshold = self._effective_buy_threshold(strategy)
        sell_threshold = self._effective_sell_threshold(strategy)
        trend_up = context["latest_price"] > context["sma200"]
        trend_down = context["latest_price"] < context["sma200"]
        momentum_up = context["momentum_5d"] > 0
        momentum_down = context["momentum_5d"] < 0

        if trend_up:
            return "BUY" if score_band >= buy_threshold and momentum_up else "HOLD"
        if trend_down:
            return "SELL" if score_band <= sell_threshold and momentum_down else "HOLD"
        return "HOLD"

    def _aligned_factor_count(
        self,
        *,
        recommendation: Recommendation,
        signal_map: dict[str, SignalResult],
    ) -> int:
        if recommendation == "BUY":
            checks = [
                signal_map["trend"].probability_impact >= 0.20,
                signal_map["sma_crossover"].probability_impact >= 0.15,
                signal_map["rsi"].probability_impact >= 0.10,
                signal_map["momentum"].probability_impact >= 0.15,
                signal_map["news_sentiment"].probability_impact >= 0.20,
                signal_map["trend_strength"].probability_impact >= 0.20,
            ]
        elif recommendation == "SELL":
            checks = [
                signal_map["trend"].probability_impact <= -0.20,
                signal_map["sma_crossover"].probability_impact <= -0.15,
                signal_map["rsi"].probability_impact <= -0.10,
                signal_map["momentum"].probability_impact <= -0.15,
                signal_map["news_sentiment"].probability_impact <= -0.20,
                signal_map["trend_strength"].probability_impact <= -0.20,
            ]
        else:
            return 0
        return sum(1 for passed in checks if passed)

    def _core_directional_confirmation(
        self,
        *,
        recommendation: Recommendation,
        signal_map: dict[str, SignalResult],
    ) -> bool:
        if recommendation == "BUY":
            return any(
                (
                    signal_map["trend"].probability_impact >= 0.20,
                    signal_map["momentum"].probability_impact >= 0.15,
                    signal_map["trend_strength"].probability_impact >= 0.20,
                )
            )
        if recommendation == "SELL":
            return any(
                (
                    signal_map["trend"].probability_impact <= -0.20,
                    signal_map["momentum"].probability_impact <= -0.15,
                    signal_map["trend_strength"].probability_impact <= -0.20,
                )
            )
        return False

    def _opposing_factor_count(
        self,
        *,
        recommendation: Recommendation,
        signal_map: dict[str, SignalResult],
    ) -> int:
        if recommendation == "BUY":
            return self._aligned_factor_count(recommendation="SELL", signal_map=signal_map)
        if recommendation == "SELL":
            return self._aligned_factor_count(recommendation="BUY", signal_map=signal_map)
        return 0

    def _trade_filter_decision(
        self,
        *,
        strategy: Strategy,
        recommendation: Recommendation,
        score: int,
        signal_quality: SignalQuality,
        confidence: float,
        risk_level: RiskLevel,
        context: dict[str, Any],
        conflicts: Sequence[str],
    ) -> TradeFilterDecision:
        if recommendation == "HOLD":
            return TradeFilterDecision(
                recommendation=recommendation,
                signal_quality=signal_quality,
                confidence=confidence,
            )

        signal_map: dict[str, SignalResult] = context["signal_map"]
        aligned_count = self._aligned_factor_count(
            recommendation=recommendation,
            signal_map=signal_map,
        )
        opposing_count = self._opposing_factor_count(
            recommendation=recommendation,
            signal_map=signal_map,
        )
        strong_conflicts = self._strong_conflicts(conflicts)
        strong_downtrend = (
            context["latest_price"] < context["sma200"]
            and signal_map["trend"].probability_impact <= -0.25
            and signal_map["trend_strength"].probability_impact <= -0.20
        )
        strong_uptrend = (
            context["latest_price"] > context["sma200"]
            and signal_map["trend"].probability_impact >= 0.25
            and signal_map["trend_strength"].probability_impact >= 0.20
        )

        block_reason: str | None = None
        if recommendation == "BUY" and score < MIN_ACTIONABLE_BUY_SCORE:
            block_reason = "the score is below the minimum buy threshold"
        elif recommendation == "SELL" and score > MIN_ACTIONABLE_SELL_SCORE:
            block_reason = "the score is above the minimum sell threshold"
        elif aligned_count < 2:
            block_reason = "fewer than two factors confirm the signal"
        elif recommendation == "SELL" and not self._core_directional_confirmation(
            recommendation="SELL",
            signal_map=signal_map,
        ):
            block_reason = "the sell setup lacks clear bearish confirmation"
        elif strong_conflicts or (conflicts and opposing_count >= 2):
            block_reason = "signals are conflicting, so the setup is not clean enough"
        elif recommendation == "BUY" and strong_downtrend:
            block_reason = "the market is still in a strong downtrend"
        elif recommendation == "SELL" and strong_uptrend:
            block_reason = "the market is still in a strong uptrend"
        elif context["volatility_30d"] >= EXTREME_UNCERTAINTY_VOLATILITY:
            block_reason = "volatility is too high for a reliable trade"
        elif (
            context["volatility_30d"] >= HIGH_UNCERTAINTY_VOLATILITY
            and (risk_level == "HIGH" or aligned_count < 3)
        ):
            block_reason = "volatility is high and uncertainty is elevated"

        if block_reason is None:
            return TradeFilterDecision(
                recommendation=recommendation,
                signal_quality=signal_quality,
                confidence=confidence,
            )

        return TradeFilterDecision(
            recommendation="HOLD",
            signal_quality="PARTIAL",
            confidence=round(min(confidence, 49.0), 1),
            block_reason=block_reason,
        )

    def _apply_learning_score_adjustment(
        self,
        *,
        strategy: Strategy,
        score: int,
        profile: StrategyLearningProfile,
    ) -> int:
        if not profile.eligible or score == 0:
            return score

        adjusted_score = score
        weak_signal_cutoff = self._weak_signal_cutoff(strategy)
        if abs(adjusted_score) <= weak_signal_cutoff:
            adjusted_score = int(round(adjusted_score * profile.weak_signal_multiplier))

        if profile.directional_bias > 0:
            bias_points = int(round(profile.directional_bias))
            adjusted_score = adjusted_score + (bias_points if adjusted_score > 0 else -bias_points)
        elif profile.directional_bias < 0:
            adjusted_score = self._pull_score_toward_zero(
                adjusted_score,
                abs(int(round(profile.directional_bias))),
            )

        return adjusted_score

    def _apply_learning_confidence_adjustment(
        self,
        *,
        confidence: float,
        profile: StrategyLearningProfile,
    ) -> float:
        if not profile.eligible:
            return confidence
        return round(self._clamp(confidence + profile.confidence_bias, 0.0, 100.0), 1)

    def _weak_signal_cutoff(self, strategy: Strategy) -> int:
        thresholds = self._thresholds_for(strategy)
        return max(1, int(round(abs(thresholds.buy_threshold) - 1)))

    def _pull_score_toward_zero(self, score: int, amount: int) -> int:
        if score == 0 or amount <= 0:
            return score
        if score > 0:
            return max(0, score - amount)
        return min(0, score + amount)

    def _log_score_distribution(
        self,
        *,
        strategy: Strategy,
        symbol: str,
        raw_score: int,
        adjusted_score: int,
        score_band: int,
        data_quality: DataQuality,
        conflicts: Sequence[str],
    ) -> None:
        logger.info(
            "score_distribution strategy=%s symbol=%s raw_score=%s adjusted_score=%s band=%s data_quality=%s conflicts=%s",
            strategy,
            symbol,
            raw_score,
            adjusted_score,
            score_band,
            data_quality,
            ",".join(conflicts) if conflicts else "none",
        )

    def _strategy_reason(
        self,
        *,
        strategy: Strategy,
        context: dict,
        recommendation: Recommendation,
        score: int,
        confidence: float,
    ) -> str:
        if strategy == "simple":
            return self._simple_strategy_reason(
                recommendation=recommendation,
                signal_scores={
                    "trend": 1 if context["latest_price"] >= context["sma50"] else -1,
                    "rsi": 1 if context["rsi14"] < 30 else -1 if context["rsi14"] > 70 else 0,
                    "momentum": 1 if context["momentum_5d"] > 0 else -1 if context["momentum_5d"] < 0 else 0,
                    "news": 1
                    if context["news_snapshot"].article_count and context["news_snapshot"].news_score > 0.15
                    else -1
                    if context["news_snapshot"].article_count and context["news_snapshot"].news_score < -0.15
                    else 0,
                },
                confidence=confidence,
            )
        if strategy == "ai":
            return self._weighted_strategy_reason(
                recommendation=recommendation,
                signal_scores=self._ai_signal_scores(context["factor_scores"]),
                confidence=confidence,
                label="AI",
            )
        return self._hedgefund_strategy_reason(
            recommendation=recommendation,
            score=score,
            confidence=confidence,
            trend_up=context["latest_price"] > context["sma200"],
            momentum_up=context["momentum_5d"] > 0,
            momentum_down=context["momentum_5d"] < 0,
            signal_scores=context["factor_scores"],
        )

    def _simple_strategy(self, context: dict) -> dict[str, object]:
        news_snapshot: NewsSentimentSnapshot = context["news_snapshot"]
        signal_scores = {
            "trend": 1 if context["latest_price"] >= context["sma50"] else -1,
            "rsi": 1 if context["rsi14"] < 30 else -1 if context["rsi14"] > 70 else 0,
            "momentum": 1 if context["momentum_5d"] > 0 else -1 if context["momentum_5d"] < 0 else 0,
            "news": 1
            if news_snapshot.article_count and news_snapshot.news_score > 0.15
            else -1
            if news_snapshot.article_count and news_snapshot.news_score < -0.15
            else 0,
        }
        raw_score = sum(signal_scores.values())
        initial_band = self._score_band("simple", raw_score)
        trade_quality_conflicts = self._trade_quality_conflicts(
            recommendation=self._recommendation_from_score_band("simple", initial_band),
            context=context,
            signal_scores=signal_scores,
        )
        conflicts = self._simple_conflicts(signal_scores) + trade_quality_conflicts
        conflicts = list(dict.fromkeys(conflicts))[:4]
        provisional_recommendation = self._recommendation_from_score_band("simple", initial_band)
        provisional_data_quality = self._refine_data_quality_for_signals(
            strategy="simple",
            score=initial_band,
            conflicts=conflicts,
            recommendation=provisional_recommendation,
            base_decision=context["base_data_quality_decision"],
        )
        adjusted_score = self._apply_conflict_score_damping(
            strategy="simple",
            raw_score=raw_score,
            conflicts=conflicts,
        )
        adjusted_score = self._apply_score_data_quality_damping(
            score=adjusted_score,
            data_quality=context["base_data_quality_decision"].level,
        )
        normalized_score = self._score_band("simple", adjusted_score)
        recommendation: Recommendation = self._recommendation_from_score_band(
            "simple", normalized_score
        )
        risk_level = self._simple_strategy_risk(
            score=adjusted_score,
            volatility_30d=context["volatility_30d"],
            conflicts=conflicts,
        )
        confidence = self._simple_strategy_confidence(
            score=adjusted_score,
            risk_level=risk_level,
            conflicts=conflicts,
        )
        reason = self._simple_strategy_reason(
            recommendation=recommendation,
            signal_scores=signal_scores,
            confidence=confidence,
        )
        self._log_score_distribution(
            strategy="simple",
            symbol=context["symbol"],
            raw_score=raw_score,
            adjusted_score=adjusted_score,
            score_band=normalized_score,
            data_quality=provisional_data_quality.level,
            conflicts=conflicts,
        )
        return {
            "recommendation": recommendation,
            "score": normalized_score,
            "score_band": normalized_score,
            "confidence": confidence,
            "risk_level": risk_level,
            "reason": reason,
            "conflicts": conflicts,
        }

    def _ai_strategy(self, context: dict) -> dict[str, object]:
        signal_scores = self._ai_signal_scores(context["factor_scores"])
        raw_score = self._total_score(signal_scores)
        initial_band = self._score_band("ai", raw_score)
        candidate: Recommendation = self._recommendation_from_score_band("ai", initial_band)
        trade_quality_conflicts = self._trade_quality_conflicts(
            recommendation=candidate,
            context=context,
            signal_scores=signal_scores,
        )
        conflicts = self._simple_conflicts(signal_scores) + trade_quality_conflicts
        conflicts = list(dict.fromkeys(conflicts))[:4]
        provisional_data_quality = self._refine_data_quality_for_signals(
            strategy="ai",
            score=initial_band,
            conflicts=conflicts,
            recommendation=candidate,
            base_decision=context["base_data_quality_decision"],
        )
        adjusted_score = self._apply_conflict_score_damping(
            strategy="ai",
            raw_score=raw_score,
            conflicts=conflicts,
        )
        adjusted_score = self._apply_score_data_quality_damping(
            score=adjusted_score,
            data_quality=context["base_data_quality_decision"].level,
        )
        normalized_score = self._score_band("ai", adjusted_score)
        recommendation: Recommendation = self._recommendation_from_score_band(
            "ai", normalized_score
        )
        risk_level = self._weighted_strategy_risk(
            score=adjusted_score,
            volatility_30d=context["volatility_30d"],
            conflicts=conflicts,
        )
        confidence = self._weighted_strategy_confidence(
            score=adjusted_score,
            risk_level=risk_level,
            conflicts=conflicts,
        )
        reason = self._weighted_strategy_reason(
            recommendation=recommendation,
            signal_scores=signal_scores,
            confidence=confidence,
            label="AI",
        )
        self._log_score_distribution(
            strategy="ai",
            symbol=context["symbol"],
            raw_score=raw_score,
            adjusted_score=adjusted_score,
            score_band=normalized_score,
            data_quality=provisional_data_quality.level,
            conflicts=conflicts,
        )
        return {
            "recommendation": recommendation,
            "score": normalized_score,
            "score_band": normalized_score,
            "confidence": confidence,
            "risk_level": risk_level,
            "reason": reason,
            "conflicts": conflicts,
        }

    def _hedgefund_strategy(self, context: dict) -> dict[str, object]:
        buy_threshold = self._effective_buy_threshold("hedgefund")
        sell_threshold = self._effective_sell_threshold("hedgefund")
        signal_scores = context["factor_scores"]
        raw_score = self._total_score(signal_scores)
        trend_up = context["latest_price"] > context["sma200"]
        trend_down = context["latest_price"] < context["sma200"]
        momentum_up = context["momentum_5d"] > 0
        momentum_down = context["momentum_5d"] < 0
        initial_band = self._score_band("hedgefund", raw_score)
        candidate: Recommendation = "HOLD"
        if trend_up:
            candidate = "BUY" if initial_band >= buy_threshold and momentum_up else "HOLD"
        elif trend_down:
            candidate = (
                "SELL" if initial_band <= sell_threshold and momentum_down else "HOLD"
            )
        trade_quality_conflicts = self._trade_quality_conflicts(
            recommendation=candidate,
            context=context,
            signal_scores=signal_scores,
        )
        conflicts = self._simple_conflicts(signal_scores) + trade_quality_conflicts
        conflicts = list(dict.fromkeys(conflicts))[:4]
        provisional_data_quality = self._refine_data_quality_for_signals(
            strategy="hedgefund",
            score=initial_band,
            conflicts=conflicts,
            recommendation=candidate,
            base_decision=context["base_data_quality_decision"],
        )
        adjusted_score = self._apply_conflict_score_damping(
            strategy="hedgefund",
            raw_score=raw_score,
            conflicts=conflicts,
        )
        adjusted_score = self._apply_score_data_quality_damping(
            score=adjusted_score,
            data_quality=context["base_data_quality_decision"].level,
        )
        normalized_score = self._score_band("hedgefund", adjusted_score)
        if trend_up:
            recommendation: Recommendation = (
                "BUY" if normalized_score >= buy_threshold and momentum_up else "HOLD"
            )
        elif trend_down:
            recommendation = (
                "SELL"
                if normalized_score <= sell_threshold and momentum_down
                else "HOLD"
            )
        else:
            recommendation = "HOLD"
        risk_level = self._weighted_strategy_risk(
            score=adjusted_score,
            volatility_30d=context["volatility_30d"],
            conflicts=conflicts,
        )
        confidence = self._weighted_strategy_confidence(
            score=adjusted_score,
            risk_level=risk_level,
            conflicts=conflicts,
        )
        reason = self._hedgefund_strategy_reason(
            recommendation=recommendation,
            score=normalized_score,
            confidence=confidence,
            trend_up=trend_up,
            momentum_up=momentum_up,
            momentum_down=momentum_down,
            signal_scores=signal_scores,
        )
        self._log_score_distribution(
            strategy="hedgefund",
            symbol=context["symbol"],
            raw_score=raw_score,
            adjusted_score=adjusted_score,
            score_band=normalized_score,
            data_quality=provisional_data_quality.level,
            conflicts=conflicts,
        )
        return {
            "recommendation": recommendation,
            "score": normalized_score,
            "score_band": normalized_score,
            "confidence": confidence,
            "risk_level": risk_level,
            "reason": reason,
            "conflicts": conflicts,
        }

    def _factor_scores(
        self,
        *,
        latest_price: float,
        sma50: float,
        sma200: float,
        rsi14: float,
        momentum_5d: float,
        volatility_30d: float,
        news_snapshot: NewsSentimentSnapshot,
    ) -> dict[str, int]:
        price_vs_sma50 = ((latest_price - sma50) / sma50) if sma50 else 0.0
        price_vs_sma200 = ((latest_price - sma200) / sma200) if sma200 else 0.0

        if (
            latest_price >= sma200
            and latest_price >= sma50
        ):
            trend = 30
        elif latest_price >= sma200:
            trend = 15
        elif (
            latest_price < sma200
            and latest_price < sma50
        ):
            trend = -30
        else:
            trend = -15
        if rsi14 < 30:
            rsi = 20
        elif rsi14 > 70:
            rsi = -20
        else:
            rsi = 0
        if momentum_5d > 0:
            momentum = 20
        elif momentum_5d < 0:
            momentum = -20
        else:
            momentum = 0
        if news_snapshot.article_count == 0 or abs(news_snapshot.news_score) < 0.15:
            news = 0
        else:
            news = 15 if news_snapshot.news_score > 0 else -15
        if volatility_30d <= 0.18:
            volatility = 15
        elif volatility_30d >= 0.32:
            volatility = -15
        else:
            volatility = 0
        return {
            "trend": trend,
            "rsi": rsi,
            "momentum": momentum,
            "news": news,
            "volatility": volatility,
        }

    def _ai_signal_scores(self, factor_scores: dict[str, int]) -> dict[str, int]:
        return {
            "trend": factor_scores["trend"],
            "rsi": factor_scores["rsi"],
            "momentum": factor_scores["momentum"],
            "news": factor_scores["news"],
            "volatility": factor_scores["volatility"],
        }

    def _has_mixed_signals(self, signal_scores: dict[str, int]) -> bool:
        positives = [value for value in signal_scores.values() if value > 0]
        negatives = [value for value in signal_scores.values() if value < 0]
        return bool(positives and negatives)

    def _simple_conflicts(self, signal_scores: dict[str, int]) -> list[str]:
        positives = [name for name, value in signal_scores.items() if value > 0]
        negatives = [name for name, value in signal_scores.items() if value < 0]
        conflicts: list[str] = []
        if positives and negatives:
            conflicts.append(f"{positives[0].title()} vs {negatives[0].title()}")
        if signal_scores["trend"] > 0 and signal_scores["rsi"] < 0:
            conflicts.append("Trend vs RSI")
        if signal_scores["trend"] < 0 and signal_scores["rsi"] > 0:
            conflicts.append("Trend vs RSI")
        if signal_scores["trend"] > 0 and signal_scores["momentum"] < 0:
            conflicts.append("Trend vs Momentum")
        if signal_scores["trend"] < 0 and signal_scores["momentum"] > 0:
            conflicts.append("Trend vs Momentum")
        if signal_scores["rsi"] > 0 and signal_scores["momentum"] < 0:
            conflicts.append("RSI vs Momentum")
        if signal_scores["rsi"] < 0 and signal_scores["momentum"] > 0:
            conflicts.append("RSI vs Momentum")
        return conflicts[:3]

    def _strong_conflicts(self, conflicts: Sequence[str]) -> list[str]:
        direct_conflicts = {
            "Trend vs RSI",
            "Trend vs Momentum",
            "RSI vs Momentum",
        }
        strong = [conflict for conflict in conflicts if conflict in direct_conflicts]
        if "Low Volume" in conflicts and "Weak Confirmation" in conflicts:
            strong.append("Low Volume + Weak Confirmation")
        return list(dict.fromkeys(strong))

    def _trade_quality_conflicts(
        self,
        *,
        recommendation: Recommendation,
        context: dict,
        signal_scores: dict[str, int],
    ) -> list[str]:
        if recommendation == "HOLD":
            return []

        conflicts: list[str] = []
        low_volume = self._is_low_volume(
            latest_volume=context["latest_volume"],
            avg_volume_20=context["avg_volume_20"],
        )
        sideways = self._is_sideways_market(
            price_vs_sma50=context["price_vs_sma50"],
            sma20_vs_sma50=context["sma20_vs_sma50"],
            signal_map=context["signal_map"],
        )
        confirmation_count = self._confirmation_count(
            recommendation=recommendation,
            signal_map=context["signal_map"],
        )

        if low_volume:
            conflicts.append("Low Volume")
        if sideways:
            conflicts.append("Sideways Trend")
        if confirmation_count < 2:
            conflicts.append("Weak Confirmation")
        return conflicts

    def _confirmation_count(
        self,
        *,
        recommendation: Recommendation,
        signal_map: dict[str, SignalResult],
    ) -> int:
        return self._aligned_factor_count(
            recommendation=recommendation,
            signal_map=signal_map,
        )

    def _is_low_volume(self, *, latest_volume: float, avg_volume_20: float) -> bool:
        if latest_volume <= 0 or avg_volume_20 <= 0:
            return False
        return latest_volume < (avg_volume_20 * 0.85)

    def _is_sideways_market(
        self,
        *,
        price_vs_sma50: float,
        sma20_vs_sma50: float,
        signal_map: dict[str, SignalResult],
    ) -> bool:
        return (
            abs(price_vs_sma50) < 0.015
            and abs(sma20_vs_sma50) < 0.01
            and signal_map["trend_strength"].strength < 0.35
        )

    def _total_score(self, signal_scores: dict[str, int]) -> int:
        return int(self._clamp(sum(signal_scores.values()), -100, 100))

    def _average_volume(self, volumes: Sequence[int], window: int) -> float:
        if window <= 0 or not volumes:
            return 0.0
        sample = volumes[-window:]
        if not sample:
            return 0.0
        return sum(sample) / len(sample)

    def _probability_from_strategy_score(
        self,
        *,
        strategy: Strategy,
        score: int,
        recommendation: Recommendation,
    ) -> float:
        probability_up = 0.5 + (score * 0.08)
        if recommendation == "BUY":
            probability_up = max(probability_up, 0.68)
        elif recommendation == "SELL":
            probability_up = min(probability_up, 0.32)
        return round(self._clamp(probability_up, 0.1, 0.9), 4)

    def _simple_strategy_risk(
        self,
        *,
        score: int,
        volatility_30d: float,
        conflicts: Sequence[str],
    ) -> RiskLevel:
        if volatility_30d >= 0.32 or len(conflicts) >= 2:
            return "HIGH"
        if abs(score) <= 2 or volatility_30d >= 0.22 or conflicts:
            return "MEDIUM"
        return "LOW"

    def _simple_strategy_confidence(
        self,
        *,
        score: int,
        risk_level: RiskLevel,
        conflicts: Sequence[str],
    ) -> float:
        confidence = 38 + (abs(score) * 13)
        if conflicts:
            confidence -= min(len(conflicts), 2) * 8
        if risk_level == "MEDIUM":
            confidence -= 6
        elif risk_level == "HIGH":
            confidence -= 14
        return round(self._clamp(confidence, 25, 92), 1)

    def _weighted_strategy_risk(
        self,
        *,
        score: int,
        volatility_30d: float,
        conflicts: Sequence[str],
    ) -> RiskLevel:
        if volatility_30d >= 0.32 or len(conflicts) >= 2:
            return "HIGH"
        if abs(score) < 3 or conflicts or volatility_30d >= 0.22:
            return "MEDIUM"
        return "LOW"

    def _weighted_strategy_confidence(
        self,
        *,
        score: int,
        risk_level: RiskLevel,
        conflicts: Sequence[str],
    ) -> float:
        confidence = 36 + (abs(score) * 12)
        if conflicts:
            confidence -= min(len(conflicts), 3) * 6
        if risk_level == "MEDIUM":
            confidence -= 5
        elif risk_level == "HIGH":
            confidence -= 12
        return round(self._clamp(confidence, 24, 95), 1)

    def _risk_level_for_strategy(
        self,
        *,
        strategy: Strategy,
        score: int,
        volatility_30d: float,
        conflicts: Sequence[str],
    ) -> RiskLevel:
        if strategy == "simple":
            return self._simple_strategy_risk(
                score=score,
                volatility_30d=volatility_30d,
                conflicts=conflicts,
            )
        return self._weighted_strategy_risk(
            score=score,
            volatility_30d=volatility_30d,
            conflicts=conflicts,
        )

    def _confidence_for_strategy(
        self,
        *,
        strategy: Strategy,
        score: int,
        risk_level: RiskLevel,
        conflicts: Sequence[str],
    ) -> float:
        if strategy == "simple":
            return self._simple_strategy_confidence(
                score=score,
                risk_level=risk_level,
                conflicts=conflicts,
            )
        return self._weighted_strategy_confidence(
            score=score,
            risk_level=risk_level,
            conflicts=conflicts,
        )

    def _strategy_warnings(
        self,
        *,
        strategy: Strategy,
        rsi14: float,
        volatility_30d: float,
        news_snapshot: NewsSentimentSnapshot,
        conflicts: Sequence[str],
        drawdown_risk: float,
        confidence: float,
        risk_level: RiskLevel,
        score: int,
    ) -> list[str]:
        warnings: list[str] = []
        if conflicts:
            warnings.append("Mixed Signals")
        if volatility_30d >= 0.30:
            warnings.append("High Volatility")
        if news_snapshot.news_score <= -0.2 and news_snapshot.article_count:
            warnings.append("Negative News")
        if rsi14 > 70:
            warnings.append("Overbought")
        if rsi14 < 30:
            warnings.append("Oversold")
        if drawdown_risk >= 0.55:
            warnings.append("Drawdown Risk")
        if risk_level == "HIGH" and confidence <= 45:
            warnings.append("High Risk")
        if strategy != "simple" and abs(score) < 2:
            warnings.append("No Clear Edge")
        return warnings[:MAX_WARNINGS]

    def _entry_decision_for_strategy(
        self,
        *,
        recommendation: Recommendation,
        signal_quality: SignalQuality,
        risk_level: RiskLevel,
        confidence: float,
        score: int,
    ) -> tuple[bool, str]:
        if recommendation != "BUY":
            return False, "Fresh entry is not ideal because the strategy is not on a buy signal."
        if signal_quality == "PARTIAL":
            return False, "Fresh entry is not ideal because the buy setup is only partially confirmed."
        if risk_level == "HIGH":
            return False, "Fresh entry is not ideal because volatility and signal conflict are elevated."
        if confidence < 55:
            return False, "Fresh entry is not ideal because conviction is still limited."
        if score >= 4:
            return True, "Multiple positive factors align, so a fresh entry looks reasonable."
        return True, "The selected strategy supports a measured buy entry."

    def _exit_decision_for_strategy(
        self,
        *,
        recommendation: Recommendation,
        signal_quality: SignalQuality,
        risk_level: RiskLevel,
        score: int,
        warnings: Sequence[str],
    ) -> tuple[bool, str]:
        if recommendation == "SELL":
            if signal_quality == "PARTIAL":
                return True, "A trim looks sensible because the sell setup is only partially confirmed."
            return True, "An exit or trim looks sensible because negative signals are in control."
        if recommendation == "HOLD" and risk_level == "HIGH" and score < 0:
            return True, "An exit or trim looks sensible because risk is high while momentum is fading."
        if "Negative News" in warnings and recommendation != "BUY":
            return True, "An exit or trim looks sensible because negative news is adding pressure."
        return False, "No immediate exit trigger is dominant, so holding is reasonable for now."

    def _position_size_for_strategy(
        self,
        *,
        entry_signal: bool,
        recommendation: Recommendation,
        signal_quality: SignalQuality,
        risk_level: RiskLevel,
        confidence: float,
    ) -> tuple[float, str]:
        if recommendation != "BUY":
            return 0.0, "No fresh allocation is suggested unless the setup turns into a buy."
        if signal_quality == "PARTIAL":
            return 0.0, "No fresh allocation is suggested until the buy setup reaches full confirmation."
        if not entry_signal:
            return 0.0, "No fresh allocation is suggested until buy confirmation and risk improve."
        if risk_level == "LOW":
            minimum, maximum = 12.0, 20.0
        elif risk_level == "MEDIUM":
            minimum, maximum = 6.0, 12.0
        else:
            minimum, maximum = 2.0, 5.0
        normalized_confidence = self._clamp((confidence - 20) / 75, 0.0, 1.0)
        size = round(minimum + ((maximum - minimum) * normalized_confidence), 1)
        if risk_level == "LOW":
            reason = "Risk is low, so a fuller position is acceptable."
        elif risk_level == "MEDIUM":
            reason = "Risk is moderate, so a medium-sized position is more disciplined."
        else:
            reason = "Risk is high, so only a small starter position is appropriate."
        return size, reason

    def _simple_strategy_reason(
        self,
        *,
        recommendation: Recommendation,
        signal_scores: dict[str, int],
        confidence: float,
    ) -> str:
        positive = [name for name, value in signal_scores.items() if value > 0]
        negative = [name for name, value in signal_scores.items() if value < 0]
        if recommendation == "BUY":
            drivers = ", ".join(positive[:2]) or "positive signals"
            return f"BUY because {drivers} are aligned. Confidence {confidence:.0f}/100."
        if recommendation == "SELL":
            drivers = ", ".join(negative[:2]) or "negative signals"
            return f"SELL because {drivers} are aligned. Confidence {confidence:.0f}/100."
        if positive and negative:
            return f"HOLD because signals are mixed between {positive[0]} and {negative[0]}. Confidence {confidence:.0f}/100."
        return f"HOLD because the simple score is not strong enough for a trade. Confidence {confidence:.0f}/100."

    def _weighted_strategy_reason(
        self,
        *,
        recommendation: Recommendation,
        signal_scores: dict[str, int],
        confidence: float,
        label: str,
    ) -> str:
        positive = [name for name, value in signal_scores.items() if value > 0]
        negative = [name for name, value in signal_scores.items() if value < 0]
        top_positive = " + ".join(positive[:2]) or "positive factors"
        top_negative = " + ".join(negative[:2]) or "negative factors"

        if label == "AI":
            if recommendation == "BUY":
                return (
                    f"BUY because strong {top_positive} support the setup. "
                    f"Confidence {confidence:.0f}/100."
                )
            if recommendation == "SELL":
                return (
                    f"SELL because weak {top_negative} are driving the setup lower. "
                    f"Confidence {confidence:.0f}/100."
                )
            if positive and negative:
                return (
                    f"HOLD because {top_positive} are being offset by {top_negative}. "
                    f"Confidence {confidence:.0f}/100."
                )
            return (
                f"HOLD because the AI setup is not strong enough to justify a trade yet. "
                f"Confidence {confidence:.0f}/100."
            )

        if recommendation == "BUY":
            return f"BUY because {', '.join(positive[:2]) or 'positive factors'} lead the {label} model. Confidence {confidence:.0f}/100."
        if recommendation == "SELL":
            return f"SELL because {', '.join(negative[:2]) or 'negative factors'} lead the {label} model. Confidence {confidence:.0f}/100."
        if positive and negative:
            return f"HOLD because the {label} model sees mixed factors between {positive[0]} and {negative[0]}. Confidence {confidence:.0f}/100."
        return f"HOLD because the {label} score is not strong enough for a trade. Confidence {confidence:.0f}/100."

    def _hedgefund_strategy_reason(
        self,
        *,
        recommendation: Recommendation,
        score: int,
        confidence: float,
        trend_up: bool,
        momentum_up: bool,
        momentum_down: bool,
        signal_scores: dict[str, int],
    ) -> str:
        positive = [name for name, value in signal_scores.items() if value > 0]
        negative = [name for name, value in signal_scores.items() if value < 0]
        buy_threshold = self._effective_buy_threshold("hedgefund")
        sell_threshold = self._effective_sell_threshold("hedgefund")
        if recommendation == "BUY":
            return f"BUY because {', '.join(positive[:2]) or 'positive factors'} align and trend plus momentum confirm. Confidence {confidence:.0f}/100."
        if recommendation == "SELL":
            return f"SELL because {', '.join(negative[:2]) or 'negative factors'} align and trend plus momentum confirm. Confidence {confidence:.0f}/100."
        if trend_up and not momentum_up and score >= max(2, buy_threshold - 1):
            return f"HOLD because the long-term trend is up but momentum does not confirm the buy. Confidence {confidence:.0f}/100."
        if (not trend_up) and not momentum_down and score <= min(-2, sell_threshold + 1):
            return f"HOLD because the long-term trend is down but momentum does not confirm the sell. Confidence {confidence:.0f}/100."
        if positive and negative:
            return f"HOLD because hedgefund factors are mixed between {positive[0]} and {negative[0]}. Confidence {confidence:.0f}/100."
        return f"HOLD because the hedgefund score is not strong enough for a trade. Confidence {confidence:.0f}/100."

    def _no_data_response(
        self,
        symbol: str,
        reason: str,
        *,
        strategy: Strategy,
    ) -> AnalysisResponse:
        normalized_symbol = symbol.strip().upper()
        message = reason or "No live market data available."
        return AnalysisResponse(
            symbol=normalized_symbol,
            strategy=strategy,
            no_data=True,
            no_data_reason=message,
            recommendation=None,
            signal_quality=None,
            score=None,
            probability_up=None,
            probability_down=None,
            confidence=0.0,
            risk_level=None,
            data_quality="NO_DATA",
            data_quality_reason=message,
            macro=None,
            no_trade=True,
            no_trade_reason=message,
            entry_signal=False,
            entry_reason=message,
            exit_signal=False,
            exit_reason=message,
            stop_loss_level=None,
            stop_loss_reason=message,
            position_size_percent=None,
            position_size_reason=message,
            timeframe=None,
            warnings=[],
            summary=message,
            generated_at=datetime.now(timezone.utc),
            signals=None,
        )

    def _partial_data_response(
        self,
        symbol: str,
        *,
        available_points: int,
        strategy: Strategy,
    ) -> AnalysisResponse:
        normalized_symbol = symbol.strip().upper()
        message = (
            f"Partial market history only: {available_points} daily closes are available. "
            "At least 60 are needed for a full analysis."
        )
        return AnalysisResponse(
            symbol=normalized_symbol,
            strategy=strategy,
            no_data=True,
            no_data_reason=message,
            recommendation=None,
            signal_quality=None,
            score=None,
            probability_up=None,
            probability_down=None,
            confidence=0.0,
            risk_level=None,
            data_quality="PARTIAL",
            data_quality_reason=message,
            macro=None,
            no_trade=True,
            no_trade_reason=message,
            entry_signal=False,
            entry_reason=message,
            exit_signal=False,
            exit_reason=message,
            stop_loss_level=None,
            stop_loss_reason=message,
            position_size_percent=None,
            position_size_reason=message,
            timeframe=None,
            warnings=[],
            summary=message,
            generated_at=datetime.now(timezone.utc),
            signals=None,
        )

    def _trend_signal(self, sma50: float, price_vs_sma50: float) -> SignalResult:
        impact = self._clamp(price_vs_sma50 / 0.08, -1.0, 1.0)
        direction = "above" if price_vs_sma50 >= 0 else "below"
        tone = (
            "supports a constructive short-term backdrop"
            if impact > 0.2
            else "keeps the trend picture balanced"
            if impact >= -0.2
            else "suggests sellers still have the edge"
        )
        note = f"Price is {abs(price_vs_sma50):.1%} {direction} SMA50, which {tone}."
        return self._signal_result("Trend", price_vs_sma50 * 100, impact, note)

    def _crossover_signal(self, sma20: float, sma50: float, spread: float) -> SignalResult:
        impact = self._clamp(spread / 0.05, -1.0, 1.0)
        direction = "above" if spread >= 0 else "below"
        note = (
            f"SMA20 is {abs(spread):.1%} {direction} SMA50, so the moving-average trend "
            f"is {'aligned upward' if impact > 0.2 else 'mixed' if impact >= -0.2 else 'still tilted lower'}."
        )
        return self._signal_result("SMA Crossover", spread * 100, impact, note)

    def _rsi_signal(self, rsi: float) -> SignalResult:
        if rsi >= 75:
            impact = -self._clamp(0.55 + ((rsi - 75) / 15), 0.55, 1.0)
            note = "RSI is very elevated, so the setup looks overbought and vulnerable to a pullback."
        elif rsi >= 70:
            impact = -self._clamp(0.32 + ((rsi - 70) / 10) * 0.18, 0.32, 0.50)
            note = "RSI is elevated, which argues for caution on fresh entries."
        elif rsi >= 55:
            impact = self._clamp(0.20 + ((rsi - 55) / 15) * 0.20, 0.20, 0.40)
            note = "RSI sits in a healthy bullish range without looking excessively stretched."
        elif rsi >= 45:
            impact = 0.06
            note = "RSI is neutral, so momentum is present but not decisive on its own."
        elif rsi >= 35:
            impact = -0.18
            note = "RSI is soft, which points to weaker short-term participation."
        else:
            impact = self._clamp(0.10 + ((35 - rsi) / 25) * 0.18, 0.10, 0.28)
            note = "RSI is oversold, which can support a bounce but remains less reliable without trend confirmation."
        return self._signal_result("RSI", rsi, impact, note)

    def _momentum_signal(self, momentum_5d: float) -> SignalResult:
        impact = self._clamp(momentum_5d / 0.08, -1.0, 1.0)
        if momentum_5d >= 0.04:
            note = f"Five-day momentum is strongly positive at {momentum_5d:.1%}."
        elif momentum_5d > 0:
            note = f"Five-day momentum is positive at {momentum_5d:.1%}, but not explosive."
        elif momentum_5d <= -0.04:
            note = f"Five-day momentum is clearly negative at {momentum_5d:.1%}."
        else:
            note = f"Five-day momentum is slightly negative at {momentum_5d:.1%}, which weakens follow-through."
        return self._signal_result("Momentum", momentum_5d * 100, impact, note)

    def _volatility_signal(self, volatility_30d: float) -> SignalResult:
        if volatility_30d <= 0.18:
            impact = self._clamp((0.18 - volatility_30d) / 0.10, 0.10, 0.55)
            note = "Realized volatility is contained, which makes the setup cleaner."
        elif volatility_30d <= 0.28:
            impact = -0.08
            note = "Volatility is moderate, so the setup is tradable but still sensitive to shocks."
        else:
            impact = -self._clamp((volatility_30d - 0.28) / 0.20 + 0.20, 0.20, 1.0)
            note = "Volatility is elevated, so price swings can easily overwhelm otherwise constructive signals."
        return self._signal_result("Volatility", volatility_30d * 100, impact, note)

    def _news_signal(self, snapshot: NewsSentimentSnapshot) -> SignalResult:
        impact = self._clamp(snapshot.news_score, -1.0, 1.0)
        article_count = snapshot.article_count
        if article_count == 0:
            impact = 0.0
            note = snapshot.note
        elif impact > 0.2:
            note = (
                f"{article_count} recent headline{'s' if article_count != 1 else ''} lean supportive. "
                f"{snapshot.note}"
            )
        elif impact < -0.2:
            note = (
                f"{article_count} recent headline{'s' if article_count != 1 else ''} lean negative. "
                f"{snapshot.note}"
            )
        else:
            note = (
                f"{article_count} recent headline{'s' if article_count != 1 else ''} are mixed. "
                f"{snapshot.note}"
            )
        return self._signal_result("News Sentiment", snapshot.news_score, impact, note)

    def _trend_strength_signal(self, price_vs_sma50: float, sma20_vs_sma50: float) -> SignalResult:
        distance_strength = self._clamp(abs(price_vs_sma50) / 0.08, 0.0, 1.0)
        structure_strength = self._clamp(abs(sma20_vs_sma50) / 0.05, 0.0, 1.0)
        combined_strength = (distance_strength * 0.55) + (structure_strength * 0.45)

        if price_vs_sma50 > 0 and sma20_vs_sma50 > 0:
            impact = self._clamp(0.20 + combined_strength * 0.75, 0.20, 1.0)
            note = "Price and moving averages point in the same bullish direction, so trend strength is supportive."
        elif price_vs_sma50 < 0 and sma20_vs_sma50 < 0:
            impact = -self._clamp(0.20 + combined_strength * 0.75, 0.20, 1.0)
            note = "Price and moving averages point in the same bearish direction, so trend strength is weak for longs."
        else:
            impact = -0.08
            note = "Price and moving averages are not well aligned, so trend conviction stays limited."
        return self._signal_result("Trend Strength", combined_strength * 100, impact, note)

    def _signal_result(self, name: str, value: float, impact: float, note: str) -> SignalResult:
        normalized_impact = round(self._clamp(impact, -1.0, 1.0), 2)
        return SignalResult(
            name=name,
            value=round(value, 2),
            status=self._status_from_impact(normalized_impact),
            note=note,
            strength=round(abs(normalized_impact), 2),
            probability_impact=normalized_impact,
        )

    def _weighted_edge(self, signal_map: dict[str, SignalResult]) -> float:
        return sum(
            signal_map[key].probability_impact * SIGNAL_WEIGHTS[key] for key in SIGNAL_WEIGHTS
        )

    def _consistency_adjustment(self, signal_map: dict[str, SignalResult]) -> float:
        directional_keys = (
            "trend",
            "sma_crossover",
            "rsi",
            "momentum",
            "news_sentiment",
            "trend_strength",
        )
        buckets = [self._direction_bucket(signal_map[key].probability_impact) for key in directional_keys]
        bullish = sum(1 for bucket in buckets if bucket > 0)
        bearish = sum(1 for bucket in buckets if bucket < 0)
        total_directional = bullish + bearish

        adjustment = 0.0
        if total_directional:
            adjustment += ((bullish - bearish) / total_directional) * 0.08

        trend_impact = signal_map["trend"].probability_impact
        momentum_impact = signal_map["momentum"].probability_impact
        trend_strength_impact = signal_map["trend_strength"].probability_impact

        if trend_impact * momentum_impact > 0.05:
            adjustment += 0.04 if trend_impact > 0 else -0.04
        if trend_impact * trend_strength_impact > 0.05:
            adjustment += 0.03 if trend_impact > 0 else -0.03
        return adjustment

    def _macro_edge_adjustment(
        self,
        *,
        macro_snapshot: MacroSnapshot,
        signal_map: dict[str, SignalResult],
    ) -> float:
        adjustment = macro_snapshot.macro_score * 0.03

        if macro_snapshot.market_trend == "bullish":
            adjustment += macro_snapshot.market_trend_strength * 0.02
        elif macro_snapshot.market_trend == "bearish":
            adjustment -= macro_snapshot.market_trend_strength * 0.03

        if (
            signal_map["trend"].probability_impact > 0.2
            and signal_map["momentum"].probability_impact > 0.15
            and macro_snapshot.market_trend == "bullish"
        ):
            adjustment += 0.03
        elif (
            signal_map["trend"].probability_impact > 0.2
            and macro_snapshot.market_trend == "bearish"
        ):
            adjustment -= 0.04

        if macro_snapshot.interest_rate_effect == "negative":
            adjustment -= 0.02
        elif macro_snapshot.interest_rate_effect == "positive":
            adjustment += 0.02

        if macro_snapshot.usd_strength == "strong":
            adjustment -= 0.02
        elif macro_snapshot.usd_strength == "weak":
            adjustment += 0.02

        return self._clamp(adjustment, -0.14, 0.14)

    def _detect_conflicts(self, signal_map: dict[str, SignalResult]) -> list[str]:
        conflicts: list[str] = []
        if self._is_conflict(signal_map["trend"], signal_map["news_sentiment"]):
            conflicts.append("Trend vs News")
        if self._is_conflict(signal_map["trend"], signal_map["rsi"]):
            conflicts.append("Trend vs RSI")
        if self._is_conflict(signal_map["momentum"], signal_map["news_sentiment"]):
            conflicts.append("Momentum vs News")
        if self._is_conflict(signal_map["sma_crossover"], signal_map["momentum"]):
            conflicts.append("Crossover vs Momentum")
        if self._is_conflict(signal_map["trend_strength"], signal_map["momentum"]):
            conflicts.append("Trend Strength vs Momentum")
        return conflicts

    def _build_warnings(
        self,
        *,
        rsi14: float,
        volatility_30d: float,
        news_snapshot: NewsSentimentSnapshot,
        conflicts: Sequence[str],
        trend_strength: float,
        weighted_edge: float,
        drawdown_risk: float,
        probability_up: float,
        confidence: float,
        risk_level: RiskLevel,
        no_trade: bool,
        macro_snapshot: MacroSnapshot,
    ) -> list[str]:
        warnings: list[str] = []
        if volatility_30d >= 0.32:
            warnings.append("High Volatility")
        if rsi14 >= 70:
            warnings.append("Overbought")
        if news_snapshot.article_count == 0:
            warnings.append("No Recent News")
        if news_snapshot.news_score <= -0.2:
            warnings.append("Negative News")
        if trend_strength < 0.35:
            warnings.append("Trend Weak")
            warnings.append("No Clear Trend")
        if conflicts or abs(weighted_edge) < 0.04:
            warnings.append("Market Uncertain")
        if len(conflicts) >= 2:
            warnings.append("Too Many Conflicting Signals")
        if abs(probability_up - 0.5) <= 0.04 or no_trade:
            warnings.append("Setup Unclear")
        if risk_level == "HIGH" and confidence < 0.55:
            warnings.append("High Risk / Low Confidence")
        if drawdown_risk >= 0.55:
            warnings.append("Drawdown Risk")
        if macro_snapshot.market_trend == "bearish":
            warnings.append("Overall Market Weak")
        if macro_snapshot.macro_score <= -1:
            warnings.append("Macro Headwind")
        if macro_snapshot.interest_rate_effect == "negative":
            warnings.append("Rates Pressure Equities")
        if macro_snapshot.usd_strength == "strong":
            warnings.append("USD Strong")
        prioritized: list[str] = []
        priority_order = [
            "Too Many Conflicting Signals",
            "Setup Unclear",
            "No Clear Trend",
            "High Volatility",
            "Negative News",
            "Overall Market Weak",
            "Macro Headwind",
            "High Risk / Low Confidence",
            "Market Uncertain",
            "Drawdown Risk",
            "Overbought",
            "Rates Pressure Equities",
            "USD Strong",
            "No Recent News",
            "Trend Weak",
        ]

        for item in priority_order:
            if item in warnings and item not in prioritized:
                prioritized.append(item)
            if len(prioritized) >= MAX_WARNINGS:
                return prioritized

        for item in warnings:
            if item not in prioritized:
                prioritized.append(item)
            if len(prioritized) >= MAX_WARNINGS:
                break
        return prioritized

    def _no_trade_decision(
        self,
        *,
        signal_map: dict[str, SignalResult],
        conflicts: Sequence[str],
        volatility_30d: float,
        probability_up: float,
        confidence: float,
        risk_level: RiskLevel,
        news_snapshot: NewsSentimentSnapshot,
        macro_snapshot: MacroSnapshot,
    ) -> tuple[bool, str]:
        directional_keys = (
            "trend",
            "sma_crossover",
            "rsi",
            "momentum",
            "news_sentiment",
            "trend_strength",
        )
        mixed_noise = self._mixed_signal_noise(
            [self._direction_bucket(signal_map[key].probability_impact) for key in directional_keys]
        )
        reasons: list[str] = []
        if len(conflicts) >= 4 and confidence < 0.45:
            reasons.append("too many core signals are conflicting")
        elif (
            len(conflicts) >= 3
            and 0.47 <= probability_up <= 0.53
            and confidence < 0.42
        ):
            reasons.append("signal conflict is too high for a disciplined trade")
        if (
            volatility_30d >= 0.48
            and signal_map["trend_strength"].strength < 0.15
            and confidence < 0.38
        ):
            reasons.append("volatility is high while the trend stays weak")
        if risk_level == "HIGH" and confidence < 0.3 and mixed_noise >= 0.62:
            reasons.append("risk is extreme while confidence remains too low")
        if (
            news_snapshot.article_count
            and news_snapshot.news_score <= -0.65
            and macro_snapshot.market_trend == "bearish"
            and confidence < 0.34
        ):
            reasons.append("news and macro pressure are too heavy for a clean setup")

        if reasons:
            return True, reasons[0].capitalize() + "."
        return False, "The setup is clear enough to evaluate a disciplined trade."

    def _confidence(
        self,
        *,
        signal_map: dict[str, SignalResult],
        probability_up: float,
        volatility_30d: float,
        conflicts: Sequence[str],
        overextension_risk: float,
        news_snapshot: NewsSentimentSnapshot,
        macro_snapshot: MacroSnapshot,
    ) -> float:
        directional_keys = (
            "trend",
            "sma_crossover",
            "rsi",
            "momentum",
            "news_sentiment",
            "trend_strength",
        )
        directional_buckets = [
            self._direction_bucket(signal_map[key].probability_impact) for key in directional_keys
        ]
        directional_count = sum(1 for bucket in directional_buckets if bucket != 0)
        bullish = sum(1 for bucket in directional_buckets if bucket > 0)
        bearish = sum(1 for bucket in directional_buckets if bucket < 0)
        dominant_ratio = max(bullish, bearish) / directional_count if directional_count else 0.0
        avg_strength = sum(abs(signal_map[key].probability_impact) for key in signal_map) / len(signal_map)
        edge_strength = abs(probability_up - 0.5) * 2
        volatility_penalty = self._clamp((volatility_30d - 0.20) / 0.25, 0.0, 1.0)
        negative_news_penalty = self._clamp(-news_snapshot.news_score, 0.0, 1.0)
        mixed_noise = self._mixed_signal_noise(directional_buckets)

        confidence = 0.26
        confidence += avg_strength * 0.26
        confidence += dominant_ratio * 0.16
        confidence += edge_strength * 0.18

        if signal_map["trend"].probability_impact * signal_map["momentum"].probability_impact > 0.05:
            confidence += 0.06
        if signal_map["trend"].probability_impact * signal_map["trend_strength"].probability_impact > 0.05:
            confidence += 0.05

        confidence -= min(len(conflicts), 3) * 0.07
        confidence -= volatility_penalty * 0.10
        confidence -= overextension_risk * 0.06
        confidence -= negative_news_penalty * 0.05
        confidence -= mixed_noise * 0.08
        if abs(signal_map["trend"].probability_impact) < 0.2:
            confidence -= 0.05

        confidence += self._macro_confidence_adjustment(
            macro_snapshot=macro_snapshot,
            signal_map=signal_map,
            probability_up=probability_up,
        )

        return round(self._clamp(confidence, 0.2, 0.86), 4)

    def _risk_level(
        self,
        *,
        signal_map: dict[str, SignalResult],
        volatility_30d: float,
        news_snapshot: NewsSentimentSnapshot,
        conflicts: Sequence[str],
        overextension_risk: float,
        drawdown_risk: float,
        macro_snapshot: MacroSnapshot,
    ) -> RiskLevel:
        volatility_penalty = self._clamp((volatility_30d - 0.18) / 0.25, 0.0, 1.0)
        negative_news_penalty = self._clamp(-news_snapshot.news_score, 0.0, 1.0)
        weak_trend_risk = 1 - signal_map["trend_strength"].strength
        conflict_risk = min(len(conflicts) / 3, 1.0)
        directional_keys = (
            "trend",
            "sma_crossover",
            "rsi",
            "momentum",
            "news_sentiment",
            "trend_strength",
        )
        mixed_noise = self._mixed_signal_noise(
            [self._direction_bucket(signal_map[key].probability_impact) for key in directional_keys]
        )

        risk_score = 0.16
        risk_score += volatility_penalty * 0.24
        risk_score += conflict_risk * 0.16
        risk_score += weak_trend_risk * 0.16
        risk_score += overextension_risk * 0.12
        risk_score += drawdown_risk * 0.10
        risk_score += negative_news_penalty * 0.08
        risk_score += mixed_noise * 0.10
        risk_score += self._macro_risk_adjustment(
            macro_snapshot=macro_snapshot,
            signal_map=signal_map,
        )

        if conflicts and signal_map["trend"].probability_impact > 0.2 and signal_map["rsi"].probability_impact < -0.2:
            risk_score += 0.08
        if volatility_penalty > 0.55 and negative_news_penalty > 0.25:
            risk_score += 0.08

        if risk_score < 0.42:
            risk_level: RiskLevel = "LOW"
        elif risk_score < 0.72:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        if macro_snapshot.market_trend == "bearish" and risk_level == "LOW":
            return "MEDIUM"
        return risk_level

    def _macro_confidence_adjustment(
        self,
        *,
        macro_snapshot: MacroSnapshot,
        signal_map: dict[str, SignalResult],
        probability_up: float,
    ) -> float:
        adjustment = macro_snapshot.macro_score * 0.02

        bullish_stock = probability_up >= 0.5
        bearish_stock = probability_up < 0.5

        if bullish_stock and macro_snapshot.market_trend == "bullish":
            adjustment += 0.04
        elif bullish_stock and macro_snapshot.market_trend == "bearish":
            adjustment -= 0.08
        elif bearish_stock and macro_snapshot.market_trend == "bearish":
            adjustment += 0.03

        if bullish_stock and macro_snapshot.interest_rate_effect == "negative":
            adjustment -= 0.03
        elif bullish_stock and macro_snapshot.interest_rate_effect == "positive":
            adjustment += 0.02

        if bullish_stock and macro_snapshot.usd_strength == "strong":
            adjustment -= 0.03
        elif bullish_stock and macro_snapshot.usd_strength == "weak":
            adjustment += 0.02

        if (
            macro_snapshot.market_trend == "bearish"
            and signal_map["trend"].probability_impact > 0.2
            and signal_map["momentum"].probability_impact > 0.15
        ):
            adjustment -= 0.03

        return adjustment

    def _macro_risk_adjustment(
        self,
        *,
        macro_snapshot: MacroSnapshot,
        signal_map: dict[str, SignalResult],
    ) -> float:
        adjustment = 0.0

        if macro_snapshot.market_trend == "bearish":
            adjustment += 0.18
        elif macro_snapshot.market_trend == "neutral":
            adjustment += 0.04

        if macro_snapshot.interest_rate_effect == "negative":
            adjustment += 0.08
        if macro_snapshot.usd_strength == "strong":
            adjustment += 0.07
        if macro_snapshot.macro_score <= -2:
            adjustment += 0.08

        if (
            macro_snapshot.market_trend == "bearish"
            and signal_map["trend"].probability_impact > 0.2
        ):
            adjustment += 0.07

        return adjustment

    def _entry_decision(
        self,
        *,
        signal_map: dict[str, SignalResult],
        rsi14: float,
        volatility_30d: float,
        news_snapshot: NewsSentimentSnapshot,
        probability_up: float,
        confidence: float,
        risk_level: RiskLevel,
        no_trade: bool,
        no_trade_reason: str,
        macro_snapshot: MacroSnapshot,
    ) -> tuple[bool, str]:
        if no_trade:
            return False, f"No trade right now because {no_trade_reason.rstrip('.').lower()}."

        supportive_count = sum(
            [
                signal_map["trend"].probability_impact > 0.2,
                signal_map["sma_crossover"].probability_impact > 0.2,
                signal_map["momentum"].probability_impact > 0.15,
                rsi14 < 70,
            ]
        )

        blockers: list[str] = []
        if rsi14 > 75:
            blockers.append("RSI is already very overbought")
        if news_snapshot.article_count and news_snapshot.news_score <= -0.35:
            blockers.append("recent news flow is clearly negative")
        if volatility_30d >= 0.32:
            blockers.append("volatility is too high for a clean entry")
        if risk_level == "HIGH":
            blockers.append("overall setup risk is high")
        if macro_snapshot.macro_score <= -2:
            blockers.append("macro headwinds are stacking up")

        probability_threshold = 0.55
        confidence_threshold = 0.60
        required_support = 3

        if macro_snapshot.market_trend == "bullish":
            probability_threshold -= 0.01
            confidence_threshold -= 0.02
        elif macro_snapshot.market_trend == "bearish":
            probability_threshold += 0.08
            confidence_threshold += 0.08
            required_support = 4
        elif macro_snapshot.macro_score < 0:
            probability_threshold += 0.03
            confidence_threshold += 0.04

        if supportive_count >= 4 and not blockers and probability_up >= probability_threshold:
            return True, "Trend, crossover, momentum, and RSI all support a fresh entry."
        if (
            supportive_count >= required_support
            and not blockers
            and probability_up >= max(0.60, probability_threshold)
            and confidence >= confidence_threshold
        ):
            return True, "Several core signals align, so a measured entry is reasonable."
        if macro_snapshot.market_trend == "bearish":
            return False, "Fresh entry is not ideal because the broader market is weak."
        if blockers:
            return False, f"Fresh entry is not ideal because {blockers[0]}."
        return False, "Fresh entry is not ideal because the setup lacks enough aligned signals."

    def _exit_decision(
        self,
        *,
        signal_map: dict[str, SignalResult],
        rsi14: float,
        momentum_5d: float,
        news_snapshot: NewsSentimentSnapshot,
        probability_down: float,
        macro_snapshot: MacroSnapshot,
    ) -> tuple[bool, str]:
        triggers: list[str] = []
        if rsi14 >= 72:
            triggers.append("RSI is overbought")
        if momentum_5d < -0.01:
            triggers.append("momentum has turned negative")
        if signal_map["trend_strength"].strength < 0.3 or signal_map["trend"].probability_impact < 0.0:
            triggers.append("trend strength is fading")
        if news_snapshot.article_count and news_snapshot.news_score <= -0.25:
            triggers.append("negative news is adding downside risk")
        if probability_down >= 0.58:
            triggers.append("downside odds are rising")
        if macro_snapshot.market_trend == "bearish" and probability_down >= 0.52:
            triggers.append("the broader market is weakening")
        if macro_snapshot.macro_score <= -2:
            triggers.append("macro headwinds are worsening")

        exit_signal = len(triggers) >= 2 or (
            probability_down >= 0.6 and len(triggers) >= 1
        )
        if exit_signal:
            return True, f"An exit or trim looks sensible because {triggers[0].lower()}."
        return False, "No immediate exit trigger is dominant, so a forced exit is not required yet."

    def _stop_loss(
        self,
        *,
        latest_price: float,
        sma50: float,
        support_level: float,
        volatility_30d: float,
    ) -> tuple[float, str]:
        volatility_buffer = max(0.03, min(0.12, volatility_30d * 0.75))
        sma_buffer = max(0.01, min(0.04, volatility_30d * 0.15))

        volatility_stop = latest_price * (1 - volatility_buffer)
        sma_stop = sma50 * (1 - sma_buffer)
        support_stop = support_level * 0.99

        candidates = {
            "volatility": volatility_stop,
            "sma50": sma_stop,
            "support": support_stop,
        }
        chosen_key, chosen_value = max(candidates.items(), key=lambda item: item[1])
        stop_loss_level = round(min(latest_price * 0.99, chosen_value), 2)

        if chosen_key == "support":
            reason = "Stop loss is set just below recent support to limit damage if the setup fails."
        elif chosen_key == "sma50":
            reason = "Stop loss sits just below SMA50 so the broader trend can fail before risk grows too large."
        else:
            reason = "Stop loss uses a volatility buffer so normal price noise is less likely to stop the trade too early."
        return stop_loss_level, reason

    def _position_size(
        self,
        *,
        entry_signal: bool,
        no_trade: bool,
        no_trade_reason: str,
        recommendation: Recommendation,
        risk_level: RiskLevel,
        confidence: float,
        volatility_30d: float,
        macro_snapshot: MacroSnapshot,
    ) -> tuple[float, str]:
        if no_trade:
            return 0.0, f"No allocation because {no_trade_reason.rstrip('.').lower()}."

        if not entry_signal:
            return 0.0, "No fresh capital allocation is suggested until entry conditions improve."

        if risk_level == "LOW":
            minimum, maximum = 15.0, 25.0
        elif risk_level == "MEDIUM":
            minimum, maximum = 5.0, 15.0
        else:
            minimum, maximum = 1.0, 5.0

        normalized_confidence = self._clamp((confidence - 0.2) / 0.66, 0.0, 1.0)
        volatility_discount = 1 - self._clamp((volatility_30d - 0.18) / 0.30, 0.0, 0.35)
        macro_discount = self._macro_position_discount(macro_snapshot)
        size = minimum + ((maximum - minimum) * normalized_confidence)
        size *= volatility_discount
        size *= macro_discount
        size = round(self._clamp(size, 1.0, maximum), 1)

        if risk_level == "LOW":
            reason = "Risk is low and confidence is solid, so a fuller position is reasonable."
        elif risk_level == "MEDIUM":
            reason = "Risk is moderate, so a medium-sized position fits better than a full allocation."
        else:
            reason = "Risk is high, so only a starter-sized position is appropriate."

        if macro_snapshot.market_trend == "bearish" or macro_snapshot.macro_score < 0:
            reason = f"{reason} The broader market backdrop argues for a smaller allocation."
        elif macro_snapshot.market_trend == "bullish" and macro_snapshot.macro_score > 0:
            reason = f"{reason} The macro backdrop is supportive enough to avoid under-sizing."

        if recommendation != "BUY":
            reason = f"{reason} Since the setup is not a strong buy, staying measured is especially important."
        return size, reason

    def _timeframe(
        self,
        *,
        signal_map: dict[str, SignalResult],
        momentum_5d: float,
        price_vs_sma50: float,
        sma20_vs_sma50: float,
    ) -> Timeframe:
        if (
            signal_map["trend_strength"].strength >= 0.55
            and abs(price_vs_sma50) >= 0.03
            and abs(sma20_vs_sma50) >= 0.015
        ):
            return "mid_term"
        if abs(momentum_5d) >= 0.01 or abs(price_vs_sma50) >= 0.015:
            return "short_term"
        return "unclear"

    def _recommendation_from_signals(
        self,
        *,
        signal_map: dict[str, SignalResult],
        probability_up: float,
        conflicts: Sequence[str],
    ) -> Recommendation:
        directional_keys = (
            "trend",
            "sma_crossover",
            "rsi",
            "momentum",
            "news_sentiment",
            "trend_strength",
        )
        directional_buckets = [
            self._direction_bucket(signal_map[key].probability_impact) for key in directional_keys
        ]
        bullish = sum(1 for bucket in directional_buckets if bucket > 0)
        bearish = sum(1 for bucket in directional_buckets if bucket < 0)
        net_bias = bullish - bearish

        if len(conflicts) >= 2 and abs(net_bias) <= 2:
            return "HOLD"
        if probability_up >= 0.60 and net_bias >= 2:
            return "BUY"
        if probability_up <= 0.40 and net_bias <= -2:
            return "SELL"
        if probability_up >= 0.66:
            return "BUY"
        if probability_up <= 0.34:
            return "SELL"
        return "HOLD"

    def _probability_from_edge(self, edge: float) -> float:
        probability_up = 0.5 + (edge * 0.32)
        return round(self._clamp(probability_up, 0.18, 0.82), 4)

    def _soften_for_conflicts(self, edge: float, conflict_count: int) -> float:
        if not conflict_count or edge == 0:
            return edge
        dampener = min(conflict_count * 0.10, 0.22)
        if edge > 0:
            return max(0.0, edge - dampener)
        return min(0.0, edge + dampener)

    def _drawdown_risk(
        self,
        *,
        support_distance: float,
        volatility_30d: float,
        max_drawdown: float,
    ) -> float:
        distance_component = self._clamp((support_distance - 0.08) / 0.25, 0.0, 1.0)
        drawdown_component = self._clamp(max_drawdown / 0.18, 0.0, 1.0)
        volatility_component = self._clamp((volatility_30d - 0.18) / 0.25, 0.0, 1.0)
        return self._clamp(
            distance_component * (0.55 + volatility_component * 0.45)
            + drawdown_component * 0.35,
            0.0,
            1.0,
        )

    def _overextension_risk(self, price_vs_sma50: float) -> float:
        return self._clamp((abs(price_vs_sma50) - 0.08) / 0.18, 0.0, 1.0)

    def _macro_position_discount(self, macro_snapshot: MacroSnapshot) -> float:
        discount = 1.0
        if macro_snapshot.market_trend == "neutral":
            discount *= 0.92
        elif macro_snapshot.market_trend == "bearish":
            discount *= 0.65

        if macro_snapshot.macro_score <= -2:
            discount *= 0.75
        elif macro_snapshot.macro_score >= 2:
            discount *= 1.04

        if macro_snapshot.interest_rate_effect == "negative":
            discount *= 0.92
        if macro_snapshot.usd_strength == "strong":
            discount *= 0.94

        return self._clamp(discount, 0.45, 1.08)

    def _mixed_signal_noise(self, directional_buckets: Sequence[int]) -> float:
        bullish = sum(1 for bucket in directional_buckets if bucket > 0)
        bearish = sum(1 for bucket in directional_buckets if bucket < 0)
        directional_total = bullish + bearish
        if bullish == 0 or bearish == 0 or directional_total == 0:
            return 0.0

        balance = 1 - (abs(bullish - bearish) / directional_total)
        activity = directional_total / len(directional_buckets)
        return self._clamp(balance * activity, 0.0, 1.0)

    def _status_from_impact(self, impact: float) -> str:
        if impact > 0.2:
            return "BULLISH"
        if impact < -0.2:
            return "BEARISH"
        return "NEUTRAL"

    def _direction_bucket(self, impact: float) -> int:
        if impact > 0.18:
            return 1
        if impact < -0.18:
            return -1
        return 0

    def _is_conflict(self, left: SignalResult, right: SignalResult) -> bool:
        return (
            self._direction_bucket(left.probability_impact)
            * self._direction_bucket(right.probability_impact)
            == -1
        )

    def _momentum(self, closes: Sequence[float], window: int) -> float:
        if len(closes) < window + 1:
            return 0.0
        base_price = closes[-(window + 1)]
        if base_price == 0:
            return 0.0
        return (closes[-1] - base_price) / base_price

    def _sma(self, values: Sequence[float], window: int) -> float:
        if len(values) < window:
            raise ValidationError(f"Not enough history to calculate SMA{window}.")
        window_values = values[-window:]
        return sum(window_values) / len(window_values)

    def _rsi(self, closes: Sequence[float], period: int) -> float:
        if len(closes) < period + 1:
            raise ValidationError("Not enough history to calculate RSI.")
        changes = [current - previous for previous, current in zip(closes[:-1], closes[1:])]
        window = changes[-period:]
        gains = [max(change, 0.0) for change in window]
        losses = [abs(min(change, 0.0)) for change in window]
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        if avg_loss == 0:
            return 100.0
        relative_strength = avg_gain / avg_loss
        return 100 - (100 / (1 + relative_strength))

    def _volatility(self, closes: Sequence[float], window: int) -> float:
        if len(closes) < window + 1:
            raise ValidationError("Not enough history to calculate volatility.")
        returns = [
            (current / previous) - 1
            for previous, current in zip(closes[-(window + 1) : -1], closes[-window:])
            if previous
        ]
        if len(returns) < 2:
            return 0.0
        mean_return = sum(returns) / len(returns)
        variance = sum((daily_return - mean_return) ** 2 for daily_return in returns) / (
            len(returns) - 1
        )
        return sqrt(variance) * sqrt(252)

    def _max_drawdown(self, closes: Sequence[float]) -> float:
        peak = closes[0]
        max_drawdown = 0.0
        for close in closes:
            peak = max(peak, close)
            if peak:
                max_drawdown = max(max_drawdown, (peak - close) / peak)
        return max_drawdown

    def _clamp(self, value: float, lower: float, upper: float) -> float:
        return max(lower, min(upper, value))
