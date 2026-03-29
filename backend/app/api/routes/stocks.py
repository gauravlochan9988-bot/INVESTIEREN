from fastapi import APIRouter, Depends, Query

from app.api.deps import get_market_data_service
from app.schemas.stocks import StockHistoryResponse, StockQuote
from app.services.market_data import MarketDataService

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("", response_model=list[StockQuote])
def list_stocks(
    market_data_service: MarketDataService = Depends(get_market_data_service),
) -> list[StockQuote]:
    return market_data_service.get_watchlist_quotes()


@router.get("/{symbol}/history", response_model=StockHistoryResponse)
def stock_history(
    symbol: str,
    range_name: str = Query(default="1mo", alias="range"),
    market_data_service: MarketDataService = Depends(get_market_data_service),
) -> StockHistoryResponse:
    history = market_data_service.get_history(symbol, range_name)
    return StockHistoryResponse(symbol=symbol.upper(), range=range_name, points=history)
