from __future__ import annotations

from typing import Optional

from app.models.alert_rule import AlertRule
from app.schemas.analysis import AnalysisResponse


def eligible_for_buy_sell_notification(
    analysis: AnalysisResponse,
    *,
    min_confidence_partial: float,
) -> bool:
    """Structural BUY/SELL eligibility (data quality, no_trade, PARTIAL floor)."""
    if analysis.no_data or analysis.data_quality == "NO_DATA":
        return False
    if analysis.recommendation not in ("BUY", "SELL"):
        return False
    if analysis.no_trade:
        return False
    if analysis.data_quality == "FULL" and analysis.signal_quality == "FULL":
        return True
    if analysis.data_quality == "PARTIAL" or analysis.signal_quality == "PARTIAL":
        return float(analysis.confidence or 0.0) >= min_confidence_partial
    return False


def smart_alert_allowed(
    analysis: AnalysisResponse,
    *,
    rule: Optional[AlertRule],
    default_partial_min: float,
) -> bool:
    """Favorites / rules: optional AlertRule gates BUY/SELL + confidence floor."""
    partial_floor = float(rule.min_confidence) if rule is not None else float(default_partial_min)
    if not eligible_for_buy_sell_notification(analysis, min_confidence_partial=partial_floor):
        return False
    conf = float(analysis.confidence or 0.0)
    if rule is not None:
        if not rule.enabled:
            return False
        if conf < float(rule.min_confidence):
            return False
        rec = analysis.recommendation
        if rec == "BUY" and not rule.notify_on_buy:
            return False
        if rec == "SELL" and not rule.notify_on_sell:
            return False
    return True
