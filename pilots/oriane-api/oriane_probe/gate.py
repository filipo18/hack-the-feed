"""Read the recorded keyless probes. This module does not send traffic."""

from __future__ import annotations

import json
from pathlib import Path

from oriane_probe.snapshot import ROOT

CONTENTS_GATE = ROOT / "evidence" / "unauthenticated-gate.json"
ROUTES_GATE = ROOT / "evidence" / "unauthenticated-routes.json"


def load_contents_gate() -> dict:
    return json.loads(CONTENTS_GATE.read_text())


def load_routes_gate() -> dict:
    return json.loads(ROUTES_GATE.read_text())


def interpret_contents_gate(record: dict | None = None) -> dict:
    record = record or load_contents_gate()
    error = record["response"]["body"]["error"]
    context = error.get("context") or {}
    www = record["response"].get("www_authenticate")
    disclosed = bool(www) or any(
        isinstance(value, str) and "header" in value.casefold() for value in _strings(context)
    )
    return {
        "live_content_proof": False,
        "http_status": record["response"]["http_status"],
        "operation": error.get("operation"),
        "code": error.get("code"),
        "message": error.get("message"),
        "context_empty": context == {},
        "www_authenticate": www,
        "auth_header_name_disclosed": disclosed,
        "creator_results_present": "data" in record["response"]["body"],
        "query_shape_server_validated": False,
    }


def _strings(node: object) -> list[str]:
    found: list[str] = []
    if isinstance(node, str):
        found.append(node)
    elif isinstance(node, dict):
        for value in node.values():
            found.extend(_strings(value))
    elif isinstance(node, list):
        for value in node:
            found.extend(_strings(value))
    return found
