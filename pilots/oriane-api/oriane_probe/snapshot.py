"""Load the pinned OpenAPI document extracted from the public docs page."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_PATH = ROOT / "schema" / "openapi.snapshot.json"
PROVENANCE_PATH = ROOT / "schema" / "PROVENANCE.json"


def load_snapshot() -> dict:
    return json.loads(SNAPSHOT_PATH.read_text())


def load_provenance() -> dict:
    return json.loads(PROVENANCE_PATH.read_text())


def snapshot_sha256() -> str:
    return hashlib.sha256(SNAPSHOT_PATH.read_bytes()).hexdigest()


def schema(spec: dict, name: str) -> dict:
    try:
        return spec["components"]["schemas"][name]
    except KeyError as exc:
        raise KeyError(f"schema {name} is not in the pinned OpenAPI snapshot") from exc
