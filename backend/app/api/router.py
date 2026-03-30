from fastapi import APIRouter

from app.api.routes.analysis import router as analysis_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.search import router as search_router
from app.api.routes.stocks import router as stocks_router


api_router = APIRouter(prefix="/api")
api_router.include_router(dashboard_router)
api_router.include_router(stocks_router)
api_router.include_router(search_router)
api_router.include_router(analysis_router)
api_router.include_router(portfolio_router)
