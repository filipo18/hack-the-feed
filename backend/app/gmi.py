"""OpenAI-compatible chat call. No model id is assumed.

Public docs (checked 6 Nov 2026): POST {base}/chat/completions with
Authorization: Bearer, JSON body model + messages. Base default
https://api.gmi-serving.com/v1. Docs disagree on max_tokens (the example
uses 2000; one table says 1-128). A truncated or non-JSON body is a
failed assessment, not a judgment.
"""

from __future__ import annotations

import json
import re

from app.http import ProviderCallError, provider_http_note

VERDICTS = {"relevant", "irrelevant", "uncertain"}
HOLDOUTS = {"owned_account", "complaint", "repost", "asr_false_positive", "incidental"}
FORBIDDEN_WHY = ("unpaid", "invoice", "cpm")
WHY_LIMIT = 400

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def build_request(model: str, brand: str, terms: list[str], posts: list[dict]) -> dict:
    packet = []
    for post in posts:
        packet.append(
            {
                "postKey": post["postKey"],
                "platform": post["platform"],
                "handle": post["handle"],
                "viewsCount": post["viewsCount"],
                "disclosure": post["disclosure"],
                "evidenceLabels": post["evidenceLabels"],
                "retrievedBy": post["retrievedBy"],
                "caption": _clip(post.get("caption")),
                "hashtags": post.get("hashtags") or [],
                "mentions": [item.get("profileHandle") for item in post.get("mentions") or []],
                "transcript": _clip(_transcript_text(post)),
                "onScreenText": _clip(_screen_text(post)),
                "visualCandidate": "visual" in post["evidenceLabels"],
            }
        )
    instructions = (
        "Classify each post for the brand. Return one JSON object and nothing else:\n"
        '{"posts":[{"postKey":"...","verdict":"relevant|irrelevant|uncertain",'
        '"holdout":null|"owned_account"|"complaint"|"repost"|"asr_false_positive"|"incidental",'
        '"why":"one or two sentences"}]}\n'
        "A single real mention is relevant. Do not prefer accounts that repeat the brand.\n"
        "Speech-to-text can glue the brand onto a different name. That is asr_false_positive and verdict irrelevant.\n"
        "The brand's own account is owned_account. Complaints and accident coverage are complaint.\n"
        "A bare repost of the brand with no creator point of view is repost.\n"
        "A joke, a game, or a paid disclosure for a different brand is incidental.\n"
        "If you cannot tell, verdict is uncertain.\n"
        "why uses only these excerpts. No outreach, no invoice, no CPM, and do not call a mention unpaid.\n"
        "Visual hits are uncalibrated candidates. Colors are not the brand. Vision was not run.\n"
        "viewsCount is that post's platform view count, not unique people and not the whole catalog."
    )
    user = json.dumps({"brand": brand, "terms": terms, "posts": packet}, ensure_ascii=False)
    return {
        "model": model,
        "temperature": 0,
        "max_tokens": 2000,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": instructions},
            {"role": "user", "content": user},
        ],
    }


def message_content(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return None
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        return None
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(message, dict):
        return None
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        return None
    return content


def parse_judgments(content: str) -> dict[str, dict] | None:
    text = _FENCE.sub("", content.strip())
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    rows = data.get("posts") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return None
    parsed: dict[str, dict] = {}
    for item in rows:
        one = _one_judgment(item)
        if one is None:
            continue
        parsed[one["postKey"]] = one
    if not parsed:
        return None
    return parsed


def assess(post_json, settings, brand: str, terms: list[str], posts: list[dict]) -> tuple[dict[str, dict] | None, str | None, str | None]:
    """Returns (judgments, error_reason, safe_detail). judgments is None when nothing usable came back."""
    if not settings.gmi_configured:
        return None, "gmi_not_configured", None
    body = build_request(settings.gmi_model or "", brand, terms, posts)
    url = f"{settings.gmi_base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.gmi_api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    try:
        status, payload = post_json(url, body, headers, settings.timeout_seconds)
    except ProviderCallError as exc:
        return None, "gmi_error", (
            f"GMI chat {exc}. Limit {settings.timeout_seconds:g}s. "
            "A full page of posts can exceed a short limit. Nothing was ranked."
        )
    if status != 200:
        return None, "gmi_error", provider_http_note("GMI chat", status, payload)
    content = message_content(payload)
    if content is None:
        return None, "malformed_model_response", None
    judgments = parse_judgments(content)
    if judgments is None:
        return None, "malformed_model_response", None
    return judgments, None, None


def _one_judgment(item: object) -> dict | None:
    if not isinstance(item, dict):
        return None
    post_key = item.get("postKey")
    verdict = item.get("verdict")
    why = item.get("why")
    holdout = item.get("holdout")
    if not isinstance(post_key, str) or not post_key:
        return None
    if verdict not in VERDICTS:
        return None
    if holdout is not None and holdout not in HOLDOUTS:
        return None
    if not isinstance(why, str):
        return None
    cleaned = " ".join(why.split())
    if not cleaned:
        return None
    folded = cleaned.casefold()
    if any(token in folded for token in FORBIDDEN_WHY):
        return None
    if len(cleaned) > WHY_LIMIT:
        cleaned = cleaned[: WHY_LIMIT - 1].rstrip() + "…"
    return {"postKey": post_key, "verdict": verdict, "holdout": holdout, "why": cleaned}


def _clip(value: str | None, limit: int = 500) -> str | None:
    if value is None:
        return None
    text = " ".join(value.split())
    if not text:
        return None
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _transcript_text(post: dict) -> str | None:
    parts: list[str] = []
    for media in post.get("media") or []:
        if media.get("transcript"):
            parts.append(media["transcript"])
        for chunk in media.get("transcriptChunks") or []:
            if chunk.get("text"):
                parts.append(chunk["text"])
    return "\n".join(parts) or None


def _screen_text(post: dict) -> str | None:
    parts: list[str] = []
    for media in post.get("media") or []:
        parts.extend(media.get("onScreenText") or [])
        for frame in media.get("frames") or []:
            for region in frame.get("onScreenTextRegions") or []:
                if region.get("text"):
                    parts.append(region["text"])
    return "\n".join(parts) or None
