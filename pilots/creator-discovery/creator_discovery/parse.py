"""Parse captured Oriane content-search payloads into one creator's posts.

The pinned OpenAPI document (pilots/oriane-api/schema/openapi.snapshot.json)
lists three POST routes: /rest/contents/search, /rest/profiles/search, and
/rest/assets. A creator's own indexed posts are a contents search with
profileHandle.exactMatch and platform.includes. That request has no brand
filter. aiSearchAnchor is for later pages of a visual-similarity search, not
for handle paging. Content objects have no brands array and no paid flag.

This module only reads JSON that is already on disk.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

CARD_OCR = re.compile(
    r"(\bmembership\b.+\bcard\b|\bcard\b.+\bmembership\b|\b\d{12,}\b|passport|card number)",
    re.IGNORECASE | re.DOTALL,
)


class ParseError(ValueError):
    """The file is not a content-search capture this pilot can read."""


@dataclass
class FrameText:
    frame_id: str
    timestamp_seconds: float | None
    texts: list[str]


@dataclass
class MediaRecord:
    index: int
    transcript_state: str
    transcript: str | None
    chunks: list[dict]
    ocr_state: str
    on_screen_text: list[str]
    frames: list[FrameText]
    redacted_frames: int
    tags: list[str]


@dataclass
class Post:
    id: str
    platform: str
    platform_id: str
    handle: str
    published_at: str
    views: int | float | None
    caption: str | None
    title: str | None
    hashtags: list[str]
    mentions: list[str]
    coauthors: list[str]
    media: list[MediaRecord]


@dataclass
class Dropped:
    platform: str | None
    platform_id: str | None
    handle: str | None
    reason: str


@dataclass
class Enumeration:
    handle: str
    platform: str
    creator_only: bool
    brand_filter: object
    http_status: object
    pagination: dict
    posts: list[Post]
    dropped: list[Dropped]
    ocr_strings_redacted: int
    sanitization_note: dict
    kind: str


def load_json(path: str | Path) -> object:
    file_path = Path(path)
    with file_path.open(encoding="utf-8") as handle:
        return json.load(handle)


def load_captures(path: str | Path) -> list[dict]:
    """Return a list of capture dicts. Accepts the handoff bundle, one capture, or an Oriane page."""
    payload = load_json(path)
    if isinstance(payload, dict) and isinstance(payload.get("captures"), list):
        captures = payload["captures"]
    elif isinstance(payload, dict) and isinstance(payload.get("pages"), list):
        captures = [_normalize_capture(page) for page in payload["pages"]]
        return captures
    elif isinstance(payload, list):
        captures = [_posts_capture(payload)]
    else:
        captures = [_normalize_capture(payload)]
    return [_normalize_capture(capture) for capture in captures]


def enumerate_capture(capture: dict, handle: str | None = None, platform: str | None = None) -> Enumeration:
    scope = capture.get("scope") or {}
    brand_filter = scope.get("brand_filter")
    resolved_handle = _normalize_handle(handle or scope.get("handle") or "")
    resolved_platform = _normalize_platform(platform or scope.get("platform") or "")
    if not resolved_handle or not resolved_platform:
        raise ParseError("A capture needs a handle and a platform, from scope or from the CLI.")
    redacted = 0
    posts: list[Post] = []
    dropped: list[Dropped] = []
    seen: set[tuple[str, str]] = set()
    for raw in capture.get("posts") or []:
        if not isinstance(raw, dict):
            dropped.append(Dropped(None, None, None, "not_an_object"))
            continue
        post, removed = _post_from_raw(raw)
        redacted += removed
        key = (post.platform, post.platform_id)
        if post.platform != resolved_platform or _normalize_handle(post.handle) != resolved_handle:
            dropped.append(Dropped(post.platform, post.platform_id, post.handle, "outside_author_platform"))
            continue
        if key in seen:
            dropped.append(Dropped(post.platform, post.platform_id, post.handle, "duplicate_platform_id"))
            continue
        seen.add(key)
        posts.append(post)
    posts.sort(key=lambda item: (item.published_at, item.platform_id), reverse=True)
    note = capture.get("sanitization") if isinstance(capture.get("sanitization"), dict) else {}
    return Enumeration(
        handle=resolved_handle,
        platform=resolved_platform,
        creator_only=brand_filter in (None, "", False),
        brand_filter=brand_filter,
        http_status=capture.get("http_status"),
        pagination=capture.get("pagination") or {},
        posts=posts,
        dropped=dropped,
        ocr_strings_redacted=redacted,
        sanitization_note=dict(note),
        kind=str(capture.get("kind") or "unspecified"),
    )


def transcript_label(post: Post) -> str:
    states = [media.transcript_state for media in post.media]
    return _roll_up(states, present="present")


def ocr_label(post: Post) -> str:
    states = [media.ocr_state for media in post.media]
    return _roll_up(states, present="present")


def frame_count(post: Post) -> int:
    return sum(len(media.frames) for media in post.media)


def _normalize_capture(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise ParseError("A capture must be a JSON object.")
    if "error" in payload and "data" not in payload and "posts" not in payload:
        raise ParseError("Error response with no results. This pilot does not treat that as an empty creator.")
    if "posts" in payload:
        return payload
    if isinstance(payload.get("data"), dict) and "results" in payload["data"]:
        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        pagination = metadata.get("pagination") if isinstance(metadata.get("pagination"), dict) else {}
        return {
            "kind": payload.get("kind") or "oriane_page",
            "scope": payload.get("scope") or {},
            "http_status": payload.get("http_status"),
            "pagination": pagination,
            "posts": payload["data"]["results"],
            "sanitization": payload.get("sanitization") or {},
        }
    if "results" in payload:
        return {
            "kind": payload.get("kind") or "results",
            "scope": payload.get("scope") or {},
            "http_status": payload.get("http_status"),
            "pagination": payload.get("pagination") or {},
            "posts": payload["results"],
            "sanitization": payload.get("sanitization") or {},
        }
    raise ParseError("No posts or data.results in the capture.")


def _posts_capture(posts: list) -> dict:
    return {"kind": "post_list", "scope": {}, "posts": posts, "pagination": {}, "sanitization": {}}


def _post_from_raw(raw: dict) -> tuple[Post, int]:
    for key in ("id", "platform", "platformId", "profileHandle", "publishedAt"):
        if key not in raw:
            raise ParseError(f"Content result is missing {key}.")
    removed = 0
    media_records: list[MediaRecord] = []
    for index, media in enumerate(raw.get("media") or []):
        if not isinstance(media, dict):
            continue
        record, count = _media_from_raw(index, media)
        removed += count
        media_records.append(record)
    return (
        Post(
            id=str(raw["id"]),
            platform=_normalize_platform(raw["platform"]),
            platform_id=str(raw["platformId"]),
            handle=str(raw["profileHandle"]),
            published_at=str(raw["publishedAt"]),
            views=_views(raw.get("viewsCount")),
            caption=raw.get("caption") if isinstance(raw.get("caption"), str) else None,
            title=raw.get("title") if isinstance(raw.get("title"), str) else None,
            hashtags=[str(tag) for tag in raw.get("hashtags") or [] if isinstance(tag, str)],
            mentions=_handles(raw.get("mentions")),
            coauthors=_handles(raw.get("coAuthors")),
            media=media_records,
        ),
        removed,
    )


def _media_from_raw(index: int, media: dict) -> tuple[MediaRecord, int]:
    removed = 0
    if "transcript" not in media:
        transcript_state = "missing"
        transcript = None
    elif media["transcript"] is None:
        transcript_state = "null"
        transcript = None
    elif isinstance(media["transcript"], str) and media["transcript"].strip() == "":
        transcript_state = "empty"
        transcript = ""
    elif isinstance(media["transcript"], str):
        transcript_state = "present"
        transcript = media["transcript"]
    else:
        transcript_state = "missing"
        transcript = None
    chunks = []
    for chunk in media.get("transcriptChunks") or []:
        if isinstance(chunk, dict) and isinstance(chunk.get("text"), str):
            chunks.append(
                {
                    "start_seconds": chunk.get("startSeconds"),
                    "end_seconds": chunk.get("endSeconds"),
                    "text": chunk["text"],
                }
            )
    if "onScreenText" not in media:
        ocr_state = "missing"
        kept_ocr: list[str] = []
    elif media["onScreenText"] is None:
        ocr_state = "null"
        kept_ocr = []
    elif isinstance(media["onScreenText"], list):
        kept_ocr = []
        for item in media["onScreenText"]:
            if not isinstance(item, str):
                continue
            if CARD_OCR.search(item):
                removed += 1
                continue
            kept_ocr.append(item)
        if len(media["onScreenText"]) == 0:
            ocr_state = "empty"
        elif not kept_ocr:
            ocr_state = "redacted"
        else:
            ocr_state = "present"
    else:
        ocr_state = "missing"
        kept_ocr = []
    frames: list[FrameText] = []
    redacted_frames = 0
    for frame in media.get("frames") or []:
        if not isinstance(frame, dict):
            continue
        if frame.get("redacted") is True or "redacted_frame" in frame:
            redacted_frames += 1
            continue
        texts = []
        for region in frame.get("onScreenTextRegions") or []:
            if isinstance(region, dict) and isinstance(region.get("text"), str):
                if CARD_OCR.search(region["text"]):
                    removed += 1
                    continue
                texts.append(region["text"])
        frames.append(
            FrameText(
                frame_id=str(frame.get("id") or ""),
                timestamp_seconds=frame.get("timestampSeconds") if isinstance(frame.get("timestampSeconds"), (int, float)) else None,
                texts=texts,
            )
        )
    tags = _handles(media.get("tags"))
    return (
        MediaRecord(
            index=index,
            transcript_state=transcript_state,
            transcript=transcript,
            chunks=chunks,
            ocr_state=ocr_state,
            on_screen_text=kept_ocr,
            frames=frames,
            redacted_frames=redacted_frames,
            tags=tags,
        ),
        removed,
    )


def _handles(items: object) -> list[str]:
    if not isinstance(items, list):
        return []
    handles = []
    for item in items:
        if isinstance(item, dict) and isinstance(item.get("profileHandle"), str):
            handles.append(item["profileHandle"])
        elif isinstance(item, str):
            handles.append(item)
    return handles


def _views(value: object) -> int | float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else value
    return None


def _normalize_handle(handle: str) -> str:
    cleaned = handle.strip()
    if cleaned.startswith("@"):
        cleaned = cleaned[1:]
    return cleaned.casefold()


def _normalize_platform(platform: str) -> str:
    return platform.strip().casefold()


def _roll_up(states: list[str], present: str) -> str:
    if any(state == present for state in states):
        return present
    if not states:
        return "missing"
    if all(state == "null" for state in states):
        return "null"
    if all(state == "empty" for state in states):
        return "empty"
    if all(state == "missing" for state in states):
        return "missing"
    if all(state == "redacted" for state in states):
        return "redacted"
    return "no_nonempty"


def field_texts(post: Post) -> list[dict]:
    """Text fields a quote is allowed to come from. Comments, bio, and audio title are omitted."""
    rows = []
    if post.caption:
        rows.append({"field": "caption", "media_index": None, "timestamp_seconds": None, "text": post.caption})
    if post.title:
        rows.append({"field": "title", "media_index": None, "timestamp_seconds": None, "text": post.title})
    for tag in post.hashtags:
        rows.append({"field": "hashtag", "media_index": None, "timestamp_seconds": None, "text": tag})
    for handle in post.mentions:
        rows.append({"field": "mention", "media_index": None, "timestamp_seconds": None, "text": handle})
    for handle in post.coauthors:
        rows.append({"field": "coauthor", "media_index": None, "timestamp_seconds": None, "text": handle})
    for media in post.media:
        for handle in media.tags:
            rows.append(
                {"field": "media_tag", "media_index": media.index, "timestamp_seconds": None, "text": handle}
            )
        if media.transcript:
            rows.append(
                {
                    "field": "transcript",
                    "media_index": media.index,
                    "timestamp_seconds": None,
                    "text": media.transcript,
                }
            )
        for chunk in media.chunks:
            rows.append(
                {
                    "field": "transcript_chunk",
                    "media_index": media.index,
                    "timestamp_seconds": chunk["start_seconds"],
                    "text": chunk["text"],
                }
            )
        for text in media.on_screen_text:
            rows.append(
                {"field": "on_screen_text", "media_index": media.index, "timestamp_seconds": None, "text": text}
            )
        for frame in media.frames:
            for text in frame.texts:
                rows.append(
                    {
                        "field": "frame_ocr",
                        "media_index": media.index,
                        "timestamp_seconds": frame.timestamp_seconds,
                        "text": text,
                    }
                )
    return rows
