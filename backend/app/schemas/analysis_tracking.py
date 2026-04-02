from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class StrategyThresholds(BaseModel):
    buy_threshold: float
    sell_threshold: float
    updated_at: Optional[datetime] = None


class StrategyDistributionStats(BaseModel):
    strategy: str
    total: int
    buy_count: int
    sell_count: int
    hold_count: int
    buy_percent: float
    sell_percent: float
    hold_percent: float
    thresholds: StrategyThresholds


class AnalysisDistributionStats(BaseModel):
    strategies: list[StrategyDistributionStats]


class StrategyLearningStats(BaseModel):
    strategy: str
    learning_version: str
    trade_count: int
    eligible: bool
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
    effective_thresholds: Optional[StrategyThresholds] = None
    adjustment_count: int = 0
    note: str
    thresholds: Optional[StrategyThresholds] = None


class StrategyLearningStatsResponse(BaseModel):
    version: str
    strategies: list[StrategyLearningStats]
