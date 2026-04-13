from fastapi import APIRouter, Depends, Query

from app.api.deps import get_finnhub_dashboard_service, require_authenticated_user_context
from app.schemas.dashboard import (
    DashboardNewsItem,
    DashboardSymbolOverview,
    DashboardWatchlistItem,
)
from app.services.finnhub_dashboard import FinnhubDashboardService


router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(require_authenticated_user_context)],
)


@router.get("/watchlist", response_model=list[DashboardWatchlistItem])
def dashboard_watchlist(
    refresh: bool = Query(default=False),
    dashboard_service: FinnhubDashboardService = Depends(get_finnhub_dashboard_service),
) -> list[DashboardWatchlistItem]:
    return dashboard_service.get_watchlist(force_refresh=refresh)


@router.get("/symbol/{symbol}", response_model=DashboardSymbolOverview)
def dashboard_symbol(
    symbol: str,
    refresh: bool = Query(default=False),
    dashboard_service: FinnhubDashboardService = Depends(get_finnhub_dashboard_service),
) -> DashboardSymbolOverview:
    return dashboard_service.get_symbol_overview(symbol, force_refresh=refresh)


@router.get("/news/{symbol}", response_model=list[DashboardNewsItem])
def dashboard_news(
    symbol: str,
    refresh: bool = Query(default=False),
    dashboard_service: FinnhubDashboardService = Depends(get_finnhub_dashboard_service),
) -> list[DashboardNewsItem]:
    return dashboard_service.get_company_news(symbol, force_refresh=refresh)
