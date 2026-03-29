from pathlib import Path
from typing import Optional, Union

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.core.config import get_settings
from app.core.exceptions import AppError, ExternalServiceError, NotFoundError, ValidationError


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


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

    app.include_router(api_router)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/")
    def root() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/index.html")
    def root_index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/api/health")
    def healthcheck() -> dict:
        return {"status": "ok", "environment": settings.app_env}

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
