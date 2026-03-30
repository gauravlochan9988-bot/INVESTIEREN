"""Compatibility package that points top-level `app` imports to `backend/app`."""

from pathlib import Path

_BACKEND_APP_DIR = Path(__file__).resolve().parent.parent / "backend" / "app"
__path__ = [str(_BACKEND_APP_DIR)]
