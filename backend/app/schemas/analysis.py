from datetime import datetime
from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, computed_field


Recommendation = Literal["BUY", "HOLD", "SELL"]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
SignalStatus = Literal["BULLISH", "NEUTRAL", "BEARISH"]
Timeframe = Literal["short_term", "mid_term", "unclear"]
MacroTrend = Literal["bullish", "neutral", "bearish"]
InterestRateEffect = Literal["positive", "neutral", "negative"]
UsdStrength = Literal["weak", "neutral", "strong"]


class AnalyzeRequest(BaseModel):
    symbol: str


class SignalResult(BaseModel):
    name: str
    value: float
    status: SignalStatus
    note: str
    strength: float = 0.0
    probability_impact: float = 0.0


class AnalysisSignals(BaseModel):
    trend: SignalResult
    sma_crossover: SignalResult
    rsi: SignalResult
    momentum: SignalResult
    volatility: SignalResult
    news_sentiment: SignalResult
    trend_strength: SignalResult


class MacroContext(BaseModel):
    market_trend: MacroTrend
    interest_rate_effect: InterestRateEffect
    usd_strength: UsdStrength
    macro_score: int


class AnalysisResponse(BaseModel):
    symbol: str
    no_data: bool = False
    no_data_reason: Optional[str] = None
    recommendation: Optional[Recommendation] = None
    score: Optional[int] = None
    probability_up: Optional[float] = None
    probability_down: Optional[float] = None
    confidence: Optional[float] = None
    risk_level: Optional[RiskLevel] = None
    macro: Optional[MacroContext] = None
    no_trade: bool
    no_trade_reason: str
    entry_signal: bool
    entry_reason: str
    exit_signal: bool
    exit_reason: str
    stop_loss_level: Optional[float] = None
    stop_loss_reason: str
    position_size_percent: Optional[float] = None
    position_size_reason: str
    timeframe: Optional[Timeframe] = None
    warnings: List[str] = Field(default_factory=list)
    summary: str
    generated_at: datetime
    signals: Optional[AnalysisSignals] = None

    @computed_field
    @property
    def score_breakdown(self) -> Optional[Dict[str, Union[float, str]]]:
        if self.signals is None:
            return None
        return {
            "trend": self.signals.trend.strength,
            "sma_crossover": self.signals.sma_crossover.strength,
            "rsi": self.signals.rsi.strength,
            "momentum": self.signals.momentum.strength,
            "volatility": self.signals.volatility.strength,
            "news_sentiment": self.signals.news_sentiment.strength,
            "trend_strength": self.signals.trend_strength.strength,
        }

    @computed_field
    @property
    def position_size(self) -> Optional[float]:
        return self.position_size_percent

    @computed_field
    @property
    def entry_guidance(self) -> str:
        return self.entry_reason

    @computed_field
    @property
    def exit_guidance(self) -> str:
        return self.exit_reason

    @computed_field
    @property
    def stop_loss(self) -> Optional[float]:
        return self.stop_loss_level

    @computed_field
    @property
    def reason(self) -> str:
        return self.summary
