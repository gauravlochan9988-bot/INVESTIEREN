from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import (
    get_alert_service,
    get_analysis_calibration_service,
    get_analysis_service,
    get_market_data_service,
    get_portfolio_service,
    get_stock_search_service,
    get_trade_history_service,
)
from app.core.database import get_db
from app.models import Base
from app.repositories.alert_repository import AlertRepository
from app.repositories.analysis_log import AnalysisLogRepository
from app.repositories.analysis_threshold import AnalysisThresholdRepository
from app.repositories.favorite_symbol import FavoriteSymbolRepository
from app.repositories.portfolio import PortfolioRepository
from app.repositories.trade_performance import TradePerformanceRepository
from app.services.analysis import AnalysisService
from app.services.analysis_calibration import AnalysisCalibrationService
from app.services.alerts import AlertService
from app.services.macro import MacroContextService
from app.services.market_data import MarketDataService
from app.services.news import NewsSentimentService
from app.services.portfolio import PortfolioService
from app.services.search import StockSearchService
from app.services.strategy_learning import StrategyLearningService
from app.services.trade_history import TradeHistoryService
from app.main import create_app
from tests.helpers import FakeMarketDataProvider, FakeNewsProvider, FakeSearchProvider, FakeSummaryService


@pytest.fixture
def fake_market_data_provider() -> FakeMarketDataProvider:
    return FakeMarketDataProvider()


@pytest.fixture
def market_data_service(fake_market_data_provider: FakeMarketDataProvider) -> MarketDataService:
    return MarketDataService(
        provider=fake_market_data_provider,
        allowed_symbols={
            "AAPL": "Apple",
            "MSFT": "Microsoft",
            "TSLA": "Tesla",
            "NVDA": "NVIDIA",
            "AMZN": "Amazon",
        },
        ttl_seconds=3600,
    )


@pytest.fixture
def news_sentiment_service() -> NewsSentimentService:
    return NewsSentimentService(provider=FakeNewsProvider(), ttl_seconds=3600, headline_limit=8)


@pytest.fixture
def macro_context_service(fake_market_data_provider: FakeMarketDataProvider) -> MacroContextService:
    return MacroContextService(
        provider=fake_market_data_provider,
        ttl_seconds=3600,
        market_symbol="SPY",
        usd_symbol="DXY",
        interest_rate_effect="neutral",
    )


@pytest.fixture
def analysis_service(
    market_data_service: MarketDataService,
    news_sentiment_service: NewsSentimentService,
    macro_context_service: MacroContextService,
) -> AnalysisService:
    return AnalysisService(
        market_data_service=market_data_service,
        macro_context_service=macro_context_service,
        news_sentiment_service=news_sentiment_service,
        summary_service=FakeSummaryService(),
        strategy_learning_service=StrategyLearningService(
            trade_performance_repository=TradePerformanceRepository(),
            analysis_threshold_repository=AnalysisThresholdRepository(),
            min_trades_required=50,
        ),
    )


@pytest.fixture
def stock_search_service() -> StockSearchService:
    return StockSearchService(provider=FakeSearchProvider(), ttl_seconds=3600)


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def client(
    db_session: Session,
    market_data_service: MarketDataService,
    analysis_service: AnalysisService,
    stock_search_service: StockSearchService,
) -> TestClient:
    app = create_app()
    portfolio_service = PortfolioService(
        market_data_service=market_data_service,
        portfolio_repository=PortfolioRepository(),
        trade_performance_repository=TradePerformanceRepository(),
        analysis_log_repository=AnalysisLogRepository(),
    )
    calibration_service = AnalysisCalibrationService(
        analysis_log_repository=AnalysisLogRepository(),
        analysis_threshold_repository=AnalysisThresholdRepository(),
        analysis_service=analysis_service,
        minimum_samples=10,
        tolerance_percent=3.0,
        max_adjustment_step=0.5,
    )
    alert_service = AlertService(
        analysis_service=analysis_service,
        market_data_service=market_data_service,
        alert_repository=AlertRepository(),
        favorite_repository=FavoriteSymbolRepository(),
        default_symbols=tuple(market_data_service.allowed_symbols.keys()),
    )
    trade_history_service = TradeHistoryService(
        market_data_service=market_data_service,
        trade_performance_repository=TradePerformanceRepository(),
    )

    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_market_data_service] = lambda: market_data_service
    app.dependency_overrides[get_analysis_service] = lambda: analysis_service
    app.dependency_overrides[get_analysis_calibration_service] = lambda: calibration_service
    app.dependency_overrides[get_alert_service] = lambda: alert_service
    app.dependency_overrides[get_portfolio_service] = lambda: portfolio_service
    app.dependency_overrides[get_stock_search_service] = lambda: stock_search_service
    app.dependency_overrides[get_trade_history_service] = lambda: trade_history_service

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def sample_position_payload() -> dict:
    return {
        "symbol": "AAPL",
        "quantity": 3,
        "average_price": 155.5,
        "opened_at": date(2025, 1, 15).isoformat(),
    }
