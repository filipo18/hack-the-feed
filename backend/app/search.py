"""Run four Oriane channels, then assess bounded batches. Channels fail independently."""

from __future__ import annotations

import copy
import json
from concurrent.futures import ThreadPoolExecutor

from app.cache import asset_cache, response_cache
from app.gmi import assess
from app.http import ProviderCallError
from app.oriane import (
    CHANNEL_ORDER,
    PAGE_LIMIT,
    bearer_headers,
    call_search,
    default_visual_text,
    image_asset_body,
    parse_asset_id,
    search_terms,
    text_asset_body,
    text_channel_body,
    visual_body,
    written_body,
)
from app.rank import apply_judgments, dedup_posts, group_creators, project_post

SAMPLE_NOTE = (
    "Ranking uses this retrieved sample only, not the Oriane catalog. "
    "Each channel is one page of 10. indexCandidateCount values overlap; do not add them. "
    "Views are platform counts for those posts, not unique people. "
    "The same footage can appear on more than one account and is not deduplicated. "
    "Visual scores are uncalibrated candidate matches. Vision was not run. "
    "A color match is not a brand match."
)


def run_search(request: dict, settings, post_json) -> dict:
    terms = search_terms(request["brand"], request.get("aliases") or [])
    platforms = list(dict.fromkeys(request["platforms"]))
    cache_key = json.dumps(
        {
            "brand": request["brand"].strip(),
            "terms": terms,
            "platforms": platforms,
            "visualText": request.get("visualText"),
            "visualImageUrl": request.get("visualImageUrl"),
            "gmiModel": settings.gmi_model,
        },
        sort_keys=True,
    )
    cached = response_cache.get(cache_key)
    if isinstance(cached, dict):
        hit = copy.deepcopy(cached)
        hit["cache"] = "hit"
        return hit

    if not settings.oriane_configured:
        body = _empty_response(request, terms, platforms, settings)
        for name in CHANNEL_ORDER:
            body["channels"].append(_channel(name, "not_configured", None, None, 0,
                                              "ORIANE_API_KEY is not set. This channel was not called."))
        body["warnings"].append("Oriane was not called because ORIANE_API_KEY is unset.")
        body["assessment"] = "unassessed"
        body["assessmentReason"] = "oriane_not_configured"
        return body

    text_jobs = {
        "written": (written_body(terms, platforms), "viewsCount:desc"),
        "transcript": (text_channel_body("transcript", terms, platforms, "transcript"), "viewsCount:desc"),
        "ocr": (text_channel_body("onScreenText", terms, platforms, "ocr"), "viewsCount:desc"),
    }
    with ThreadPoolExecutor(max_workers=4) as pool:
        text_futures = {
            name: pool.submit(
                call_search,
                post_json,
                settings.oriane_base_url,
                settings.oriane_api_key,
                body,
                sort,
                settings.timeout_seconds,
            )
            for name, (body, sort) in text_jobs.items()
        }
        visual_future = pool.submit(
            _visual_channel,
            post_json,
            settings,
            request,
            terms,
            platforms,
        )
        raw_channels = {name: future.result() for name, future in text_futures.items()}
        raw_channels["visual"] = visual_future.result()

    posts = []
    channels = []
    warnings = []
    for name in CHANNEL_ORDER:
        raw = raw_channels[name]
        retrieved = 0
        for row in raw["rows"]:
            projected = project_post(row, name, terms)
            if projected is None:
                continue
            posts.append(projected)
            retrieved += 1
        if raw["warning"]:
            warnings.append(f"{name}: {raw['warning']}")
        channels.append(
            _channel(
                name,
                raw["status"],
                raw["httpStatus"],
                raw["indexCandidateCount"],
                retrieved,
                raw["warning"],
            )
        )

    deduped = dedup_posts(posts)
    creators = group_creators(deduped)
    response = _empty_response(request, terms, platforms, settings)
    response["channels"] = channels
    response["warnings"] = warnings
    response["retrievedRows"] = len(posts)
    response["distinctPosts"] = len(deduped)
    response["visualReference"] = raw_channels["visual"].get("visualReference")
    response["visualAssetReused"] = raw_channels["visual"].get("assetReused", False)

    if not deduped:
        response["assessment"] = "not_run"
        response["assessmentReason"] = "no_posts"
        if all(channel["status"] == "ok" for channel in channels):
            response["cache"] = "miss"
            response_cache.set(cache_key, response, settings.response_ttl_seconds)
        return response

    judgments, reason = assess(post_json, settings, request["brand"].strip(), terms, deduped)
    if judgments is not None and not any(post["postKey"] in judgments for post in deduped):
        judgments = None
        reason = "malformed_model_response"
    split = apply_judgments(creators, judgments, terms)
    response.update(split)
    if judgments is None:
        response["assessment"] = "unassessed"
        response["assessmentReason"] = reason
        return response
    complete = all(post["postKey"] in judgments for post in deduped)
    response["assessment"] = "complete" if complete else "partial"
    response["assessmentReason"] = None if complete else "partial_model_response"
    if not complete:
        response["warnings"].append("Some retrieved posts could not be assessed. Only assessed relevant posts contribute to the ranking.")
    response["cache"] = "miss"
    if complete and all(channel["status"] == "ok" for channel in channels):
        response_cache.set(cache_key, response, settings.response_ttl_seconds)
    return response


def _visual_channel(post_json, settings, request: dict, terms: list[str], platforms: list[str]) -> dict:
    reference, asset_body = _reference(request)
    cache_key = json.dumps(asset_body, sort_keys=True)
    cached_id = asset_cache.get(cache_key)
    reused = isinstance(cached_id, str)
    asset_id = cached_id if reused else None
    if asset_id is None:
        try:
            status, payload = post_json(
                f"{settings.oriane_base_url}/rest/assets",
                asset_body,
                bearer_headers(settings.oriane_api_key),
                settings.timeout_seconds,
            )
        except ProviderCallError as exc:
            return _failed_visual(reference, False, f"Reference asset was not created: {exc}.")
        asset_id = parse_asset_id(status, payload)
        if not asset_id:
            return _failed_visual(reference, False, f"Reference asset was not created: HTTP {status}.")
        asset_cache.set(cache_key, asset_id, settings.asset_ttl_seconds)
    parsed = call_search(
        post_json,
        settings.oriane_base_url,
        settings.oriane_api_key,
        visual_body(asset_id, platforms),
        "visualSimilarity:desc",
        settings.timeout_seconds,
    )
    parsed["visualReference"] = reference
    parsed["assetReused"] = reused
    return parsed


def _reference(request: dict) -> tuple[dict, dict]:
    image = (request.get("visualImageUrl") or "").strip()
    text = (request.get("visualText") or "").strip()
    if image:
        return {"kind": "image", "text": None}, image_asset_body(image)
    if text:
        return {"kind": "text", "text": text[:300]}, text_asset_body(text[:300])
    generated = default_visual_text(request["brand"])
    return {"kind": "text", "text": generated, "generated": True}, text_asset_body(generated)


def _failed_visual(reference: dict, reused: bool, warning: str) -> dict:
    return {
        "status": "failed",
        "httpStatus": None,
        "indexCandidateCount": None,
        "rows": [],
        "warning": warning,
        "visualReference": reference,
        "assetReused": reused,
    }


def _channel(name: str, status: str, http_status: int | None, total: int | None, retrieved: int, warning: str | None) -> dict:
    return {
        "channel": name,
        "status": status,
        "httpStatus": http_status,
        "indexCandidateCount": total,
        "retrieved": retrieved,
        "pageLimit": PAGE_LIMIT,
        "warning": warning,
    }


def _empty_response(request: dict, terms: list[str], platforms: list[str], settings) -> dict:
    return {
        "brand": request["brand"].strip(),
        "terms": terms,
        "platforms": platforms,
        "assessment": "not_run",
        "assessmentReason": None,
        "gmiModel": settings.gmi_model,
        "rankingBasis": "sum_of_views_on_distinct_relevant_posts_in_retrieved_sample",
        "sampleNote": SAMPLE_NOTE,
        "visionVerificationRun": False,
        "visualScoresUncalibrated": True,
        "repeatedFootageNotDeduplicated": True,
        "viewsAreNotUniqueAudience": True,
        "disclosureValues": ["disclosed", "unknown"],
        "channels": [],
        "warnings": [],
        "retrievedRows": 0,
        "distinctPosts": 0,
        "visualReference": None,
        "visualAssetReused": False,
        "cache": "miss",
        "rankedCreators": [],
        "heldOut": [],
        "unassessedCreators": [],
    }
