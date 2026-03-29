from fastapi import APIRouter, Depends, Query

from app.api.deps import get_stock_search_service
from app.schemas.search import SearchResult
from app.services.search import StockSearchService


router = APIRouter(tags=["search"])


@router.get("/search", response_model=list[SearchResult])
def search_stocks(
    q: str = Query(min_length=1),
    limit: int = Query(default=10, ge=1, le=20),
    stock_search_service: StockSearchService = Depends(get_stock_search_service),
) -> list[SearchResult]:
    return stock_search_service.search(q, limit)


@router.get("/search/universe", response_model=list[SearchResult])
def search_universe(
    stock_search_service: StockSearchService = Depends(get_stock_search_service),
) -> list[SearchResult]:
    return stock_search_service.universe()
