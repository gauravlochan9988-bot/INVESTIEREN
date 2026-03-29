from __future__ import annotations

from typing import Iterable, Sequence

from app.core.config import get_settings
from app.schemas.analysis import MacroContext, Recommendation, RiskLevel, SignalResult, Timeframe


class SummaryService:
    def summarize(
        self,
        symbol: str,
        recommendation: Recommendation,
        probability_up: float,
        probability_down: float,
        confidence: float,
        risk_level: RiskLevel,
        macro: MacroContext,
        no_trade: bool,
        no_trade_reason: str,
        signals: Iterable[SignalResult],
        warnings: Sequence[str],
        conflicts: Sequence[str],
        entry_signal: bool,
        entry_reason: str,
        exit_signal: bool,
        exit_reason: str,
        stop_loss_level: float,
        stop_loss_reason: str,
        position_size_percent: float,
        position_size_reason: str,
        timeframe: Timeframe,
    ) -> str:
        signal_list = list(signals)
        fallback = self._rule_based_summary(
            symbol=symbol,
            recommendation=recommendation,
            probability_up=probability_up,
            probability_down=probability_down,
            confidence=confidence,
            risk_level=risk_level,
            macro=macro,
            no_trade=no_trade,
            no_trade_reason=no_trade_reason,
            signals=signal_list,
            warnings=warnings,
            conflicts=conflicts,
            entry_signal=entry_signal,
            entry_reason=entry_reason,
            exit_signal=exit_signal,
            exit_reason=exit_reason,
            stop_loss_level=stop_loss_level,
            stop_loss_reason=stop_loss_reason,
            position_size_percent=position_size_percent,
            position_size_reason=position_size_reason,
            timeframe=timeframe,
        )

        settings = get_settings()
        if not settings.openai_api_key:
            return fallback

        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            prompt = (
                "Explain this investment-analysis setup in exactly one short sentence under 140 characters. "
                "Use only the provided factors. "
                "Do not change the recommendation and do not imply certainty. "
                "Frame it as decision support, not a trading command. "
                "Do not mention stop loss, sizing, confidence, risk labels, or exact percentages because the UI already shows them. "
                "Prefer plain language like mixed, supportive, weak, uncertain, negative news, or high volatility.\n"
                f"Symbol: {symbol}\n"
                f"Recommendation: {recommendation}\n"
                f"Probability up: {probability_up:.2f}\n"
                f"Probability down: {probability_down:.2f}\n"
                f"Confidence: {confidence:.2f}\n"
                f"Risk level: {risk_level}\n"
                f"No trade: {no_trade}\n"
                f"No trade reason: {no_trade_reason}\n"
                f"Macro market trend: {macro.market_trend}\n"
                f"Macro interest rate effect: {macro.interest_rate_effect}\n"
                f"Macro USD strength: {macro.usd_strength}\n"
                f"Macro score: {macro.macro_score}\n"
                f"Timeframe: {timeframe}\n"
                f"Entry signal: {entry_signal}\n"
                f"Entry reason: {entry_reason}\n"
                f"Exit signal: {exit_signal}\n"
                f"Exit reason: {exit_reason}\n"
                f"Stop loss level: {stop_loss_level:.2f}\n"
                f"Stop loss reason: {stop_loss_reason}\n"
                f"Position size percent: {position_size_percent:.1f}\n"
                f"Position size reason: {position_size_reason}\n"
                f"Warnings: {', '.join(warnings) if warnings else 'none'}\n"
                f"Conflicts: {', '.join(conflicts) if conflicts else 'none'}\n"
                "Factors:\n"
                + "\n".join(
                    f"- {signal.name}: {signal.status} ({signal.note})" for signal in signal_list
                )
            )
            response = client.responses.create(
                model=settings.openai_model,
                input=prompt,
                max_output_tokens=60,
            )
            text = getattr(response, "output_text", "").strip()
            return self._compact_summary(text) or fallback
        except Exception:
            return fallback

    def _rule_based_summary(
        self,
        symbol: str,
        recommendation: Recommendation,
        probability_up: float,
        probability_down: float,
        confidence: float,
        risk_level: RiskLevel,
        macro: MacroContext,
        no_trade: bool,
        no_trade_reason: str,
        signals: list[SignalResult],
        warnings: Sequence[str],
        conflicts: Sequence[str],
        entry_signal: bool,
        entry_reason: str,
        exit_signal: bool,
        exit_reason: str,
        stop_loss_level: float,
        stop_loss_reason: str,
        position_size_percent: float,
        position_size_reason: str,
        timeframe: Timeframe,
    ) -> str:
        if no_trade:
            summary = f"{symbol}: no clear trade right now because {no_trade_reason.rstrip('.').lower()}."
            return self._compact_summary(summary) or f"{symbol}: no clear trade right now."

        positive_driver = self._top_driver(signals, positive=True)
        negative_driver = self._top_driver(signals, positive=False)
        caution_text = self._caution_text(warnings=warnings, conflicts=conflicts)
        macro_text = self._macro_text(macro)

        if entry_signal:
            base = f"{symbol} has a usable setup"
            driver = positive_driver or "trend and momentum are supportive"
        elif exit_signal:
            base = f"{symbol} needs caution"
            driver = negative_driver or "downside pressure is building"
        elif recommendation == "BUY":
            base = f"{symbol} looks constructive"
            driver = positive_driver or "trend and momentum are supportive"
        elif recommendation == "SELL":
            base = f"{symbol} looks weak"
            driver = negative_driver or "selling pressure still dominates"
        else:
            base = f"{symbol} looks mixed"
            driver = positive_driver or negative_driver or "signals remain balanced"

        summary = f"{base}: {driver}; {macro_text}{caution_text}."
        return self._compact_summary(summary) or f"{symbol} looks mixed."

    def _top_driver(self, signals: Sequence[SignalResult], positive: bool) -> str:
        filtered = [
            signal
            for signal in signals
            if (signal.probability_impact > 0.12 if positive else signal.probability_impact < -0.12)
        ]
        if not filtered:
            return ""

        top_signal = sorted(filtered, key=lambda signal: abs(signal.probability_impact), reverse=True)[0]
        names = {
            "Trend": "trend is supportive" if positive else "trend is weakening",
            "SMA Crossover": "moving averages are supportive" if positive else "moving averages are rolling over",
            "RSI": "RSI is supportive" if positive else "RSI is overbought or weakening",
            "Momentum": "momentum is supportive" if positive else "momentum is fading",
            "Volatility": "volatility is contained" if positive else "volatility is elevated",
            "News Sentiment": "news flow is supportive" if positive else "news flow is negative",
            "Trend Strength": "trend strength is improving" if positive else "trend strength is weak",
        }
        return names.get(top_signal.name, top_signal.name.lower())

    def _macro_text(self, macro: MacroContext) -> str:
        if macro.market_trend == "bearish":
            return "the broader market is weak"
        if macro.market_trend == "bullish" and macro.macro_score > 0:
            return "the broader market is supportive"
        if macro.interest_rate_effect == "negative":
            return "rates are a headwind"
        if macro.usd_strength == "strong":
            return "a strong dollar adds friction"
        return "macro context is mixed"

    def _caution_text(self, *, warnings: Sequence[str], conflicts: Sequence[str]) -> str:
        if "Setup Unclear" in warnings:
            return ", and the setup remains unclear"
        if "Too Many Conflicting Signals" in warnings:
            return ", with too many conflicting signals"
        if "No Clear Trend" in warnings:
            return ", because trend conviction is weak"
        if "Market Uncertain" in warnings or conflicts:
            return ", with elevated uncertainty"
        if "Overall Market Weak" in warnings or "Macro Headwind" in warnings:
            return ", so the broader backdrop argues for caution"
        if "Rates Pressure Equities" in warnings:
            return ", while rates still pressure equities"
        if "USD Strong" in warnings:
            return ", with the dollar acting as a headwind"
        if "Negative News" in warnings:
            return ", and negative news adds risk"
        if "No Recent News" in warnings:
            return ", and there is little recent news context"
        if "High Volatility" in warnings:
            return ", while volatility stays high"
        if "Overbought" in warnings:
            return ", and the move looks stretched"
        return ""

    def _compact_summary(self, text: str) -> str:
        compact = " ".join(text.split())
        if not compact:
            return ""

        first_sentence = compact.split(". ")[0].rstrip(".")
        if len(first_sentence) > 140:
            first_sentence = first_sentence[:137].rsplit(" ", 1)[0].rstrip(",;:") + "..."

        if not first_sentence.endswith("."):
            first_sentence += "."
        return first_sentence
