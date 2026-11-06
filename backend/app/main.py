"""FastAPI app. From this directory: uvicorn app.main:app --host 0.0.0.0 --port 8000."""

from __future__ import annotations

import logging
import os
import re
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.http import post_json
from app.search import run_search
from app.settings import load_settings

_HITS: list[float] = []


class SearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    brand: str = Field(min_length=1, max_length=80)
    aliases: list[str] = Field(default_factory=list, max_length=8)
    platforms: list[str] = Field(default_factory=lambda: ["instagram", "tiktok"])
    visualText: str | None = Field(default=None, max_length=300)
    visualImageUrl: str | None = Field(default=None, max_length=500)

    @field_validator("brand")
    @classmethod
    def clean_brand(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("brand is empty")
        return cleaned

    @field_validator("aliases")
    @classmethod
    def clean_aliases(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            item = " ".join(str(value).split())
            if not item or len(item) > 64:
                raise ValueError("each alias must be 1 to 64 characters")
            cleaned.append(item)
        return cleaned

    @field_validator("platforms")
    @classmethod
    def clean_platforms(cls, values: list[str]) -> list[str]:
        allowed = {"instagram", "tiktok", "youtube"}
        if not values:
            raise ValueError("pick at least one platform")
        unknown = [item for item in values if item not in allowed]
        if unknown:
            raise ValueError("platforms must be instagram, tiktok, or youtube")
        return list(dict.fromkeys(values))

    @field_validator("visualText")
    @classmethod
    def clean_visual_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        return cleaned or None

    @field_validator("visualImageUrl")
    @classmethod
    def https_image(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        url = value.strip()
        if not url.startswith("https://") or " " in url or "@" in url.split("/")[2]:
            raise ValueError("visualImageUrl must be an https URL without userinfo")
        return url


class _RedactSecrets(logging.Filter):
    """Drop bearer tokens and configured provider keys from any log line."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        redacted = re.sub(r"Bearer\s+\S+", "Bearer [redacted]", message)
        for name in ("ORIANE_API_KEY", "GMI_API_KEY"):
            secret = os.environ.get(name)
            if secret:
                redacted = redacted.replace(secret, "[redacted]")
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True


def create_app() -> FastAPI:
    logging.getLogger().addFilter(_RedactSecrets())
    settings = load_settings()
    app = FastAPI(title="hack-the-feed", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Accept"],
    )

    @app.get("/health")
    def health() -> dict:
        current = load_settings()
        return {
            "status": "ok",
            "orianeConfigured": current.oriane_configured,
            "gmiConfigured": current.gmi_configured,
        }

    @app.post("/api/search")
    def search(body: SearchRequest) -> dict:
        _rate_limit()
        return run_search(body.model_dump(), load_settings(), post_json)

    return app


def _rate_limit() -> None:
    limit = load_settings().rate_limit_per_minute
    if limit <= 0:
        return
    now = time.monotonic()
    fresh = [stamp for stamp in _HITS if now - stamp < 60]
    if len(fresh) >= limit:
        raise HTTPException(status_code=429, detail="Too many searches from this process. Wait a minute.")
    fresh.append(now)
    _HITS[:] = fresh


def reset_rate_limit() -> None:
    _HITS.clear()


app = create_app()
