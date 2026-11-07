"""Bounded, independently retryable creator-and-brand evidence retrieval."""

import copy
import json
from concurrent.futures import ThreadPoolExecutor

from app.cache import response_cache
from app.gmi import assess
from app.oriane import PAGE_LIMIT, call_search, search_terms
from app.rank import apply_judgments, dedup_posts, group_creators, project_post

MAX_PAGES = 2


def creator_brand_body(handle: str, platform: str, terms: list[str]) -> dict:
    return {
        "operator": "and",
        "filters": {
            "profileHandle": {"exactMatch": {"values": [handle], "operator": "or"}},
            "platform": {"includes": [platform]},
        },
        "queries": [{"operator": "or", "queries": [
            {"operator": "and", "filters": {field: {"includesExactly": {"values": terms, "operator": "or"}}}}
            for field in ("caption", "hashtags", "mentionHandles", "transcript", "onScreenText")
        ]}],
    }


def run_creator_search(request: dict, settings, post_json) -> dict:
    handle, platform = request["handle"], request["platform"]
    terms = search_terms(request["brand"], request.get("aliases") or [])
    key = json.dumps(["creator-brand-v1", terms, platform, handle.casefold(), settings.gmi_model])
    cached = response_cache.get(key)
    if isinstance(cached, dict):
        return {**copy.deepcopy(cached), "cache": "hit"}
    response = {
        "brand": request["brand"], "assessment": "not_run", "assessmentReason": None,
        "rankedCreators": [], "heldOut": [], "unassessedCreators": [], "channels": [], "warnings": [],
        "cache": "miss", "gmiModel": settings.gmi_model,
        "depth": {"status": "complete", "handle": handle, "platform": platform,
                  "pagesFetched": 0, "maxPosts": MAX_PAGES * PAGE_LIMIT, "hasMore": False},
    }
    depth = response["depth"]
    if not settings.oriane_configured or not settings.gmi_configured:
        depth["status"] = "failed"
        response["assessmentReason"] = "oriane_not_configured" if not settings.oriane_configured else "gmi_not_configured"
        return response

    posts = []
    body = creator_brand_body(handle, platform, terms)
    for page in range(MAX_PAGES):
        result = call_search(post_json, settings.oriane_base_url, settings.oriane_api_key,
                             body, "viewsCount:desc", settings.timeout_seconds, offset=page * PAGE_LIMIT)
        response["channels"].append({"channel": "creator_brand", "status": result["status"],
                                     "retrieved": len(result["rows"]), "offset": page * PAGE_LIMIT})
        if result["status"] != "ok":
            response["warnings"].append("More posts could not be retrieved. Earlier matches are retained.")
            depth["status"] = "partial" if posts else "failed"
            break
        depth["pagesFetched"] += 1
        for row in result["rows"]:
            post = project_post(row, "creator_brand", terms)
            if post and post["platform"] == platform and post["handle"].casefold() == handle.casefold():
                posts.append(post)
            else:
                depth["status"] = "partial"
        total = result["indexCandidateCount"]
        depth["hasMore"] = (page + 1) * PAGE_LIMIT < total if total is not None else len(result["rows"]) == PAGE_LIMIT
        if len(result["rows"]) < PAGE_LIMIT or not depth["hasMore"]:
            depth["hasMore"] = False
            break

    posts = dedup_posts(posts)
    judgments = {}
    # Two independent ten-post batches keep output bounded and fit the function budget.
    with ThreadPoolExecutor(max_workers=2) as pool:
        batches = [pool.submit(assess, post_json, settings, request["brand"], terms, posts[i:i + PAGE_LIMIT])
                   for i in range(0, len(posts), PAGE_LIMIT)]
        for future in batches:
            result, reason = future.result()
            if result:
                judgments.update(result)
            if reason:
                response["assessmentReason"] = reason
    matched = {post["postKey"] for post in posts} & judgments.keys()
    if len(matched) < len(posts):
        depth["status"] = "partial" if matched else "failed"
        response["warnings"].append("Some additional posts could not be assessed. They do not add to views or matching-post counts.")
    response.update(apply_judgments(group_creators(posts), judgments or None, terms))
    response["assessment"] = "complete" if posts and len(matched) == len(posts) else "partial" if matched else "unassessed" if posts else "not_run"
    if depth["status"] == "complete":
        response_cache.set(key, copy.deepcopy(response), settings.response_ttl_seconds)
    return response
