from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    get_analysis_calibration_service,
    get_analysis_log_repository,
    get_analysis_service,
    get_strategy_learning_service,
)
from app.core.database import get_db
from app.schemas.analysis import AnalysisAlert, AnalysisResponse, AnalyzeRequest, Strategy
from app.schemas.analysis_tracking import AnalysisDistributionStats, StrategyLearningStatsResponse
from app.repositories.analysis_log import AnalysisLogRepository
from app.services.analysis_calibration import AnalysisCalibrationService
from app.services.analysis import AnalysisService
from app.services.strategy_learning import StrategyLearningService

router = APIRouter(tags=["analysis"])


@router.get("/analysis/stats", response_model=AnalysisDistributionStats)
def get_analysis_stats(
    db: Session = Depends(get_db),
    calibration_service: AnalysisCalibrationService = Depends(get_analysis_calibration_service),
) -> AnalysisDistributionStats:
    return calibration_service.get_distribution_stats(db)


@router.get("/analysis/performance", response_model=StrategyLearningStatsResponse)
def get_analysis_performance(
    db: Session = Depends(get_db),
    strategy_learning_service: StrategyLearningService = Depends(get_strategy_learning_service),
) -> StrategyLearningStatsResponse:
    return strategy_learning_service.get_stats(db)


@router.get("/analysis/{symbol}", response_model=AnalysisResponse)
def get_analysis(
    symbol: str,
    refresh: bool = Query(default=False),
    strategy: Strategy = Query(default="hedgefund"),
    db: Session = Depends(get_db),
    analysis_service: AnalysisService = Depends(get_analysis_service),
    analysis_log_repository: AnalysisLogRepository = Depends(get_analysis_log_repository),
    calibration_service: AnalysisCalibrationService = Depends(get_analysis_calibration_service),
) -> AnalysisResponse:
    result = analysis_service.analyze_symbol(
        symbol,
        force_refresh=refresh,
        strategy=strategy,
        db=db,
    )
    analysis_log_repository.create(
        db,
        symbol=result.symbol,
        strategy=result.strategy,
        score=result.score,
        recommendation=result.recommendation,
        data_quality=result.data_quality,
        confidence=float(result.confidence or 0.0),
    )
    calibration_service.recalibrate_strategy(db, result.strategy)
    return result


@router.get("/alerts", response_model=list[AnalysisAlert])
def get_alerts(
    refresh: bool = Query(default=False),
    strategy: Strategy = Query(default="hedgefund"),
    limit: int = Query(default=6, ge=1, le=12),
    db: Session = Depends(get_db),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> list[AnalysisAlert]:
    return analysis_service.scan_alerts(
        strategy=strategy,
        force_refresh=refresh,
        limit=limit,
        db=db,
    )


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_symbol(
    payload: AnalyzeRequest,
    refresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    analysis_service: AnalysisService = Depends(get_analysis_service),
    analysis_log_repository: AnalysisLogRepository = Depends(get_analysis_log_repository),
    calibration_service: AnalysisCalibrationService = Depends(get_analysis_calibration_service),
) -> AnalysisResponse:
    result = analysis_service.analyze_symbol(
        payload.symbol,
        force_refresh=refresh,
        strategy=payload.strategy,
        db=db,
    )
    analysis_log_repository.create(
        db,
        symbol=result.symbol,
        strategy=result.strategy,
        score=result.score,
        recommendation=result.recommendation,
        data_quality=result.data_quality,
        confidence=float(result.confidence or 0.0),
    )
    calibration_service.recalibrate_strategy(db, result.strategy)
    return result
