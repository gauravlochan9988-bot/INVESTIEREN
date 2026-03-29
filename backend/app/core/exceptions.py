class AppError(Exception):
    """Base application error."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    """Raised when the requested resource does not exist."""


class ValidationError(AppError):
    """Raised when request data is invalid."""


class ExternalServiceError(AppError):
    """Raised when an upstream service is unavailable."""
