from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Generic, Optional, TypeVar


T = TypeVar("T")


@dataclass
class CacheEntry(Generic[T]):
    value: T
    expires_at: datetime


class TTLCache(Generic[T]):
    def __init__(self, ttl_seconds: int):
        self.ttl_seconds = ttl_seconds
        self._store: Dict[str, CacheEntry[T]] = {}

    def get(self, key: str) -> Optional[T]:
        entry = self._store.get(key)
        now = datetime.now(timezone.utc)
        if entry is None:
            return None
        if entry.expires_at <= now:
            self._store.pop(key, None)
            return None
        return entry.value

    def set(self, key: str, value: T) -> T:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=self.ttl_seconds)
        self._store[key] = CacheEntry(value=value, expires_at=expires_at)
        return value

    def get_stale(self, key: str) -> Optional[T]:
        entry = self._store.get(key)
        if entry is None:
            return None
        return entry.value

    def clear(self) -> None:
        self._store.clear()
