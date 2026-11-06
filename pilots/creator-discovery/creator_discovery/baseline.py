"""Deterministic surfaces already split by the content schema.

Mentions, hashtags, co-authors, in-media account tags, and @-names written in
the caption. This is not a brand dictionary. A name that appears only inside
caption prose, speech, or OCR is invisible here on purpose. Nothing in this
module confirms a brand, and a missing disclosure is never called unpaid.
"""

from __future__ import annotations

import re

from creator_discovery.parse import Enumeration, Post

PLATFORM_TAGS = frozenset(
    {
        "fyp",
        "foryou",
        "foryoupage",
        "viral",
        "tiktok",
        "instagram",
        "reels",
        "reel",
        "explore",
        "explorepage",
        "duet",
        "stitch",
        "onthisday",
        "xyzbca",
        "trending",
    }
)

# Tokens that are already a candidate. The set does not search free text.
AMBIGUOUS_NAMES = {
    "jordan": "person_or_brand_homonym",
    "apple": "common_word_or_brand_homonym",
    "stanley": "person_or_brand_homonym",
}

DISCLOSURE_HASHTAGS = frozenset(
    {
        "ad",
        "sponsored",
        "paidpartnership",
        "paidpartner",
        "advertisement",
        "paidpromotion",
        "gifted",
    }
)

DISCLOSURE_PHRASES = (
    "paid partnership",
    "paid promotion",
    "sponsored by",
    "includes paid promotion",
    "this is an ad",
)

NEGATION_PHRASES = (
    "not sponsored",
    "not an ad",
    "not a paid partnership",
    "unsponsored",
)

CAPTION_AT = re.compile(r"@([A-Za-z0-9._]+(?:\s+[A-Z][A-Za-z0-9._]+){0,2})")
INVITED = re.compile(r"\binvited (me|us)\b", re.IGNORECASE)


def compact(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def extract(enumeration: Enumeration, confirmed_names: set[str] | None = None) -> dict:
    confirmed = {compact(name) for name in (confirmed_names or set()) if compact(name)}
    rows = []
    non_brands = []
    disclosures = []
    ignored_confirmations = []
    seen_confirmed = set()
    for post in enumeration.posts:
        disclosures.append(classify_disclosure(post))
        for row in _rows_for_post(post, enumeration.handle):
            name_key = compact(row["name"])
            if row["status"] == "brand_candidate" and name_key in confirmed:
                row["status"] = "confirmed"
                row["needs_human_confirm"] = False
                row["confirm_reason"] = "human_confirmed"
                seen_confirmed.add(name_key)
            rows.append(row)
    for name in confirmed:
        if name not in seen_confirmed:
            ignored_confirmations.append(name)
    rows.sort(key=lambda row: (row["platform"], row["platform_id"], row["field"], row["name"], row["snippet"]))
    return {
        "evidence": rows,
        "entities": _entities(rows),
        "not_brand_surfaces": non_brands_from(rows),
        "disclosures": disclosures,
        "confirmations_ignored": sorted(ignored_confirmations),
        "limits": [
            "Baseline reads mentions, hashtags, co-authors, media account tags, and caption @-names.",
            "It does not scan a brand dictionary across caption prose, transcripts, or OCR.",
            "A string that is only in speech or on-screen text is not a baseline candidate.",
            "No candidate is confirmed unless a human confirmation names a candidate that was already extracted.",
            "Disclosure is disclosed or unknown. A missing ad label is not a payment verdict.",
        ],
    }


def not_brand_surfaces(rows: list[dict]) -> list[dict]:
    return [row for row in rows if row["status"] != "brand_candidate" and row["status"] != "confirmed"]


def non_brands_from(rows: list[dict]) -> list[dict]:
    return not_brand_surfaces(rows)


def classify_disclosure(post: Post) -> dict:
    haystack = "\n".join(
        part
        for part in [post.caption or "", post.title or "", " ".join(post.hashtags)]
        if part
    )
    lowered = haystack.casefold()
    signals = []
    explicit = False
    for tag in post.hashtags:
        token = compact(tag)
        if token in DISCLOSURE_HASHTAGS:
            explicit = True
            signals.append({"code": "explicit_hashtag", "snippet": tag if tag.startswith("#") else f"#{tag}"})
    for phrase in DISCLOSURE_PHRASES:
        if phrase in lowered:
            explicit = True
            signals.append({"code": "explicit_phrase", "snippet": phrase})
    invited = INVITED.search(haystack)
    if invited:
        signals.append({"code": "invitation_language", "snippet": invited.group(0)})
    negations = [phrase for phrase in NEGATION_PHRASES if phrase in lowered]
    if negations:
        signals.append(
            {
                "code": "negation_present_payment_label_not_emitted",
                "snippet": negations[0],
            }
        )
    return {
        "post_id": post.id,
        "platform_id": post.platform_id,
        "state": "disclosed" if explicit else "unknown",
        "signals": signals,
    }


def _rows_for_post(post: Post, creator_handle: str) -> list[dict]:
    rows = []
    for tag in post.hashtags:
        label = tag[1:] if tag.startswith("#") else tag
        rows.append(_surface(post, label, "hashtag", "hashtags", tag))
    for handle in post.mentions:
        rows.append(_surface(post, handle, "mention", "mentions", handle))
    for handle in post.coauthors:
        rows.append(_surface(post, handle, "coauthor", "coAuthors", handle))
    for media in post.media:
        for handle in media.tags:
            rows.append(_surface(post, handle, "media_tag", "media.tags", handle, media_index=media.index))
    if post.caption:
        for match in CAPTION_AT.finditer(post.caption):
            surface = match.group(0)
            rows.append(_surface(post, match.group(1), "caption_at", "caption", surface))
    prepared = []
    for row in rows:
        row = _classify(row, creator_handle)
        prepared.append(row)
    return prepared


def _surface(post: Post, name: str, kind: str, field: str, snippet: str, media_index: int | None = None) -> dict:
    return {
        "name": name.strip(),
        "surface": snippet,
        "kind": kind,
        "field": field,
        "snippet": snippet,
        "post_id": post.id,
        "platform": post.platform,
        "platform_id": post.platform_id,
        "published_at": post.published_at,
        "media_index": media_index,
        "timestamp_seconds": None,
        "views": post.views,
        "extractor": "baseline-structured-surfaces-v1",
    }


def _classify(row: dict, creator_handle: str) -> dict:
    key = compact(row["name"])
    if not key:
        row.update(status="not_a_brand_candidate", needs_human_confirm=False, confirm_reason="empty")
        return row
    if key == compact(creator_handle):
        row.update(status="not_a_brand_candidate", needs_human_confirm=False, confirm_reason="self_account")
        return row
    if row["kind"] == "hashtag" and key in PLATFORM_TAGS:
        row.update(status="not_a_brand_candidate", needs_human_confirm=False, confirm_reason="platform_tag")
        return row
    if row["kind"] == "hashtag" and key in DISCLOSURE_HASHTAGS:
        row.update(status="not_a_brand_candidate", needs_human_confirm=False, confirm_reason="disclosure_tag")
        return row
    reason = "unconfirmed_hashtag" if row["kind"] == "hashtag" else "account_may_be_person"
    if row["kind"] == "caption_at":
        reason = "possible_person_or_alias"
    if key in AMBIGUOUS_NAMES:
        reason = AMBIGUOUS_NAMES[key]
    row.update(status="brand_candidate", needs_human_confirm=True, confirm_reason=reason)
    return row


def _entities(rows: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    order: list[str] = []
    for row in rows:
        if row["status"] not in ("brand_candidate", "confirmed"):
            continue
        key = compact(row["name"])
        if key not in grouped:
            grouped[key] = []
            order.append(key)
        grouped[key].append(row)
    entities = []
    for key in order:
        evidence = grouped[key]
        posts = []
        seen_posts = set()
        for row in evidence:
            if row["post_id"] in seen_posts:
                continue
            seen_posts.add(row["post_id"])
            posts.append(
                {
                    "post_id": row["post_id"],
                    "platform_id": row["platform_id"],
                    "published_at": row["published_at"],
                    "views": row["views"],
                }
            )
        statuses = {row["status"] for row in evidence}
        status = "confirmed" if statuses == {"confirmed"} else "brand_candidate"
        entities.append(
            {
                "name": evidence[0]["name"],
                "status": status,
                "needs_human_confirm": status != "confirmed",
                "confirm_reasons": sorted({row["confirm_reason"] for row in evidence}),
                "evidence_count": len(evidence),
                "matching_posts": posts,
                "views_note": "Each number is that post's viewsCount. Do not add numbers across entities, and do not treat them as unique reach.",
            }
        )
    return entities
