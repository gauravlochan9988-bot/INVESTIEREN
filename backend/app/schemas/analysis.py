from datetime import datetime
from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, computed_field

from app.schemas.analysis_tracking import StrategyThresholds


Recommendation = Literal["BUY", "HOLD", "SELL"]
SignalQuality = Literal["FULL", "PARTIAL"]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
DataQuality = Literal["FULL", "PARTIAL", "NO_DATA"]
SignalStatus = Literal["BULLISH", "NEUTRAL", "BEARISH"]
Timeframe = Literal["short_term", "mid_term", "unclear"]
MacroTrend = Literal["bullish", "neutral", "bearish"]
InterestRateEffect = Literal["positive", "neutral", "negative"]
UsdStrength = Literal["weak", "neutral", "strong"]
Strategy = Literal["simple", "ai", "hedgefund"]
AlertTone = Literal["bullish", "bearish", "neutral"]
AlertKind = Literal["recommendation", "rsi", "entry", "exit"]


class AnalyzeRequest(BaseModel):
    symbol: str
    strategy: Strategy = "hedgefund"


class AnalysisAlert(BaseModel):
    symbol: str
    strategy: Strategy
    kind: AlertKind
    tone: AlertTone
    title: str
    message: str
    priority: int


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


class LearningInsight(BaseModel):
    version: str
    active: bool
    trade_count: int
    min_trades_required: int
    win_rate: float
    average_profit_loss: float
    average_profit: float
    average_loss: float
    drawdown: float
    buy_accuracy: float = 0.0
    sell_error_rate: float = 0.0
    confidence_bias: float
    directional_bias: float
    weak_signal_multiplier: float
    buy_threshold_offset: float = 0.0
    sell_threshold_offset: float = 0.0
    thresholds: Optional[StrategyThresholds] = None
    effective_thresholds: Optional[StrategyThresholds] = None
    adjustment_count: int = 0
    note: str


class AnalysisResponse(BaseModel):
    symbol: str
    strategy: Strategy
    no_data: bool = False
    no_data_reason: Optional[str] = None
    recommendation: Optional[Recommendation] = None
    signal_quality: Optional[SignalQuality] = None
    score: Optional[int] = None
    probability_up: Optional[float] = None
    probability_down: Optional[float] = None
    confidence: Optional[float] = None
    risk_level: Optional[RiskLevel] = None
    data_quality: DataQuality
    data_quality_reason: str
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
    learning: Optional[LearningInsight] = None

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
    def risk(self) -> Optional[RiskLevel]:
        return self.risk_level

    @computed_field
    @property
    def decision_label(self) -> str:
        if self.no_data or self.recommendation is None:
            return "NO_DATA"
        if self.signal_quality == "PARTIAL":
            if self.recommendation in {"BUY", "SELL"}:
                return f"{self.recommendation} PARTIAL"
            return "PARTIAL"
        if self.signal_quality == "FULL" and self.recommendation in {"BUY", "SELL"}:
            return f"{self.recommendation} FULL"
        return self.recommendation

    @computed_field
    @property
    def reason(self) -> str:
        return self.summary
