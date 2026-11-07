"""Oriane content search and text/image reference assets.

Query shapes match the 6 Nov 2026 live calls: one page, projection full,
limit 10, Authorization Bearer. 200 and 206 are both successful pages.
"""

from __future__ import annotations

from app.http import ProviderCallError

PAGE_LIMIT = 10
MIN_VISUAL_SCORE = 0.9
SEARCH_PATH = "/rest/contents/search"
ASSET_PATH = "/rest/assets"

CHANNEL_ORDER = ("written", "transcript", "ocr", "visual")


def search_terms(brand: str, aliases: list[str]) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    for raw in (brand, *aliases):
        term = raw.strip().lstrip("#@").casefold()
        term = " ".join(term.split())
        if not term or term in seen:
            continue
        seen.add(term)
        terms.append(term)
        if len(terms) == 8:
            break
    return terms


def _includes_exactly(terms: list[str]) -> dict:
    return {"includesExactly": {"values": terms, "operator": "or"}}


def _platform_filter(platforms: list[str]) -> dict:
    return {"includes": list(platforms)}


def written_body(terms: list[str], platforms: list[str]) -> dict:
    """Caption, hashtags, and @mentions as OR children under the platform filter."""
    return {
        "operator": "and",
        "name": "written",
        "filters": {"platform": _platform_filter(platforms)},
        "queries": [
            {
                "operator": "or",
                "queries": [
                    {"operator": "and", "filters": {"caption": _includes_exactly(terms)}},
                    {"operator": "and", "filters": {"hashtags": _includes_exactly(terms)}},
                    {"operator": "and", "filters": {"mentionHandles": _includes_exactly(terms)}},
                ],
            }
        ],
    }


def text_channel_body(field: str, terms: list[str], platforms: list[str], name: str) -> dict:
    return {
        "operator": "and",
        "name": name,
        "filters": {
            "platform": _platform_filter(platforms),
            field: _includes_exactly(terms),
        },
    }


def visual_body(asset_id: str, platforms: list[str]) -> dict:
    return {
        "operator": "and",
        "name": "visual",
        "filters": {
            "platform": _platform_filter(platforms),
            "visualSimilarity": {
                "includes": {
                    "values": [{"assetId": asset_id, "minScore": MIN_VISUAL_SCORE}],
                    "operator": "or",
                }
            },
        },
    }


def text_asset_body(text: str) -> dict:
    return {"type": "text", "text": text[:300]}


def image_asset_body(url: str) -> dict:
    return {"type": "image", "image": {"type": "url", "url": url}}


def default_visual_text(brand: str) -> str:
    text = f"Lettering or a logo that reads {brand.strip()}. A color match alone is not this brand."
    return text[:300]


def search_url(base: str, sort: str, offset: int = 0) -> str:
    # sort is one of the two fixed values this service sends. Keep the colon literal,
    # matching the live query string rather than percent-encoding it.
    return f"{base}{SEARCH_PATH}?limit={PAGE_LIMIT}&offset={offset}&projection=full&sort={sort}"


def bearer_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _total_count(payload: object) -> int | None:
    if not isinstance(payload, dict):
        return None
    metadata = payload.get("metadata")
    if not isinstance(metadata, dict):
        return None
    pagination = metadata.get("pagination")
    if not isinstance(pagination, dict):
        return None
    total = pagination.get("totalCount")
    if isinstance(total, bool) or not isinstance(total, (int, float)):
        return None
    return int(total)


def _results(payload: object) -> list[dict] | None:
    if not isinstance(payload, dict):
        return None
    data = payload.get("data")
    if not isinstance(data, dict) or "results" not in data:
        return None
    results = data.get("results")
    if not isinstance(results, list):
        return None
    return [row for row in results if isinstance(row, dict)]


def parse_search(status: int, payload: object) -> dict:
    if status not in (200, 206):
        return {
            "status": "failed",
            "httpStatus": status,
            "indexCandidateCount": None,
            "rows": [],
            "warning": f"Oriane returned HTTP {status}. This channel has no rows.",
        }
    rows = _results(payload)
    if rows is None:
        return {
            "status": "failed",
            "httpStatus": status,
            "indexCandidateCount": _total_count(payload),
            "rows": [],
            "warning": "Oriane returned no data.results array. This channel was not treated as an empty catalog.",
        }
    return {
        "status": "ok",
        "httpStatus": status,
        "indexCandidateCount": _total_count(payload),
        "rows": rows[:PAGE_LIMIT],
        "warning": None,
    }


def parse_asset_id(status: int, payload: object) -> str | None:
    if status not in (200, 201) or not isinstance(payload, dict):
        return None
    data = payload.get("data")
    if not isinstance(data, dict):
        return None
    asset_id = data.get("id")
    if isinstance(asset_id, str) and asset_id:
        return asset_id
    return None


def call_search(post_json, base: str, api_key: str, body: dict, sort: str, timeout: float, offset: int = 0) -> dict:
    try:
        status, payload = post_json(search_url(base, sort, offset), body, bearer_headers(api_key), timeout)
    except ProviderCallError as exc:
        return {
            "status": "failed",
            "httpStatus": None,
            "indexCandidateCount": None,
            "rows": [],
            "warning": f"Oriane {exc}. This channel has no rows.",
        }
    return parse_search(status, payload)
