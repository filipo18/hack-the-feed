"""Interpret a content object the caller already has.

Synthetic fixtures must keep `_fixture` set. Nothing here claims the object
came from a live Oriane response.
"""

from __future__ import annotations

import math
import re

TOKEN = re.compile(r"[a-z0-9]{4,}")

TRANSCRIPT_ABSENCE = (
    "transcript and transcriptChunks are nullable. The schema does not define null as "
    "'these words were not spoken' (it does say that for onScreenText: empty means no text found, "
    "null means not processed). Absence in a payload is not proof the creator did not say something."
)


def canonical_post_link(content: dict) -> dict:
    return {
        "url": None,
        "status": "unresolved",
        "reason": (
            "Content results document id, platform, platformId, and thumbnailMediaUrl. "
            "The pinned OpenAPI property set has no post URL. This client does not build a "
            "TikTok, Instagram, or YouTube permalink from platformId. The product help CSV "
            "lists Video URL and Video Code; that list is not this REST schema."
        ),
        "id": content.get("id"),
        "platform": content.get("platform"),
        "platformId": content.get("platformId"),
        "thumbnailMediaUrl": content.get("thumbnailMediaUrl"),
    }


def channel_report(content: dict) -> dict:
    """Split caption/hashtags, speech, and on-screen text, then align frames to speech chunks.

    Token gaps are a client diff of documented strings. They are not brand entities
    and they are not a payment status.
    """
    media = _primary_media(content)
    caption_text = " ".join(
        part
        for part in [
            content.get("caption") or "",
            media.get("caption") or "",
            " ".join(content.get("hashtags") or []),
        ]
        if part
    )
    chunks = media.get("transcriptChunks") or []
    if chunks:
        transcript_text = " ".join(chunk.get("text") or "" for chunk in chunks)
        timestamps = True
    else:
        transcript_text = media.get("transcript") or ""
        timestamps = False
    ocr_parts = [part for part in (media.get("onScreenText") or []) if part]
    for frame in media.get("frames") or []:
        for region in frame.get("onScreenTextRegions") or []:
            if region.get("text"):
                ocr_parts.append(region["text"])
    ocr_text = " ".join(ocr_parts)
    on_screen_state = _on_screen_state(media.get("onScreenText"))

    caption_tokens = _tokens(caption_text)
    spoken_tokens = _tokens(transcript_text)
    shown_tokens = _tokens(ocr_text)
    frames = list(media.get("frames") or [])
    alignments = [_align_chunk(chunk, frames) for chunk in chunks]

    return {
        "source_label": "synthetic_fixture" if content.get("_fixture") else "caller_supplied_object",
        "fixture": content.get("_fixture"),
        "live_oriane_response": False,
        "payment_status": "not_in_schema_creator_must_confirm",
        "brand_properties_read": [],
        "viewsCount": content.get("viewsCount"),
        "viewsCount_nullable": True,
        "illustrative_media_value": "not_computed",
        "permalink": canonical_post_link(content),
        "transcript_absence": TRANSCRIPT_ABSENCE,
        "channels": {
            "caption_and_hashtags": {
                "certainty": "metadata_text",
                "text": caption_text,
                "tokens": sorted(caption_tokens),
            },
            "transcript": {
                "certainty": "speech_transcript",
                "text": transcript_text,
                "timestamps_present": timestamps,
                "tokens": sorted(spoken_tokens),
            },
            "on_screen_text": {
                "certainty": "ocr_text",
                "state": on_screen_state,
                "text": ocr_text,
                "tokens": sorted(shown_tokens),
            },
        },
        "only_caption": sorted(caption_tokens - spoken_tokens - shown_tokens),
        "only_spoken": sorted(spoken_tokens - caption_tokens - shown_tokens),
        "only_on_screen": sorted(shown_tokens - caption_tokens - spoken_tokens),
        "spoken_and_on_screen_not_caption": sorted((spoken_tokens & shown_tokens) - caption_tokens),
        "chunk_frames": alignments,
        "frames_are_unlabeled_images": True,
        "vision_executed": False,
    }


def page_plan(total_count: int, limit: int = 100) -> dict:
    if limit < 1 or limit > 100:
        raise ValueError("limit must stay inside the documented 1..100 range.")
    if total_count < 0:
        raise ValueError("totalCount cannot be negative.")
    calls = 0 if total_count == 0 else math.ceil(total_count / limit)
    return {
        "search_calls_for_full_enumeration": calls,
        "limit": limit,
        "oriane_credit_price": None,
        "price_note": (
            "The OpenAPI document does not price projections. The public pricing page says "
            "search cost depends on projection, and the numeric table was not in the static HTML "
            "fetched on 2026-11-06. Do not copy third-party credit figures onto this API."
        ),
    }


def _primary_media(content: dict) -> dict:
    media = content.get("media") or []
    if not media:
        return {}
    return media[0]


def _tokens(text: str) -> set[str]:
    return set(TOKEN.findall(text.casefold()))


def _on_screen_state(value: object) -> str:
    if value is None:
        return "null_not_processed"
    if value == []:
        return "empty_no_text_found"
    return "text_present"


def _align_chunk(chunk: dict, frames: list[dict]) -> dict:
    start = chunk.get("startSeconds")
    end = chunk.get("endSeconds")
    aligned: dict = {
        "text": chunk.get("text"),
        "startSeconds": start,
        "endSeconds": end,
        "certainty": "speech_transcript",
        "frame": None,
        "alignment": "no_frames",
    }
    if not frames or start is None or end is None:
        return aligned
    midpoint = (float(start) + float(end)) / 2
    frame = min(frames, key=lambda item: abs(float(item["timestampSeconds"]) - midpoint))
    timestamp = float(frame["timestampSeconds"])
    overlaps = float(start) <= timestamp <= float(end)
    aligned["alignment"] = "overlaps" if overlaps else "nearest_outside_chunk"
    aligned["frame"] = {
        "id": frame.get("id"),
        "timestampSeconds": timestamp,
        "url": frame.get("url"),
        "onScreenTextRegions": frame.get("onScreenTextRegions"),
        "brand_label": None,
    }
    return aligned
