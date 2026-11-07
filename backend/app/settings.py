"""Environment settings. Keys are read here and nowhere else is a default model id."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    oriane_api_key: str | None
    oriane_base_url: str
    gmi_api_key: str | None
    gmi_model: str | None
    gmi_base_url: str
    cors_origins: list[str]
    timeout_seconds: float
    gmi_timeout_seconds: float
    response_ttl_seconds: float
    asset_ttl_seconds: float
    rate_limit_per_minute: int

    @property
    def oriane_configured(self) -> bool:
        return bool(self.oriane_api_key)

    @property
    def gmi_configured(self) -> bool:
        return bool(self.gmi_api_key and self.gmi_model)


def _float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def _gmi_api_key() -> str | None:
    """Agentbox injects GMI_MAAS_API_KEY. GMI_API_KEY remains the manual fallback.

    When both are set, the injected key is the one for this process. Neither
    value is logged.
    """
    injected = os.environ.get("GMI_MAAS_API_KEY", "").strip()
    manual = os.environ.get("GMI_API_KEY", "").strip()
    return injected or manual or None


def load_settings() -> Settings:
    origins = [
        item.strip()
        for item in os.environ.get(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if item.strip()
    ]
    model = os.environ.get("GMI_MODEL", "").strip() or None
    return Settings(
        oriane_api_key=os.environ.get("ORIANE_API_KEY", "").strip() or None,
        oriane_base_url=os.environ.get("ORIANE_BASE_URL", "https://connect.oriane.xyz").rstrip("/"),
        gmi_api_key=_gmi_api_key(),
        gmi_model=model,
        gmi_base_url=os.environ.get("GMI_BASE_URL", "https://api.gmi-serving.com/v1").rstrip("/"),
        cors_origins=origins,
        timeout_seconds=_float("HTTP_TIMEOUT_SECONDS", 20.0),
        gmi_timeout_seconds=_float("GMI_HTTP_TIMEOUT_SECONDS", _float("HTTP_TIMEOUT_SECONDS", 20.0)),
        response_ttl_seconds=_float("SEARCH_CACHE_TTL_SECONDS", 600.0),
        asset_ttl_seconds=_float("ASSET_CACHE_TTL_SECONDS", 3600.0),
        rate_limit_per_minute=_int("RATE_LIMIT_PER_MINUTE", 30),
    )
