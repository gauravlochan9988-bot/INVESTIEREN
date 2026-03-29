from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List

from app.schemas.stocks import HistoryPoint
from app.core.exceptions import NotFoundError
from app.services.market_data import QuoteSnapshot
from app.services.search import SearchSnapshot
from app.services.summary import SummaryService


class FakeSummaryService(SummaryService):
    def summarize(
        self,
        symbol,
        recommendation,
        probability_up,
        probability_down,
        confidence,
        risk_level,
        macro,
        no_trade,
        no_trade_reason,
        signals,
        warnings,
        conflicts,
        entry_signal,
        entry_reason,
        exit_signal,
        exit_reason,
        stop_loss_level,
        stop_loss_reason,
        position_size_percent,
        position_size_reason,
        timeframe,
    ):
        return (
            f"{symbol} -> {recommendation} "
            f"({probability_up:.2f}/{probability_down:.2f}, entry={entry_signal}, no_trade={no_trade}, size={position_size_percent:.1f}, macro={macro.macro_score})"
        )


def build_history(start: float, drift: float, noise: float = 0.005) -> List[HistoryPoint]:
    base = datetime(2025, 1, 1, tzinfo=timezone.utc)
    points: List[HistoryPoint] = []
    price = start
    for index in range(120):
        cycle = ((index % 7) - 3) * noise
        price = max(1.0, price + drift + price * cycle)
        points.append(HistoryPoint(date=base + timedelta(days=index), close=round(price, 4)))
    return points


class FakeMarketDataProvider:
    def __init__(self):
        self.quote_calls = 0
        self.history_calls = 0
        self.history_map: Dict[str, List[HistoryPoint]] = {
            "AAPL": build_history(start=150.0, drift=0.9),
            "MSFT": build_history(start=300.0, drift=0.5),
            "TSLA": build_history(start=210.0, drift=-0.55, noise=0.012),
            "NVDA": build_history(start=115.0, drift=0.7, noise=0.004),
            "AMZN": build_history(start=165.0, drift=0.35, noise=0.003),
            "NFLX": build_history(start=430.0, drift=0.05, noise=0.003),
            "SPY": build_history(start=470.0, drift=0.28, noise=0.002),
            "DXY": build_history(start=104.0, drift=-0.03, noise=0.001),
        }

    def fetch_quotes(
        self, symbols: Iterable[str], names: Dict[str, str]
    ) -> List[QuoteSnapshot]:
        self.quote_calls += 1
        snapshots = []
        for symbol in symbols:
            if symbol not in self.history_map:
                raise NotFoundError(f"No market data found for symbol {symbol}.")
            history = self.history_map[symbol]
            current = history[-1].close
            previous = history[-2].close
            change_percent = ((current - previous) / previous * 100) if previous else 0.0
            snapshots.append(
                QuoteSnapshot(
                    symbol=symbol,
                    name=names[symbol],
                    price=round(current, 2),
                    change_percent=round(change_percent, 2),
                    volume=1_000_000 + self.quote_calls,
                    updated_at=datetime.now(timezone.utc),
                )
            )
        return snapshots

    def fetch_history(self, symbol: str, period: str) -> List[HistoryPoint]:
        self.history_calls += 1
        if symbol not in self.history_map:
            raise NotFoundError(f"No market data found for symbol {symbol}.")
        return self.history_map[symbol]


class FakeNewsProvider:
    def __init__(self):
        now = datetime(2025, 3, 1, tzinfo=timezone.utc)
        self.calls = 0
        self.news_map: Dict[str, List[dict]] = {
            "AAPL": [
                {
                    "content": {
                        "title": "Apple beats revenue expectations as iPhone demand stays strong",
                        "summary": "Analysts turn bullish after stronger growth and profit outlook.",
                        "pubDate": now.isoformat(),
                    }
                },
                {
                    "content": {
                        "title": "Apple upgrade highlights strong services growth",
                        "summary": "The report points to resilient demand and record margins.",
                        "pubDate": (now - timedelta(hours=6)).isoformat(),
                    }
                },
            ],
            "MSFT": [
                {
                    "content": {
                        "title": "Microsoft faces lawsuit risk and probe despite recent rally",
                        "summary": "Negative headlines outweigh the recent strength as legal concerns grow.",
                        "pubDate": now.isoformat(),
                    }
                }
            ],
            "TSLA": [
                {
                    "content": {
                        "title": "Tesla drops after downgrade and weak delivery warning",
                        "summary": "The bearish note highlights decline risk and slowing demand.",
                        "pubDate": now.isoformat(),
                    }
                },
                {
                    "content": {
                        "title": "Tesla faces probe as analysts cut targets",
                        "summary": "More negative headlines add pressure to the near-term setup.",
                        "pubDate": (now - timedelta(hours=4)).isoformat(),
                    }
                },
            ],
            "NVDA": [],
            "AMZN": [
                {
                    "content": {
                        "title": "Amazon partnership could expand ad growth",
                        "summary": "The news is constructive, but the market reaction remains mixed.",
                        "pubDate": now.isoformat(),
                    }
                }
            ],
        }

    def fetch_news(self, symbol: str, limit: int) -> List[dict]:
        self.calls += 1
        return self.news_map.get(symbol, [])[:limit]


class FakeSearchProvider:
    def __init__(self):
        self.calls = 0
        self.results = {
            "ap": [
                SearchSnapshot(symbol="AAPL", name="Apple Inc"),
                SearchSnapshot(symbol="APD", name="Air Products and Chemicals"),
            ],
            "coin": [
                SearchSnapshot(symbol="COIN", name="Coinbase Global"),
            ],
            "core": [
                SearchSnapshot(symbol="IVV", name="iShares Core S&P 500 ETF"),
                SearchSnapshot(symbol="VTI", name="Vanguard Total Stock Market ETF"),
            ],
        }

    def search(self, query: str, limit: int) -> List[SearchSnapshot]:
        self.calls += 1
        return self.results.get(query.lower(), [])[:limit]
