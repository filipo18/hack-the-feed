"""FastAPI app. From this directory: uvicorn app.main:app --host 0.0.0.0 --port 8000."""

from __future__ import annotations

import logging
import os
import re
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.creator_report import MAX_POSTS, run_creator_report
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


class CreatorReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    handle: str = Field(min_length=1, max_length=80)
    platform: str
    maxPosts: int = Field(default=5, ge=1, le=MAX_POSTS)
    cpm: float | None = Field(default=None, ge=0, le=1000)

    @field_validator("handle")
    @classmethod
    def clean_handle(cls, value: str) -> str:
        cleaned = value.strip()
        if cleaned.startswith("@"):
            cleaned = cleaned[1:]
        if not cleaned or any(character.isspace() for character in cleaned):
            raise ValueError("handle must be one username")
        return cleaned

    @field_validator("platform")
    @classmethod
    def clean_platform(cls, value: str) -> str:
        platform = value.strip().casefold()
        if platform not in {"instagram", "tiktok", "youtube"}:
            raise ValueError("platform must be instagram, tiktok, or youtube")
        return platform


class _RedactSecrets(logging.Filter):
    """Drop bearer tokens and configured provider keys from any log line."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        redacted = re.sub(r"Bearer\s+\S+", "Bearer [redacted]", message)
        for name in ("ORIANE_API_KEY", "GMI_API_KEY", "GMI_MAAS_API_KEY", "GMI_COMPUTE_API_KEY"):
            secret = os.environ.get(name)
            if secret:
                redacted = redacted.replace(secret, "[redacted]")
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True


_REDACTION_INSTALLED = False


def _install_redaction() -> None:
    """Redact secrets on every logger. A filter on the root logger does not see propagated records."""
    global _REDACTION_INSTALLED
    if _REDACTION_INSTALLED:
        return
    _REDACTION_INSTALLED = True
    original = logging.Logger.handle
    redact = _RedactSecrets()

    def handle(self, record):
        redact.filter(record)
        return original(self, record)

    logging.Logger.handle = handle


def create_app() -> FastAPI:
    _install_redaction()
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

    @app.post("/api/creator-report")
    def creator_report(body: CreatorReportRequest) -> dict:
        _rate_limit()
        return run_creator_report(body.model_dump(), load_settings(), post_json)

    @app.get("/{full_path:path}")
    def frontend(full_path: str):
        """Serve the production UI from STATIC_DIR when that directory exists.

        API routes stay on this process, so a browser page and /api/search share
        one origin. Unknown paths return index.html so a reload of /brands/Ryanair
        or /creators/handle still opens the app. POST /api/creator-report is registered above.
        """
        root = _static_root()
        if root is None:
            raise HTTPException(status_code=404, detail="Not found")
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        asset = _safe_static(root, full_path)
        if asset is not None:
            return FileResponse(asset)
        index = root / "index.html"
        if full_path and index.is_file():
            return FileResponse(index)
        if not full_path and index.is_file():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Not found")

    return app


def _static_root() -> Path | None:
    raw = os.environ.get("STATIC_DIR", "").strip()
    if not raw:
        return None
    root = Path(raw).resolve()
    if not root.is_dir():
        return None
    return root


def _safe_static(root: Path, full_path: str) -> Path | None:
    if not full_path or full_path.endswith("/"):
        return None
    candidate = (root / full_path).resolve()
    if candidate != root and root not in candidate.parents:
        return None
    if candidate.is_file():
        return candidate
    return None


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
