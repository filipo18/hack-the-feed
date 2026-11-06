"""Re-fetch the public Scalar docs page and replace schema/openapi.snapshot.json.

Usage: python3 scripts/refresh_openapi_snapshot.py

This hits only https://connect.oriane.xyz/rest/docs. It does not send an API key.
"""

from __future__ import annotations

import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS_URL = "https://connect.oriane.xyz/rest/docs"
SNAPSHOT = ROOT / "schema" / "openapi.snapshot.json"
PROVENANCE = ROOT / "schema" / "PROVENANCE.json"


def extract_config(html: str) -> dict:
    marker = "createApiReference('#app',"
    start = html.index(marker)
    brace = html.index("{", start)
    depth = 0
    in_string = False
    escaped = False
    end = -1
    for index, character in enumerate(html[brace:], start=brace):
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == '"':
            in_string = True
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                end = index
                break
    if end < 0:
        raise RuntimeError("Could not find the end of the Scalar config object.")
    return json.loads(html[brace : end + 1])


def main() -> None:
    request = urllib.request.Request(DOCS_URL, headers={"User-Agent": "oriane-capability-probe/0.1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8")
    spec = extract_config(html)["content"]
    encoded = json.dumps(spec, indent=2).encode() + b"\n"
    SNAPSHOT.write_bytes(encoded)
    provenance = {
        "source_url": DOCS_URL,
        "linked_from": "https://www.oriane.xyz/api",
        "link_mechanism": "public Webflow page iframe src, not an authenticated app session",
        "fetched_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "extraction": "Scalar createApiReference content object embedded in the public docs HTML",
        "openapi": spec.get("openapi"),
        "info_version": (spec.get("info") or {}).get("version"),
        "sha256": hashlib.sha256(encoded).hexdigest(),
        "live_authenticated_calls": False,
    }
    PROVENANCE.write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"Wrote {SNAPSHOT} sha256={provenance['sha256']}")


if __name__ == "__main__":
    main()
