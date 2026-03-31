from fastapi import APIRouter, Depends, Query

from app.api.deps import get_analysis_service
from app.schemas.analysis import AnalysisAlert, AnalysisResponse, AnalyzeRequest, Strategy
from app.services.analysis import AnalysisService

router = APIRouter(tags=["analysis"])


@router.get("/analysis/{symbol}", response_model=AnalysisResponse)
def get_analysis(
    symbol: str,
    refresh: bool = Query(default=False),
    strategy: Strategy = Query(default="hedgefund"),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisResponse:
    return analysis_service.analyze_symbol(symbol, force_refresh=refresh, strategy=strategy)


@router.get("/alerts", response_model=list[AnalysisAlert])
def get_alerts(
    refresh: bool = Query(default=False),
    strategy: Strategy = Query(default="hedgefund"),
    limit: int = Query(default=6, ge=1, le=12),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> list[AnalysisAlert]:
    return analysis_service.scan_alerts(
        strategy=strategy,
        force_refresh=refresh,
        limit=limit,
    )


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_symbol(
    payload: AnalyzeRequest,
    refresh: bool = Query(default=False),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisResponse:
    return analysis_service.analyze_symbol(
        payload.symbol,
        force_refresh=refresh,
        strategy=payload.strategy,
    )
