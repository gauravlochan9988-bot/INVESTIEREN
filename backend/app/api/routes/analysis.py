from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    get_alert_service,
    get_analysis_calibration_service,
    get_analysis_log_repository,
    get_analysis_service,
    get_request_user_context,
    get_strategy_learning_service,
    get_trade_history_service,
    RequestUserContext,
)
from app.core.database import get_db
from app.schemas.analysis import (
    AnalysisAlert,
    AnalysisResponse,
    AnalyzeRequest,
    FavoriteSymbolCreate,
    FavoriteSymbolResponse,
    Strategy,
)
from app.schemas.analysis_tracking import AnalysisDistributionStats, StrategyLearningStatsResponse
from app.repositories.analysis_log import AnalysisLogRepository
from app.services.alerts import AlertService
from app.services.analysis_calibration import AnalysisCalibrationService
from app.services.analysis import AnalysisService
from app.services.strategy_learning import StrategyLearningService
from app.services.trade_history import TradeHistoryService

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
    trade_history_service: TradeHistoryService = Depends(get_trade_history_service),
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
    trade_history_service.sync_from_analysis(db, result)
    calibration_service.recalibrate_strategy(db, result.strategy)
    return result


@router.get("/alerts", response_model=list[AnalysisAlert])
def get_alerts(
    refresh: bool = Query(default=False),
    strategy: Strategy = Query(default="hedgefund"),
    limit: int = Query(default=6, ge=1, le=12),
    user_key: str = Query(default="default", min_length=1, max_length=64),
    favorites_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    alert_service: AlertService = Depends(get_alert_service),
    user_context: RequestUserContext = Depends(get_request_user_context),
) -> list[AnalysisAlert]:
    resolved_user_key = user_context.user_key if user_context.is_authenticated else user_key
    return alert_service.sync_alerts(
        db,
        strategy=strategy,
        force_refresh=refresh,
        limit=limit,
        user_key=resolved_user_key,
        favorites_only=favorites_only,
    )


@router.get("/favorites", response_model=list[FavoriteSymbolResponse])
def get_favorites(
    user_key: str = Query(default="default", min_length=1, max_length=64),
    db: Session = Depends(get_db),
    alert_service: AlertService = Depends(get_alert_service),
    user_context: RequestUserContext = Depends(get_request_user_context),
) -> list[FavoriteSymbolResponse]:
    resolved_user_key = user_context.user_key if user_context.is_authenticated else user_key
    return [
        FavoriteSymbolResponse(symbol=symbol, user_key=resolved_user_key)
        for symbol in alert_service.list_favorites(db, user_key=resolved_user_key)
    ]


@router.post("/favorites", response_model=FavoriteSymbolResponse)
def add_favorite(
    payload: FavoriteSymbolCreate,
    db: Session = Depends(get_db),
    alert_service: AlertService = Depends(get_alert_service),
    user_context: RequestUserContext = Depends(get_request_user_context),
) -> FavoriteSymbolResponse:
    resolved_user_key = user_context.user_key if user_context.is_authenticated else payload.user_key
    symbol = alert_service.add_favorite(db, user_key=resolved_user_key, symbol=payload.symbol)
    return FavoriteSymbolResponse(symbol=symbol, user_key=resolved_user_key)


@router.delete("/favorites/{symbol}", response_model=FavoriteSymbolResponse)
def delete_favorite(
    symbol: str,
    user_key: str = Query(default="default", min_length=1, max_length=64),
    db: Session = Depends(get_db),
    alert_service: AlertService = Depends(get_alert_service),
    user_context: RequestUserContext = Depends(get_request_user_context),
) -> FavoriteSymbolResponse:
    resolved_user_key = user_context.user_key if user_context.is_authenticated else user_key
    alert_service.remove_favorite(db, user_key=resolved_user_key, symbol=symbol)
    return FavoriteSymbolResponse(symbol=symbol.strip().upper(), user_key=resolved_user_key)


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_symbol(
    payload: AnalyzeRequest,
    refresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    analysis_service: AnalysisService = Depends(get_analysis_service),
    analysis_log_repository: AnalysisLogRepository = Depends(get_analysis_log_repository),
    calibration_service: AnalysisCalibrationService = Depends(get_analysis_calibration_service),
    trade_history_service: TradeHistoryService = Depends(get_trade_history_service),
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
    trade_history_service.sync_from_analysis(db, result)
    calibration_service.recalibrate_strategy(db, result.strategy)
    return result
