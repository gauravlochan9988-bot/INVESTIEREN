from app.services.analysis import AnalysisService
from app.services.macro import MacroContextService
from app.services.market_data import MarketDataService
from app.services.news import NewsSentimentService
from tests.helpers import (
    FakeMarketDataProvider,
    FakeNewsProvider,
    FakeSummaryService,
    build_history,
)


def test_buy_setup_can_still_block_fresh_entry_when_overbought(analysis_service):
    history = build_history(start=100.0, drift=1.1, noise=0.003)

    result = analysis_service.analyze("AAPL", history)

    assert result.recommendation == "BUY"
    assert result.probability_up > 0.65
    assert result.risk_level == "MEDIUM"
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
    assert result.probability_down > 0.75
    assert result.risk_level == "HIGH"
    assert isinstance(result.no_trade, bool)
    assert result.entry_signal is False
    assert result.exit_signal is True
    assert result.position_size_percent == 0.0
    assert "Negative News" in result.warnings
    assert result.signals.news_sentiment.status == "BEARISH"
    assert result.signals.trend_strength.status == "BEARISH"


def test_mixed_setup_returns_hold_and_wait(analysis_service):
    history = build_history(start=220.0, drift=0.05, noise=0.015)

    result = analysis_service.analyze("NFLX", history)

    assert result.recommendation == "HOLD"
    assert 0.45 <= result.probability_up <= 0.56
    assert result.no_trade is True
    assert result.entry_signal is False
    assert result.exit_signal is False
    assert result.timeframe == "short_term"
    assert result.position_size_percent == 0.0
    assert "High Volatility" in result.warnings
    assert "Trend Weak" in result.warnings
    assert "Setup Unclear" in result.warnings
    assert "No Clear Trend" in result.warnings


def test_negative_news_and_overbought_condition_raise_exit_flag(analysis_service):
    history = build_history(start=100.0, drift=1.2, noise=0.002)

    result = analysis_service.analyze("MSFT", history)

    assert result.recommendation == "HOLD"
    assert result.risk_level in {"MEDIUM", "HIGH"}
    assert result.no_trade is True
    assert "conflicting" in result.no_trade_reason.lower()
    assert result.entry_signal is False
    assert result.exit_signal is True
    assert "Negative News" in result.warnings
    assert "Too Many Conflicting Signals" in result.warnings
    assert result.signals.trend.status == "BULLISH"
    assert result.signals.rsi.status == "BEARISH"
    assert result.signals.news_sentiment.status == "BEARISH"


def test_cleaner_setup_allows_entry_with_measured_size(analysis_service):
    history = build_history(start=115.0, drift=0.7, noise=0.004)

    result = analysis_service.analyze("NVDA", history)

    assert result.recommendation == "BUY"
    assert result.no_trade is False
    assert result.entry_signal is True
    assert result.exit_signal is False
    assert result.risk_level == "MEDIUM"
    assert 5 <= result.position_size_percent <= 15
    assert result.stop_loss_level > 0
    assert result.timeframe == "mid_term"
    assert result.macro.market_trend in {"bullish", "neutral"}
    assert result.signals.trend_strength.status == "BULLISH"


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
    assert "Overall Market Weak" in result.warnings
    assert "Macro Headwind" in result.warnings
