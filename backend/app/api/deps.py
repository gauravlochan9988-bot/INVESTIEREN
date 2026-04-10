from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from fastapi import Depends, Header
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import AdminSessionManager, ClerkTokenVerifier
from app.core.config import get_settings
from app.core.database import get_db, get_session_factory
from app.repositories.alert_repository import AlertRepository
from app.repositories.alert_rule import AlertRuleRepository
from app.repositories.analysis_log import AnalysisLogRepository
from app.repositories.analysis_threshold import AnalysisThresholdRepository
from app.repositories.app_subscription import AppSubscriptionRepository
from app.repositories.app_user import AppUserRepository
from app.repositories.favorite_symbol import FavoriteSymbolRepository
from app.repositories.portfolio import PortfolioRepository
from app.repositories.trade_performance import TradePerformanceRepository
from app.repositories.user_notification import UserNotificationRepository
from app.services.alerts import AlertService
from app.services.analysis_calibration import AnalysisCalibrationService
from app.services.analysis import AnalysisService
from app.services.favorite_signal_monitor import FavoriteSignalMonitorService
from app.services.billing import BillingService
from app.services.finnhub_dashboard import FinnhubDashboardService
from app.services.macro import MacroContextService
from app.services.market_data import (
    CompositeMarketDataProvider,
    FinnhubQuoteProvider,
    MarketDataService,
    YFinanceProvider,
)
from app.services.news import (
    ChainedNewsProvider,
    FinnhubNewsProvider,
    NewsSentimentService,
    YFinanceNewsProvider,
)
from app.services.portfolio import PortfolioService
from app.services.search import StockSearchService, build_stock_search_service
from app.services.strategy_learning import StrategyLearningService
from app.services.summary import SummaryService
from app.services.trade_history import TradeHistoryService
from app.services.user_alerts import UserAlertService

FIXED_STRATEGY_THRESHOLDS: dict[str, tuple[float, float]] = {
    "simple": (3.0, -3.0),
    "ai": (2.0, -2.0),
    "hedgefund": (4.0, -4.0),
}


def get_dashboard_watchlist_symbols() -> tuple[str, ...]:
    """Ordered symbols for `/api/dashboard/watchlist` and dashboard preload.

    Single source of truth: ``Settings.watchlist`` (``DEFAULT_WATCHLIST`` in config, overridable via env).
    Must be a superset of frontend ``DEFAULT_SIDEBAR_ITEMS`` in ``app.js`` so the sidebar never
    falls back to placeholder rows for missing API keys.
    """
    return tuple(get_settings().watchlist.keys())


@dataclass
class RequestUserContext:
    user_key: str
    app_user_id: Optional[int]
    is_authenticated: bool
    is_admin: bool = False


@lru_cache
def get_market_data_service_instance() -> MarketDataService:
    settings = get_settings()
    return MarketDataService(
        provider=CompositeMarketDataProvider(
            [
                FinnhubQuoteProvider(settings.finnhub_api_key, timeout_seconds=2.0),
                YFinanceProvider(),
            ],
            timeout_seconds=2.0,
        ),
        allowed_symbols=settings.watchlist,
        ttl_seconds=settings.market_cache_ttl_seconds,
    )


@lru_cache
def get_summary_service_instance() -> SummaryService:
    return SummaryService()


@lru_cache
def get_macro_context_service_instance() -> MacroContextService:
    settings = get_settings()
    return MacroContextService(
        provider=YFinanceProvider(),
        ttl_seconds=settings.macro_cache_ttl_seconds,
        market_symbol=settings.macro_market_symbol,
        usd_symbol=settings.macro_usd_symbol,
        interest_rate_effect=settings.macro_interest_rate_effect,
    )


@lru_cache
def get_news_sentiment_service_instance() -> NewsSentimentService:
    settings = get_settings()
    provider = (
        ChainedNewsProvider(
            [
                FinnhubNewsProvider(settings.finnhub_api_key),
                YFinanceNewsProvider(),
            ]
        )
        if settings.finnhub_api_key
        else YFinanceNewsProvider()
    )
    return NewsSentimentService(
        provider=provider,
        ttl_seconds=settings.news_cache_ttl_seconds,
        headline_limit=settings.news_headline_limit,
    )


@lru_cache
def get_analysis_service_instance() -> AnalysisService:
    settings = get_settings()
    service = AnalysisService(
        market_data_service=get_market_data_service_instance(),
        macro_context_service=get_macro_context_service_instance(),
        news_sentiment_service=get_news_sentiment_service_instance(),
        summary_service=get_summary_service_instance(),
        strategy_learning_service=get_strategy_learning_service_instance(),
        analysis_cache_ttl_seconds=settings.analysis_cache_ttl_seconds,
        indicator_cache_ttl_seconds=settings.indicators_cache_ttl_seconds,
        alerts_cache_ttl_seconds=settings.alerts_cache_ttl_seconds,
    )
    session = get_session_factory()()
    try:
        rows = get_analysis_threshold_repository_instance().save_many(
            session,
            thresholds=[
                (strategy, thresholds[0], thresholds[1])
                for strategy, thresholds in FIXED_STRATEGY_THRESHOLDS.items()
            ],
        )
        for row in rows:
            service.set_strategy_thresholds(
                strategy=row.strategy,
                buy_threshold=row.buy_threshold,
                sell_threshold=row.sell_threshold,
            )
    finally:
        session.close()
    return service


@lru_cache
def get_portfolio_repository_instance() -> PortfolioRepository:
    return PortfolioRepository()


@lru_cache
def get_analysis_log_repository_instance() -> AnalysisLogRepository:
    return AnalysisLogRepository()


@lru_cache
def get_analysis_threshold_repository_instance() -> AnalysisThresholdRepository:
    return AnalysisThresholdRepository()


@lru_cache
def get_app_user_repository_instance() -> AppUserRepository:
    return AppUserRepository()


@lru_cache
def get_app_subscription_repository_instance() -> AppSubscriptionRepository:
    return AppSubscriptionRepository()


@lru_cache
def get_alert_repository_instance() -> AlertRepository:
    return AlertRepository()


@lru_cache
def get_favorite_symbol_repository_instance() -> FavoriteSymbolRepository:
    return FavoriteSymbolRepository()


@lru_cache
def get_alert_rule_repository_instance() -> AlertRuleRepository:
    return AlertRuleRepository()


@lru_cache
def get_user_notification_repository_instance() -> UserNotificationRepository:
    return UserNotificationRepository()


@lru_cache
def get_trade_performance_repository_instance() -> TradePerformanceRepository:
    return TradePerformanceRepository()


@lru_cache
def get_strategy_learning_service_instance() -> StrategyLearningService:
    return StrategyLearningService(
        trade_performance_repository=get_trade_performance_repository_instance(),
        analysis_threshold_repository=get_analysis_threshold_repository_instance(),
    )


@lru_cache
def get_portfolio_service_instance() -> PortfolioService:
    return PortfolioService(
        market_data_service=get_market_data_service_instance(),
        portfolio_repository=get_portfolio_repository_instance(),
        trade_performance_repository=get_trade_performance_repository_instance(),
        analysis_log_repository=get_analysis_log_repository_instance(),
    )


def get_market_data_service() -> MarketDataService:
    return get_market_data_service_instance()


@lru_cache
def get_finnhub_dashboard_service_instance() -> FinnhubDashboardService:
    """Cached Finnhub dashboard service (watchlist universe fixed at first call).

    After changing ``WATCHLIST``/settings or deploying new default symbols, restart the process
    (e.g. Railway redeploy/restart) so ``@lru_cache`` picks up the new symbol set. Runtime
    ``get_settings().watchlist`` changes alone do not refresh this instance.
    """
    settings = get_settings()
    symbols = get_dashboard_watchlist_symbols()
    return FinnhubDashboardService(
        api_key=settings.finnhub_api_key,
        watchlist={symbol: settings.watchlist.get(symbol, symbol) for symbol in symbols},
        news_sentiment_service=get_news_sentiment_service_instance(),
        ttl_seconds=settings.market_cache_ttl_seconds,
    )


def get_finnhub_dashboard_service() -> FinnhubDashboardService:
    return get_finnhub_dashboard_service_instance()


def get_analysis_service() -> AnalysisService:
    return get_analysis_service_instance()


def get_portfolio_service() -> PortfolioService:
    return get_portfolio_service_instance()


def get_analysis_log_repository() -> AnalysisLogRepository:
    return get_analysis_log_repository_instance()


@lru_cache
def get_analysis_calibration_service_instance() -> AnalysisCalibrationService:
    return AnalysisCalibrationService(
        analysis_log_repository=get_analysis_log_repository_instance(),
        analysis_threshold_repository=get_analysis_threshold_repository_instance(),
        analysis_service=get_analysis_service_instance(),
    )


def get_analysis_threshold_repository() -> AnalysisThresholdRepository:
    return get_analysis_threshold_repository_instance()


@lru_cache
def get_clerk_verifier_instance() -> ClerkTokenVerifier:
    settings = get_settings()
    return ClerkTokenVerifier(
        jwt_key=settings.clerk_jwt_key,
        authorized_party=settings.frontend_origin,
    )


def get_clerk_verifier() -> ClerkTokenVerifier:
    return get_clerk_verifier_instance()


@lru_cache
def get_admin_session_manager_instance() -> AdminSessionManager:
    settings = get_settings()
    return AdminSessionManager(secret=settings.admin_session_secret)


def get_admin_session_manager() -> AdminSessionManager:
    return get_admin_session_manager_instance()


def get_app_user_repository() -> AppUserRepository:
    return get_app_user_repository_instance()


def get_app_subscription_repository() -> AppSubscriptionRepository:
    return get_app_subscription_repository_instance()


def get_request_user_context(
    authorization: Optional[str] = Header(default=None),
    x_admin_session: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
    verifier: ClerkTokenVerifier = Depends(get_clerk_verifier),
    admin_session_manager: AdminSessionManager = Depends(get_admin_session_manager),
    app_user_repository: AppUserRepository = Depends(get_app_user_repository),
) -> RequestUserContext:
    if x_admin_session and admin_session_manager.enabled:
        claims = admin_session_manager.verify(x_admin_session.strip())
        user = app_user_repository.upsert_from_claims(
            db,
            auth_subject=str(claims.get("sub") or "admin-access|local").strip() or "admin-access|local",
            provider=str(claims.get("provider") or "admin_access"),
            email=None,
            name="Admin Access",
            picture_url=None,
        )
        return RequestUserContext(
            user_key=user.auth_subject,
            app_user_id=user.id,
            is_authenticated=True,
            is_admin=True,
        )

    if not authorization or not verifier.enabled:
        return RequestUserContext(user_key="default", app_user_id=None, is_authenticated=False)

    from app.core.auth import extract_bearer_token

    token = extract_bearer_token(authorization)
    claims = verifier.verify(token)
    auth_subject = str(claims.get("sub") or "").strip()
    if not auth_subject:
        return RequestUserContext(user_key="default", app_user_id=None, is_authenticated=False)

    user = app_user_repository.upsert_from_claims(
        db,
        auth_subject=auth_subject,
        provider="clerk",
        email=(claims.get("email") or None),
        name=(claims.get("full_name") or claims.get("name") or claims.get("username") or None),
        picture_url=(claims.get("image_url") or claims.get("picture") or None),
    )
    return RequestUserContext(
        user_key=user.auth_subject,
        app_user_id=user.id,
        is_authenticated=True,
        is_admin=False,
    )


def require_authenticated_user_context(
    user_context: RequestUserContext = Depends(get_request_user_context),
) -> RequestUserContext:
    if not user_context.is_authenticated or not user_context.app_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return user_context


def require_full_access_user_context(
    user_context: RequestUserContext = Depends(require_authenticated_user_context),
    db: Session = Depends(get_db),
    subscription_repository: AppSubscriptionRepository = Depends(get_app_subscription_repository),
) -> RequestUserContext:
    if user_context.is_admin:
        return user_context

    subscription = subscription_repository.get_by_user_id(db, app_user_id=user_context.app_user_id)
    if subscription and subscription.status in {"active", "trialing"}:
        return user_context

    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail="Active subscription required.",
    )


def get_analysis_calibration_service() -> AnalysisCalibrationService:
    return get_analysis_calibration_service_instance()


@lru_cache
def get_billing_service_instance() -> BillingService:
    return BillingService(
        settings=get_settings(),
        subscription_repository=get_app_subscription_repository_instance(),
    )


def get_billing_service() -> BillingService:
    return get_billing_service_instance()


def get_trade_performance_repository() -> TradePerformanceRepository:
    return get_trade_performance_repository_instance()


def get_strategy_learning_service() -> StrategyLearningService:
    return get_strategy_learning_service_instance()


@lru_cache
def get_stock_search_service_instance() -> StockSearchService:
    return build_stock_search_service()


def get_stock_search_service() -> StockSearchService:
    return get_stock_search_service_instance()


def get_alert_repository() -> AlertRepository:
    return get_alert_repository_instance()


def get_favorite_symbol_repository() -> FavoriteSymbolRepository:
    return get_favorite_symbol_repository_instance()


def get_alert_service_instance() -> AlertService:
    settings = get_settings()
    return AlertService(
        analysis_service=get_analysis_service_instance(),
        market_data_service=get_market_data_service_instance(),
        alert_repository=get_alert_repository_instance(),
        favorite_repository=get_favorite_symbol_repository_instance(),
        alert_rule_repository=get_alert_rule_repository_instance(),
        default_symbols=tuple(settings.watchlist.keys()),
    )


def get_alert_service() -> AlertService:
    return get_alert_service_instance()


@lru_cache
def get_favorite_signal_monitor_service_instance() -> FavoriteSignalMonitorService:
    settings = get_settings()
    return FavoriteSignalMonitorService(
        analysis_service=get_analysis_service_instance(),
        market_data_service=get_market_data_service_instance(),
        alert_repository=get_alert_repository_instance(),
        favorite_repository=get_favorite_symbol_repository_instance(),
        alert_rule_repository=get_alert_rule_repository_instance(),
        notification_repository=get_user_notification_repository_instance(),
        min_confidence_partial=float(settings.favorite_signal_min_confidence_partial),
    )


def get_favorite_signal_monitor_service() -> FavoriteSignalMonitorService:
    return get_favorite_signal_monitor_service_instance()


@lru_cache
def get_user_alert_service_instance() -> UserAlertService:
    return UserAlertService(
        analysis_service=get_analysis_service_instance(),
        alert_rule_repository=get_alert_rule_repository_instance(),
        notification_repository=get_user_notification_repository_instance(),
        favorite_repository=get_favorite_symbol_repository_instance(),
    )


def get_user_alert_service() -> UserAlertService:
    return get_user_alert_service_instance()


@lru_cache
def get_trade_history_service_instance() -> TradeHistoryService:
    return TradeHistoryService(
        market_data_service=get_market_data_service_instance(),
        trade_performance_repository=get_trade_performance_repository_instance(),
    )


def get_trade_history_service() -> TradeHistoryService:
    return get_trade_history_service_instance()
