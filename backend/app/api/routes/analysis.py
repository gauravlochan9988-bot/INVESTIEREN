from fastapi import APIRouter, Depends

from app.api.deps import get_analysis_service
from app.schemas.analysis import AnalysisResponse, AnalyzeRequest
from app.services.analysis import AnalysisService

router = APIRouter(tags=["analysis"])


@router.get("/analysis/{symbol}", response_model=AnalysisResponse)
def get_analysis(
    symbol: str,
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisResponse:
    return analysis_service.analyze_symbol(symbol)


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_symbol(
    payload: AnalyzeRequest,
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisResponse:
    return analysis_service.analyze_symbol(payload.symbol)
