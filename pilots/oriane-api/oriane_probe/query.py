"""Build Oriane REST requests from the pinned schema.

Nothing in this module opens a socket. `execute` refuses every send so a
key dropped into the environment cannot spend credits from this pilot.
"""

from __future__ import annotations

import re
from urllib.parse import urlencode

from oriane_probe.snapshot import load_snapshot, schema

PLATFORMS = ("instagram", "tiktok", "youtube")
PROJECTIONS = ("basic", "default", "full")
CONTENT_PATH = "/rest/contents/search"
PROFILE_PATH = "/rest/profiles/search"
ASSET_PATH = "/rest/assets"


class QueryError(ValueError):
    """The request would contradict the pinned OpenAPI document."""


class LiveCallBlocked(RuntimeError):
    """Authenticated sends are out of scope for this pilot."""


def normalize_handle(handle: str) -> str:
    """Strip a single leading @. The schema examples are bare usernames."""
    cleaned = handle.strip()
    if cleaned.startswith("@"):
        cleaned = cleaned[1:]
    if not cleaned or any(character.isspace() for character in cleaned):
        raise QueryError("Handle must be one exact username, without spaces.")
    if len(cleaned) > 256:
        raise QueryError(
            "exactMatch values longer than 256 characters never match, per the profileHandle.exactMatch description."
        )
    return cleaned


def content_sort_fields(spec: dict | None = None) -> list[str]:
    spec = spec or load_snapshot()
    description = _parameter(spec, CONTENT_PATH, "sort")["description"]
    match = re.search(r"one of (.+?) and takes", description)
    if not match:
        raise QueryError("Content sort description no longer lists fields in the expected sentence.")
    return [part.strip() for part in match.group(1).split(",")]


def creator_content_search(
    handle: str,
    platforms: tuple[str, ...] | list[str] = ("instagram", "tiktok"),
    *,
    projection: str = "full",
    offset: int = 0,
    limit: int = 100,
    sort: str = "publishedAt:desc",
    spec: dict | None = None,
) -> dict:
    """Posts by an exact handle. Default page is the schema maximum, newest first."""
    return _content_search(
        filters={
            "profileHandle": {
                "exactMatch": {"values": [normalize_handle(handle)], "operator": "or"}
            },
            "platform": {"includes": _platforms(platforms), "operator": "and"},
        },
        projection=projection,
        offset=offset,
        limit=limit,
        sort=sort,
        spec=spec,
    )


def beside_caption_page(
    handle: str,
    platforms: tuple[str, ...] | list[str] = ("instagram", "tiktok"),
    *,
    spec: dict | None = None,
) -> dict:
    """Small default-projection page used to find a caption/speech/OCR gap.

    Default media includes caption, transcript, and onScreenText. It does not
    include transcriptChunks or frames; those are full-projection fields.
    """
    return creator_content_search(
        handle,
        platforms,
        projection="default",
        offset=0,
        limit=5,
        sort="viewsCount:desc",
        spec=spec,
    )


def content_by_id(
    content_id: str,
    *,
    projection: str = "full",
    spec: dict | None = None,
) -> dict:
    """Refetch one content id. Full projection is what adds timed chunks and frames."""
    _identifier(content_id, "content id")
    return _content_search(
        filters={"id": {"includes": [content_id], "operator": "and"}},
        projection=projection,
        offset=0,
        limit=1,
        sort="publishedAt:desc",
        spec=spec,
    )


def creator_profile_search(
    handle: str,
    platforms: tuple[str, ...] | list[str] = ("instagram", "tiktok"),
    *,
    projection: str = "basic",
    spec: dict | None = None,
) -> dict:
    spec = spec or load_snapshot()
    _require_filter(spec, "SearchProfilesRequest.Filters.Body", "handle", "exactMatch")
    body = {
        "operator": "and",
        "filters": {
            "handle": {"exactMatch": {"values": [normalize_handle(handle)], "operator": "or"}},
            "platform": {"includes": _platforms(platforms), "operator": "and"},
        },
    }
    return _prepared(
        spec,
        PROFILE_PATH,
        query={"sort": "followersCount:desc", "offset": 0, "limit": 1, "projection": projection},
        body=body,
    )


def untagged_phrase_search(
    creator_handle: str,
    phrase: str,
    platforms: tuple[str, ...] | list[str] = ("instagram", "tiktok"),
    *,
    spec: dict | None = None,
) -> dict:
    """Other people's videos whose transcript contains a phrase and whose mentions exclude the handle.

    This is a documented filter shape. It is not evidence that a live index contains a hit.
    """
    spec = spec or load_snapshot()
    handle = normalize_handle(creator_handle)
    phrase = phrase.strip()
    if not phrase:
        raise QueryError("Phrase is empty.")
    if len(phrase) > 256:
        raise QueryError("includesExactly values longer than 256 characters never match.")
    filters = {
        "transcript": _text_filter(spec, "transcript", "includesExactly", [phrase]),
        "profileHandle": _text_filter(spec, "profileHandle", "excludesExactly", [handle]),
        "mentionHandles": _text_filter(spec, "mentionHandles", "excludesExactly", [handle]),
        "platform": {"includes": _platforms(platforms), "operator": "and"},
    }
    return _content_search(
        filters=filters,
        projection="full",
        offset=0,
        limit=5,
        sort="viewsCount:desc",
        spec=spec,
    )


def text_asset_request(text: str, *, spec: dict | None = None) -> dict:
    spec = spec or load_snapshot()
    limit = schema(spec, "CreateAssetRequest.TextBody")["properties"]["text"]["maxLength"]
    cleaned = text.strip()
    if not cleaned:
        raise QueryError("Asset text is empty.")
    if len(cleaned) > limit:
        raise QueryError(f"Asset text maxLength is {limit}.")
    return _prepared(spec, ASSET_PATH, query={}, body={"type": "text", "text": cleaned})


def visual_search_request(asset_id: str, *, spec: dict | None = None) -> dict:
    """Search by an asset id the assets route would have returned. Score bounds are the schema example, not a calibrated cutoff."""
    spec = spec or load_snapshot()
    _identifier(asset_id, "asset id")
    visual = schema(spec, "SearchContentsRequest.Filters.Body")["properties"]["visualSimilarity"]
    if "includes" not in visual["properties"]:
        raise QueryError("visualSimilarity.includes is not in the snapshot")
    return _content_search(
        filters={
            "visualSimilarity": {
                "includes": {
                    "values": [{"assetId": asset_id, "minScore": 0.3, "maxScore": 0.9}],
                    "operator": "or",
                }
            }
        },
        projection="full",
        offset=0,
        limit=5,
        sort="visualSimilarity:desc",
        spec=spec,
        extra_query_note="Later pages of a visual search must echo metadata.pagination.aiSearchAnchor. Page 0 omits it.",
    )


def execute(prepared: dict, *, api_key: str | None = None, auth_header_name: str | None = None, confirm_spend: bool = False) -> None:
    """Refuse every authenticated send.

    The pinned document has no securitySchemes entry. Guessing a header, or
    sending a key from the environment, is out of scope and can spend credits.
    """
    del prepared, api_key, auth_header_name, confirm_spend
    raise LiveCallBlocked(
        "Refusing to send. The OpenAPI components object has schemas only, so this pilot will not guess an auth header. "
        "A content search can spend credits. The sponsor still has to name the exact header and scheme."
    )


def _content_search(
    *,
    filters: dict,
    projection: str,
    offset: int,
    limit: int,
    sort: str,
    spec: dict | None,
    extra_query_note: str | None = None,
) -> dict:
    spec = spec or load_snapshot()
    _projection(projection)
    _paging(spec, offset, limit)
    _sort(spec, sort)
    body = {"operator": "and", "filters": filters}
    prepared = _prepared(
        spec,
        CONTENT_PATH,
        query={"sort": sort, "offset": offset, "limit": limit, "projection": projection},
        body=body,
    )
    if extra_query_note:
        prepared["note"] = extra_query_note
    prepared["omitted_query_params"] = ["aiSearchAnchor"]
    return prepared


def _prepared(spec: dict, path: str, *, query: dict, body: dict) -> dict:
    if path not in spec["paths"]:
        raise QueryError(f"{path} is not in the pinned snapshot")
    base = spec["servers"][0]["url"].rstrip("/")
    encoded = urlencode(query) if query else ""
    url = f"{base}{path}" + (f"?{encoded}" if encoded else "")
    return {
        "method": "POST",
        "url": url,
        "path": path,
        "query": query,
        "headers": {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        "auth_header": None,
        "body": body,
        "live": False,
    }


def _platforms(platforms: tuple[str, ...] | list[str]) -> list[str]:
    chosen = list(platforms)
    if not chosen:
        raise QueryError("Pick at least one platform.")
    unknown = [platform for platform in chosen if platform not in PLATFORMS]
    if unknown:
        raise QueryError(f"Platform must be one of {', '.join(PLATFORMS)}.")
    return chosen


def _projection(projection: str) -> None:
    if projection not in PROJECTIONS:
        raise QueryError("projection must be basic, default, or full.")


def _paging(spec: dict, offset: int, limit: int) -> None:
    limit_schema = _parameter(spec, CONTENT_PATH, "limit")["schema"]
    offset_schema = _parameter(spec, CONTENT_PATH, "offset")["schema"]
    if not isinstance(offset, int) or offset < offset_schema["minimum"]:
        raise QueryError("offset must be an integer >= 0.")
    if not isinstance(limit, int) or limit < limit_schema["minimum"] or limit > limit_schema["maximum"]:
        raise QueryError(
            f"limit must be an integer from {limit_schema['minimum']} to {limit_schema['maximum']}."
        )


def _sort(spec: dict, sort: str) -> None:
    field, _, direction = sort.partition(":")
    if field not in content_sort_fields(spec):
        raise QueryError(f"Unsupported content sort field: {field}")
    if direction and direction not in {"asc", "desc"}:
        raise QueryError("Sort direction must be asc or desc.")


def _parameter(spec: dict, path: str, name: str) -> dict:
    for parameter in spec["paths"][path]["post"]["parameters"]:
        if parameter["name"] == name:
            return parameter
    raise QueryError(f"{path} has no {name} parameter in the snapshot")


def _identifier(value: str, label: str) -> None:
    if not isinstance(value, str) or len(value) != 32:
        raise QueryError(f"{label} must be a 32-character string. The schema fixes minLength and maxLength at 32.")


def _require_filter(spec: dict, schema_name: str, field: str, operand: str) -> None:
    properties = schema(spec, schema_name)["properties"]
    if field not in properties or operand not in properties[field]["properties"]:
        raise QueryError(f"{schema_name}.{field}.{operand} is not in the snapshot")


def _text_filter(spec: dict, field: str, operand: str, values: list[str]) -> dict:
    _require_filter(spec, "SearchContentsRequest.Filters.Body", field, operand)
    return {operand: {"values": values, "operator": "or"}}
