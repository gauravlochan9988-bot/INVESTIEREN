from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


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
