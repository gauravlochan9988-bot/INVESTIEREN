from fastapi import APIRouter

from app.api.routes.analysis import router as analysis_router
from app.api.routes.internal_cron import router as internal_cron_router
from app.api.routes.auth import router as auth_router
from app.api.routes.billing import router as billing_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.search import router as search_router
from app.api.routes.settings import router as settings_router
from app.api.routes.stocks import router as stocks_router
from app.api.routes.user_alerts import router as user_alerts_router


api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(billing_router)
api_router.include_router(dashboard_router)
api_router.include_router(stocks_router)
api_router.include_router(search_router)
api_router.include_router(settings_router)
api_router.include_router(internal_cron_router)
api_router.include_router(analysis_router)
api_router.include_router(user_alerts_router)
api_router.include_router(portfolio_router)
