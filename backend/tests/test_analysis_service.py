from app.core.exceptions import ExternalServiceError
from app.services.analysis import AnalysisService
from app.services.macro import MacroContextService
from app.services.market_data import MarketDataService
from app.services.news import NewsSentimentSnapshot
from app.services.news import NewsSentimentService
from tests.helpers import (
    FakeMarketDataProvider,
    FakeNewsProvider,
    FakeSummaryService,
    build_history,
)


class FailingMarketDataProvider:
    def fetch_quotes(self, symbols, names):
        raise ExternalServiceError("Provider error while loading quotes.")

    def fetch_history(self, symbol, period):
        raise ExternalServiceError("Live market data provider is currently unavailable.")


class ShortHistoryMarketDataProvider:
    def fetch_quotes(self, symbols, names):
        raise ExternalServiceError("Quotes are not needed for this test.")

    def fetch_history(self, symbol, period):
        return build_history(start=100.0, drift=0.4)[:40]


def test_buy_setup_can_still_block_fresh_entry_when_overbought(analysis_service):
    history = build_history(start=100.0, drift=1.1, noise=0.003)

    result = analysis_service.analyze("AAPL", history)

    assert result.recommendation == "BUY"
    assert result.score >= 35
    assert result.probability_up >= 0.68
    assert result.risk_level == "HIGH"
    assert result.no_trade is False
    assert result.entry_signal is False
    assert result.exit_signal is False
    assert result.position_size_percent == 0.0
    assert result.timeframe == "mid_term"
    assert "Overbought" in result.warnings
    assert result.macro.macro_score >= 0
    assert result.signals.news_sentiment.status == "BULLISH"
    assert result.signals.trend_strength.status == "BULLISH"


def test_bearish_setup_triggers_exit_and_zero_size(analysis_service):
    history = build_history(start=120.0, drift=-1.0, noise=0.005)

    result = analysis_service.analyze("TSLA", history)

    assert result.recommendation == "SELL"
    assert result.score <= -35
    assert result.probability_down >= 0.68
    assert result.risk_level == "HIGH"
    assert isinstance(result.no_trade, bool)
    assert result.entry_signal is False
    assert result.exit_signal is True
    assert result.position_size_percent == 0.0
    assert "Negative News" in result.warnings
    assert result.signals.news_sentiment.status == "BEARISH"
    assert result.signals.trend_strength.status == "BEARISH"


def test_mixed_setup_returns_hold_and_wait(analysis_service):
    history = build_history(start=180.0, drift=0.6, noise=0.004)

    result = analysis_service.analyze("MSFT", history, strategy="simple")

    assert result.recommendation == "HOLD"
    assert -2 < result.score < 2
    assert 0.5 < result.probability_up < 0.65
    assert result.data_quality == "FULL"
    assert result.no_trade is False
    assert result.entry_signal is False
    assert result.exit_signal is True
    assert result.position_size_percent == 0.0
    assert "Mixed Signals" in result.warnings
    assert "mixed" in result.reason.lower()


def test_negative_news_and_overbought_condition_raise_exit_flag(analysis_service):
    history = build_history(start=100.0, drift=1.2, noise=0.002)

    result = analysis_service.analyze("MSFT", history)

    assert result.recommendation == "HOLD"
    assert result.score < 35
    assert result.risk_level == "HIGH"
    assert result.no_trade is False
    assert "trade evaluation available" in result.no_trade_reason.lower()
    assert result.entry_signal is False
    assert result.exit_signal is True
    assert "Negative News" in result.warnings
    assert "Mixed Signals" in result.warnings
    assert result.signals.trend.status == "BULLISH"
    assert result.signals.rsi.status == "BEARISH"
    assert result.signals.news_sentiment.status == "BEARISH"


def test_high_risk_hold_does_not_automatically_become_no_trade(analysis_service):
    history = build_history(start=210.0, drift=0.12, noise=0.02)

    result = analysis_service.analyze("AMZN", history)

    assert result.recommendation == "BUY"
    assert result.score >= 35
    assert result.risk_level == "HIGH"
    assert result.no_trade is False
    assert result.entry_signal is False


def test_cleaner_setup_allows_entry_with_measured_size(analysis_service):
    history = build_history(start=160.0, drift=0.3, noise=0.003)

    result = analysis_service.analyze("SAP.DE", history)

    assert result.recommendation == "BUY"
    assert result.score >= 35
    assert result.no_trade is False
    assert result.entry_signal is True
    assert result.exit_signal is False
    assert result.risk_level == "LOW"
    assert 12 <= result.position_size_percent <= 20
    assert result.stop_loss_level > 0
    assert result.timeframe == "mid_term"
    assert result.macro.market_trend in {"bullish", "neutral"}
    assert result.summary.startswith("BUY because")
    assert result.warnings == []


def test_bearish_macro_context_tightens_risk_and_entry():
    provider = FakeMarketDataProvider()
    provider.history_map["SPY"] = build_history(start=470.0, drift=-0.7, noise=0.004)
    provider.history_map["DXY"] = build_history(start=104.0, drift=0.08, noise=0.001)

    analysis_service = AnalysisService(
        market_data_service=MarketDataService(
            provider=provider,
            allowed_symbols={
                "NVDA": "NVIDIA",
            },
            ttl_seconds=3600,
        ),
        macro_context_service=MacroContextService(
            provider=provider,
            ttl_seconds=3600,
            market_symbol="SPY",
            usd_symbol="DXY",
            interest_rate_effect="negative",
        ),
        news_sentiment_service=NewsSentimentService(
            provider=FakeNewsProvider(),
            ttl_seconds=3600,
            headline_limit=8,
        ),
        summary_service=FakeSummaryService(),
    )

    result = analysis_service.analyze("NVDA", build_history(start=115.0, drift=0.7, noise=0.004))

    assert result.macro.market_trend == "bearish"
    assert result.macro.interest_rate_effect == "negative"
    assert result.macro.usd_strength == "strong"
    assert result.macro.macro_score <= -2
    assert result.risk_level in {"MEDIUM", "HIGH"}
    assert result.entry_signal is False
    assert result.position_size_percent == 0.0
    assert result.recommendation in {"BUY", "HOLD", "SELL"}


def test_europe_symbol_uses_europe_macro_profile():
    provider = FakeMarketDataProvider()

    analysis_service = AnalysisService(
        market_data_service=MarketDataService(
            provider=provider,
            allowed_symbols={"SAP.DE": "SAP SE"},
            ttl_seconds=3600,
        ),
        macro_context_service=MacroContextService(
            provider=provider,
            ttl_seconds=3600,
            market_symbol="SPY",
            usd_symbol="DXY",
            interest_rate_effect="neutral",
        ),
        news_sentiment_service=NewsSentimentService(
            provider=FakeNewsProvider(),
            ttl_seconds=3600,
            headline_limit=8,
        ),
        summary_service=FakeSummaryService(),
    )

    result = analysis_service.analyze("SAP.DE", build_history(start=160.0, drift=0.3, noise=0.003))

    assert result.symbol == "SAP.DE"
    assert result.macro.market_trend in {"bullish", "neutral", "bearish"}
    assert result.macro.macro_score >= -1


def test_india_symbol_uses_india_macro_profile():
    provider = FakeMarketDataProvider()
    provider.history_map["INDA"] = build_history(start=52.0, drift=-0.15, noise=0.003)
    provider.history_map["DXY"] = build_history(start=104.0, drift=0.06, noise=0.001)

    analysis_service = AnalysisService(
        market_data_service=MarketDataService(
            provider=provider,
            allowed_symbols={"RELIANCE.NS": "Reliance Industries"},
            ttl_seconds=3600,
        ),
        macro_context_service=MacroContextService(
            provider=provider,
            ttl_seconds=3600,
            market_symbol="SPY",
            usd_symbol="DXY",
            interest_rate_effect="negative",
        ),
        news_sentiment_service=NewsSentimentService(
            provider=FakeNewsProvider(),
            ttl_seconds=3600,
            headline_limit=8,
        ),
        summary_service=FakeSummaryService(),
    )

    result = analysis_service.analyze(
        "RELIANCE.NS",
        build_history(start=2850.0, drift=10.0, noise=0.003),
    )

    assert result.symbol == "RELIANCE.NS"
    assert result.macro.interest_rate_effect == "negative"
    assert result.risk_level in {"MEDIUM", "HIGH"}


def test_analyze_symbol_returns_no_data_status_when_live_market_data_is_missing():
    analysis_service = AnalysisService(
        market_data_service=MarketDataService(
            provider=FailingMarketDataProvider(),
            allowed_symbols={"AAPL": "Apple"},
            ttl_seconds=3600,
        ),
        macro_context_service=MacroContextService(
            provider=FakeMarketDataProvider(),
            ttl_seconds=3600,
            market_symbol="SPY",
            usd_symbol="DXY",
            interest_rate_effect="neutral",
        ),
        news_sentiment_service=NewsSentimentService(
            provider=FakeNewsProvider(),
            ttl_seconds=3600,
            headline_limit=8,
        ),
        summary_service=FakeSummaryService(),
    )

    result = analysis_service.analyze_symbol("AAPL")

    assert result.symbol == "AAPL"
    assert result.strategy == "hedgefund"
    assert result.no_data is True
    assert result.data_quality == "NO_DATA"


def test_analyze_symbol_marks_partial_data_when_history_window_is_too_short():
    analysis_service = AnalysisService(
        market_data_service=MarketDataService(
            provider=ShortHistoryMarketDataProvider(),
            allowed_symbols={"AAPL": "Apple"},
            ttl_seconds=3600,
        ),
        macro_context_service=MacroContextService(
            provider=FakeMarketDataProvider(),
            ttl_seconds=3600,
            market_symbol="SPY",
            usd_symbol="DXY",
            interest_rate_effect="neutral",
        ),
        news_sentiment_service=NewsSentimentService(
            provider=FakeNewsProvider(),
            ttl_seconds=3600,
            headline_limit=8,
        ),
        summary_service=FakeSummaryService(),
    )

    result = analysis_service.analyze_symbol("AAPL")

    assert result.symbol == "AAPL"
    assert result.no_data is True
    assert result.data_quality == "NO_DATA"
    assert "Not enough market history" in result.data_quality_reason


def test_data_quality_returns_full_when_at_least_eighty_percent_is_available(analysis_service):
    decision = analysis_service._evaluate_data_quality(
        latest_price=100.0,
        sma50=95.0,
        sma200=90.0,
        rsi14=48.0,
        momentum_5d=0.03,
        volatility_30d=0.18,
        news_snapshot=NewsSentimentSnapshot(
            symbol="AAPL",
            news_score=0.0,
            sentiment_label="neutral",
            article_count=0,
            articles=[],
            note="No recent articles",
        ),
    )

    assert decision.level == "FULL"
    assert decision.can_run_strategy is True
    assert "5/6" in decision.reason


def test_data_quality_returns_partial_when_analysis_can_still_run_with_less_than_eighty_percent(analysis_service):
    decision = analysis_service._evaluate_data_quality(
        latest_price=100.0,
        sma50=95.0,
        sma200=90.0,
        rsi14=48.0,
        momentum_5d=0.0 / 1.0,
        volatility_30d=float("nan"),
        news_snapshot=NewsSentimentSnapshot(
            symbol="AAPL",
            news_score=0.0,
            sentiment_label="neutral",
            article_count=0,
            articles=[],
            note="No recent articles",
        ),
    )

    assert decision.level == "PARTIAL"
    assert decision.can_run_strategy is True
    assert "4/6" in decision.reason


def test_data_quality_returns_no_data_when_too_many_required_inputs_are_missing(analysis_service):
    decision = analysis_service._evaluate_data_quality(
        latest_price=100.0,
        sma50=0.0,
        sma200=0.0,
        rsi14=float("nan"),
        momentum_5d=0.0,
        volatility_30d=float("nan"),
        news_snapshot=NewsSentimentSnapshot(
            symbol="AAPL",
            news_score=0.0,
            sentiment_label="neutral",
            article_count=0,
            articles=[],
            note="No recent articles",
        ),
    )

    assert decision.level == "NO_DATA"
    assert decision.can_run_strategy is False
    assert "only 2/6 required inputs" in decision.reason


def test_analyze_symbol_reuses_cached_response_without_reloading_history():
    provider = FakeMarketDataProvider()
    market_data_service = MarketDataService(
        provider=provider,
        allowed_symbols={"AAPL": "Apple"},
        ttl_seconds=3600,
    )
    analysis_service = AnalysisService(
        market_data_service=market_data_service,
        macro_context_service=MacroContextService(
            provider=provider,
            ttl_seconds=3600,
            market_symbol="SPY",
            usd_symbol="DXY",
            interest_rate_effect="neutral",
        ),
        news_sentiment_service=NewsSentimentService(
            provider=FakeNewsProvider(),
            ttl_seconds=3600,
            headline_limit=8,
        ),
        summary_service=FakeSummaryService(),
        analysis_cache_ttl_seconds=3600,
        alerts_cache_ttl_seconds=3600,
    )

    first = analysis_service.analyze_symbol("AAPL", strategy="hedgefund")
    history_calls_after_first = provider.history_calls
    second = analysis_service.analyze_symbol("AAPL", strategy="hedgefund")

    assert first.symbol == second.symbol == "AAPL"
    assert first.generated_at == second.generated_at
    assert provider.history_calls == history_calls_after_first


def test_scan_alerts_reuses_cached_alerts_without_recomputing_analysis():
    provider = FakeMarketDataProvider()
    market_data_service = MarketDataService(
        provider=provider,
        allowed_symbols={"AAPL": "Apple", "MSFT": "Microsoft"},
        ttl_seconds=3600,
    )
    analysis_service = AnalysisService(
        market_data_service=market_data_service,
        macro_context_service=MacroContextService(
            provider=provider,
            ttl_seconds=3600,
            market_symbol="SPY",
            usd_symbol="DXY",
            interest_rate_effect="neutral",
        ),
        news_sentiment_service=NewsSentimentService(
            provider=FakeNewsProvider(),
            ttl_seconds=3600,
            headline_limit=8,
        ),
        summary_service=FakeSummaryService(),
        analysis_cache_ttl_seconds=3600,
        alerts_cache_ttl_seconds=3600,
    )

    first = analysis_service.scan_alerts(strategy="simple", limit=6)
    history_calls_after_first = provider.history_calls
    second = analysis_service.scan_alerts(strategy="simple", limit=6)

    assert first == second
    assert provider.history_calls == history_calls_after_first


def test_strategies_return_distinct_results_without_overwriting_each_other(analysis_service):
    simple = analysis_service.analyze_symbol("MSFT", strategy="simple")
    ai = analysis_service.analyze_symbol("MSFT", strategy="ai")
    hedgefund = analysis_service.analyze_symbol("MSFT", strategy="hedgefund")

    assert simple.strategy == "simple"
    assert ai.strategy == "ai"
    assert hedgefund.strategy == "hedgefund"
    assert simple.recommendation == "HOLD"
    assert ai.recommendation == "BUY"
    assert hedgefund.recommendation == "BUY"
    assert simple.score != ai.score
    assert simple.data_quality == "FULL"
    assert ai.data_quality == "FULL"
    assert hedgefund.data_quality == "FULL"
    assert simple.no_trade is False
    assert ai.no_trade is False
    assert hedgefund.no_trade is False


def test_hedgefund_confirmation_can_hold_while_ai_model_still_sells(analysis_service):
    ai = analysis_service.analyze_symbol("TSLA", strategy="ai")
    hedgefund = analysis_service.analyze_symbol("TSLA", strategy="hedgefund")

    assert ai.strategy == "ai"
    assert hedgefund.strategy == "hedgefund"
    assert ai.recommendation == "SELL"
    assert hedgefund.recommendation == "HOLD"
    assert "weak" in ai.reason.lower()
    assert hedgefund.reason.startswith("HOLD because the long-term trend is down")


def test_scan_alerts_returns_prioritized_trade_and_risk_events(analysis_service):
    alerts = analysis_service.scan_alerts(strategy="simple", limit=10)

    assert alerts
    assert any(alert.title == "AAPL is now BUY" for alert in alerts)
    assert any(alert.kind == "recommendation" for alert in alerts)
    assert any(alert.kind in {"entry", "exit"} for alert in alerts)
    assert all(alert.strategy == "simple" for alert in alerts)
    assert all(alert.priority >= 0 for alert in alerts)
