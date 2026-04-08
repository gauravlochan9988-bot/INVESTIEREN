import os
from pathlib import Path
from threading import Thread
from time import sleep
from typing import Optional, Union
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api.router import api_router
from .core.config import get_settings
from .core.database import (
    get_database_status,
    get_database_url,
    get_engine,
    mark_database_status,
    set_runtime_database_url,
)
from .core.exceptions import AppError, ExternalServiceError, NotFoundError, ValidationError
from .models import Base


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent.parent


def _error_response(
    status_code: int,
    message: str,
    *,
    detail: Optional[Union[list[dict], str]] = None,
) -> JSONResponse:
    payload: dict = {"error": message}
    if detail is not None:
        payload["detail"] = detail
    return JSONResponse(status_code=status_code, content=payload)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        description="Educational investing MVP with live stock data, rule-based signals, and a demo portfolio.",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.on_event("startup")
    def ensure_database_tables() -> None:
        database_url = get_database_url()
        parsed = urlparse(database_url)
        print(
            "database_target",
            {
                "scheme": parsed.scheme,
                "username": parsed.username,
                "hostname": parsed.hostname,
                "port": parsed.port,
            },
        )
        try:
            Base.metadata.create_all(bind=get_engine())
            mark_database_status(database_url, healthy=True)
        except Exception as exc:
            fallback_url = "sqlite+pysqlite:////tmp/investieren.db"
            print(
                "database_fallback",
                {
                    "reason": type(exc).__name__,
                    "message": str(exc),
                    "fallback": fallback_url,
                },
            )
            set_runtime_database_url(fallback_url)
            Base.metadata.create_all(bind=get_engine())
            mark_database_status(
                fallback_url,
                healthy=True,
                mode="fallback",
                reason=f"{type(exc).__name__}: {exc}",
            )

    @app.on_event("startup")
    def start_background_preload() -> None:
        if settings.app_env.lower() == "test" or os.getenv("PYTEST_CURRENT_TEST"):
            return
        if getattr(app.state, "preload_thread", None):
            return

        def warm_top_symbols() -> None:
            from .api.deps import (
                DASHBOARD_WATCHLIST,
                get_analysis_service_instance,
                get_finnhub_dashboard_service_instance,
            )

            dashboard_service = get_finnhub_dashboard_service_instance()
            analysis_service = get_analysis_service_instance()
            strategies = ("simple", "ai", "hedgefund")
            alert_universe = tuple(analysis_service.market_data_service.allowed_symbols.keys())

            while True:
                try:
                    dashboard_service.get_watchlist(force_refresh=False)
                    for symbol in DASHBOARD_WATCHLIST:
                        dashboard_service.get_symbol_overview(symbol, force_refresh=False)
                        analysis_service.prime_symbol(symbol, force_refresh=False)
                        for strategy in strategies:
                            analysis_service.analyze_symbol(
                                symbol,
                                force_refresh=False,
                                strategy=strategy,
                            )
                    for strategy in strategies:
                        analysis_service.prime_alerts(
                            strategy=strategy,
                            symbols=alert_universe,
                            limit=6,
                            force_refresh=False,
                        )
                except Exception as exc:  # pragma: no cover - background warmup safety
                    print("preload_warmup_failed", {"type": type(exc).__name__, "message": str(exc)})
                sleep(max(30, settings.preload_refresh_seconds))

        thread = Thread(
            target=warm_top_symbols,
            name="investieren-preload",
            daemon=True,
        )
        app.state.preload_thread = thread
        thread.start()

    @app.get("/")
    def root():
        if settings.app_env.lower() == "production":
            return JSONResponse(
                {
                    "status": "ok",
                    "service": "backend",
                    "message": "Render hosts the FastAPI API. Open the frontend on Vercel.",
                    "frontend_url": "https://investieren.vercel.app",
                    "health_url": "/api/health",
                }
            )
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/index.html")
    def root_index():
        if settings.app_env.lower() == "production":
            return JSONResponse(
                {
                    "status": "ok",
                    "service": "backend",
                    "message": "Frontend is served from Vercel in production.",
                    "frontend_url": "https://investieren.vercel.app",
                }
            )
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/styles.css")
    def root_styles() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "styles.css", media_type="text/css")

    @app.get("/app.js")
    def root_script() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "app.js", media_type="application/javascript")

    @app.get("/pricing.html")
    def pricing_page() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "pricing.html", media_type="text/html")

    @app.get("/pricing.js")
    def pricing_script() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "pricing.js", media_type="application/javascript")

    @app.get("/auth-hero-hq.png")
    def root_auth_hero_hq() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "auth-hero-hq.png", media_type="image/png")

    @app.get("/auth-hero-source.png")
    def root_auth_hero_source() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "auth-hero-source.png", media_type="image/png")

    @app.get("/auth-hero.png")
    def root_auth_hero() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "auth-hero.png", media_type="image/png")

    @app.get("/api/health")
    def healthcheck() -> dict:
        return {
            "status": "ok",
            "environment": settings.app_env,
            "database": get_database_status(),
        }

    @app.get("/health")
    def root_healthcheck() -> dict:
        return healthcheck()

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_: Request, exc: NotFoundError) -> JSONResponse:
        return _error_response(404, exc.message, detail=exc.message)

    @app.exception_handler(ValidationError)
    async def validation_handler(_: Request, exc: ValidationError) -> JSONResponse:
        return _error_response(400, exc.message)

    @app.exception_handler(ExternalServiceError)
    async def external_handler(_: Request, exc: ExternalServiceError) -> JSONResponse:
        return _error_response(503, exc.message)

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()
        first_error = errors[0] if errors else {}
        message = first_error.get("msg", "Invalid request payload.")
        return _error_response(422, message, detail=errors)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return _error_response(exc.status_code, detail, detail=detail)

    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(
        _: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return _error_response(exc.status_code, detail, detail=detail)

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return _error_response(500, exc.message)

    return app


app = create_app()
