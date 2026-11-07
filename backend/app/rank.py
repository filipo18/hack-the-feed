"""Dedup, disclosure, creator grouping, and the reach sort.

Rank is the sum of views on distinct relevant posts in this retrieved sample.
A single relevant post qualifies. Missing views stay null. Disclosure is
disclosed or unknown, never unpaid.
"""

from __future__ import annotations

import re

DISCLOSURE_TAGS = {
    "ad",
    "sponsored",
    "paidpartnership",
    "paidpartner",
    "advertisement",
    "paidpromotion",
}
DISCLOSURE_PHRASES = (
    "paid partnership",
    "paid promotion",
    "sponsored by",
    "includes paid promotion",
    "this is an ad",
    "this is a paid ad",
    "collaboration commerciale",
    "commercial collaboration",
)
HOLDOUT_PRIORITY = (
    "owned_account",
    "asr_false_positive",
    "complaint",
    "repost",
    "incidental",
    "irrelevant",
    "uncertain",
)
_TAG = re.compile(r"#([\w]+)", re.UNICODE)
_WORD = re.compile(r"[\w]+", re.UNICODE)


def disclosure_for(*parts: str | None) -> str:
    tags: set[str] = set()
    blob: list[str] = []
    for part in parts:
        if not part:
            continue
        blob.append(part)
        tags.update(match.group(1).casefold() for match in _TAG.finditer(part))
        bare = part.strip().lstrip("#").casefold()
        if bare in DISCLOSURE_TAGS:
            tags.add(bare)
    if tags & DISCLOSURE_TAGS:
        return "disclosed"
    text = "\n".join(blob).casefold()
    if any(phrase in text for phrase in DISCLOSURE_PHRASES):
        return "disclosed"
    return "unknown"


def term_in_text(text: str | None, terms: list[str]) -> bool:
    if not text:
        return False
    words = {match.group(0).casefold() for match in _WORD.finditer(text)}
    phrases = text.casefold()
    for term in terms:
        if " " in term:
            if term in phrases:
                return True
        elif term in words:
            return True
    return False


def evidence_labels(row: dict, terms: list[str], channel: str) -> list[str]:
    labels: list[str] = []
    caption = row.get("caption") if isinstance(row.get("caption"), str) else None
    if term_in_text(caption, terms):
        labels.append("caption")
    hashtags = _strings(row.get("hashtags"))
    if any(term_in_text(tag, terms) or tag.lstrip("#").casefold() in terms for tag in hashtags):
        labels.append("hashtag")
    mentions = _mention_handles(row.get("mentions"))
    if any(handle.casefold() in terms for handle in mentions):
        labels.append("mention")
    transcript_bits, screen_bits = _media_text(row.get("media"))
    if any(term_in_text(bit, terms) for bit in transcript_bits):
        labels.append("transcript")
    if any(term_in_text(bit, terms) for bit in screen_bits):
        labels.append("ocr")
    if channel == "visual":
        labels.append("visual")
    return labels


def project_post(row: dict, channel: str, terms: list[str]) -> dict | None:
    platform = row.get("platform")
    platform_id = row.get("platformId")
    if platform not in {"instagram", "tiktok", "youtube"} or not isinstance(platform_id, str) or not platform_id:
        return None
    handle = row.get("profileHandle") if isinstance(row.get("profileHandle"), str) else ""
    creator_id = row.get("profilePlatformId") if isinstance(row.get("profilePlatformId"), str) else None
    profile_id = row.get("profileId") if isinstance(row.get("profileId"), str) else None
    views_count = _whole_number(row.get("viewsCount"))
    caption = row.get("caption") if isinstance(row.get("caption"), str) else None
    hashtags = _strings(row.get("hashtags"))
    mentions = _mentions(row.get("mentions"))
    media = _media(row.get("media"))
    text_parts = [caption, *hashtags, *(_transcript_and_screen(media))]
    return {
        "postKey": f"{platform}:{platform_id}",
        "id": row.get("id") if isinstance(row.get("id"), str) else None,
        "platform": platform,
        "platformId": platform_id,
        "handle": handle,
        "creatorId": creator_id,
        "profileId": profile_id,
        "viewsCount": views_count,
        "viewsConflict": False,
        "publishedAt": row.get("publishedAt") if isinstance(row.get("publishedAt"), str) else None,
        # Captured Instagram rows carry the public shortcode as platformId.
        # Numeric IDs and other platforms need their own verified mapping.
        "canonicalPostUrl": (
            f"https://www.instagram.com/p/{platform_id}/"
            if platform == "instagram"
            and re.fullmatch(r"[A-Za-z0-9_-]{11}", platform_id)
            and not platform_id.isdecimal()
            else None
        ),
        "paidPartnership": "not_in_oriane_schema",
        "retrievedBy": [channel],
        "evidenceLabels": evidence_labels(row, terms, channel),
        "disclosure": disclosure_for(*text_parts),
        "caption": caption,
        "hashtags": hashtags,
        "mentions": mentions,
        "media": media,
        "visualScores": _visual_scores(row) if channel == "visual" else [],
    }


def dedup_posts(posts: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for post in posts:
        current = merged.get(post["postKey"])
        if current is None:
            merged[post["postKey"]] = post
            continue
        current["retrievedBy"] = _union(current["retrievedBy"], post["retrievedBy"])
        current["evidenceLabels"] = _union(current["evidenceLabels"], post["evidenceLabels"])
        current["visualScores"] = _union_numbers(current["visualScores"], post["visualScores"])
        if post["disclosure"] == "disclosed":
            current["disclosure"] = "disclosed"
        if current["viewsCount"] != post["viewsCount"]:
            if current["viewsCount"] is None:
                current["viewsCount"] = post["viewsCount"]
            elif post["viewsCount"] is not None:
                current["viewsCount"] = None
                current["viewsConflict"] = True
        if _media_weight(post) > _media_weight(current):
            current["media"] = post["media"]
            current["caption"] = post["caption"] or current["caption"]
        if not current["creatorId"] and post["creatorId"]:
            current["creatorId"] = post["creatorId"]
        if not current["handle"] and post["handle"]:
            current["handle"] = post["handle"]
        if not current["id"] and post["id"]:
            current["id"] = post["id"]
    return list(merged.values())


def creator_key(post: dict) -> str:
    if post.get("creatorId"):
        return f"{post['platform']}:{post['creatorId']}"
    handle = (post.get("handle") or "").casefold()
    return f"{post['platform']}:handle:{handle}"


def group_creators(posts: list[dict]) -> list[dict]:
    grouped: dict[str, dict] = {}
    for post in posts:
        key = creator_key(post)
        creator = grouped.get(key)
        if creator is None:
            grouped[key] = {
                "creatorKey": key,
                "platform": post["platform"],
                "creatorId": post.get("creatorId"),
                "profileId": post.get("profileId"),
                "handle": post.get("handle") or "",
                "posts": [post],
            }
            continue
        creator["posts"].append(post)
        if not creator["creatorId"] and post.get("creatorId"):
            creator["creatorId"] = post["creatorId"]
        if not creator["handle"] and post.get("handle"):
            creator["handle"] = post["handle"]
    return list(grouped.values())


def handle_is_brand(handle: str, terms: list[str]) -> bool:
    cleaned = handle.strip().lstrip("@").casefold()
    return bool(cleaned) and cleaned in terms


def apply_judgments(
    creators: list[dict],
    judgments: dict[str, dict] | None,
    terms: list[str],
) -> dict:
    """Split creators into ranked, held-out, and unassessed lists."""
    ranked: list[dict] = []
    held: list[dict] = []
    pending: list[dict] = []
    model_ok = judgments is not None
    for creator in creators:
        owned = handle_is_brand(creator["handle"], terms)
        assessed_posts = []
        whys: list[tuple[float, str]] = []
        any_pending = False
        for post in creator["posts"]:
            judgment = None if judgments is None else judgments.get(post["postKey"])
            if owned:
                post_out = _annotate(
                    post,
                    verdict="irrelevant",
                    holdout="owned_account",
                    reach=False,
                    assessment="complete" if model_ok else "pending",
                )
                post_out["judgmentSource"] = "rule"
                assessed_posts.append(post_out)
                if judgment and judgment.get("why"):
                    whys.append((_views_sort(post), judgment["why"]))
                continue
            if judgment is None:
                any_pending = True
                post_out = _annotate(post, verdict=None, holdout=None, reach=False, assessment="pending")
                post_out["judgmentSource"] = "pending"
                assessed_posts.append(post_out)
                continue
            holdout = judgment["holdout"]
            verdict = judgment["verdict"]
            reach = verdict == "relevant" and holdout is None
            post_out = _annotate(post, verdict=verdict, holdout=holdout, reach=reach, assessment="complete")
            post_out["judgmentSource"] = "model"
            post_out["context"] = judgment.get("context", "unknown")
            post_out["why"] = judgment["why"]
            assessed_posts.append(post_out)
            whys.append((_views_sort(post), judgment["why"]))
        built = _creator_shell(creator, assessed_posts, whys)
        if owned:
            built["holdoutReason"] = "owned_account"
            built["partnershipEligible"] = False
            built["judgmentSource"] = "rule"
            built["assessment"] = "complete" if model_ok else "pending"
            if model_ok and whys:
                built["whySource"] = "model"
            else:
                built["why"] = None
                built["whySource"] = None
            held.append(built)
            continue
        if not model_ok or all(post["assessment"] == "pending" for post in assessed_posts):
            built["holdoutReason"] = None
            built["partnershipEligible"] = False
            built["judgmentSource"] = "pending"
            built["assessment"] = "pending"
            built["why"] = None
            built["whySource"] = None
            pending.append(built)
            continue
        if any(post["countsTowardReach"] for post in assessed_posts):
            built["holdoutReason"] = None
            built["partnershipEligible"] = True
            built["judgmentSource"] = "model"
            built["whySource"] = "model" if built["why"] else None
            if any_pending:
                built["assessment"] = "partial"
            ranked.append(built)
            continue
        built["holdoutReason"] = _holdout_reason(assessed_posts)
        built["partnershipEligible"] = False
        built["judgmentSource"] = "model"
        built["whySource"] = "model" if built["why"] else None
        held.append(built)
    return {
        "rankedCreators": sorted(ranked, key=_rank_key),
        "heldOut": sorted(held, key=lambda item: item["creatorKey"]),
        "unassessedCreators": sorted(pending, key=lambda item: item["creatorKey"]),
    }


def _annotate(post: dict, *, verdict: str | None, holdout: str | None, reach: bool, assessment: str) -> dict:
    annotated = dict(post)
    annotated["verdict"] = verdict
    annotated["holdout"] = holdout
    annotated["countsTowardReach"] = reach
    annotated["assessment"] = assessment
    annotated["context"] = "unknown"
    return annotated


def _creator_shell(creator: dict, posts: list[dict], whys: list[tuple[float, str]]) -> dict:
    reach_posts = [post for post in posts if post["countsTowardReach"]]
    known = [post["viewsCount"] for post in reach_posts if post["viewsCount"] is not None and not post["viewsConflict"]]
    missing = [post for post in reach_posts if post["viewsCount"] is None or post["viewsConflict"]]
    if reach_posts and not missing:
        sum_views: int | None = int(sum(known))
        incomplete = False
    elif known:
        sum_views = int(sum(known))
        incomplete = True
    else:
        sum_views = None
        incomplete = bool(reach_posts)
    why = max(whys, key=lambda item: item[0])[1] if whys else None
    relevant_whys = [(_views_sort(post), post["why"]) for post in reach_posts if post.get("why")]
    if relevant_whys:
        why = max(relevant_whys, key=lambda item: item[0])[1]
    disclosure = "disclosed" if any(post["disclosure"] == "disclosed" for post in posts) else "unknown"
    return {
        "creatorKey": creator["creatorKey"],
        "platform": creator["platform"],
        "creatorId": creator.get("creatorId"),
        "profileId": creator.get("profileId"),
        "handle": creator.get("handle") or "",
        "sumViews": sum_views,
        "viewsIncomplete": incomplete,
        "relevantPostCount": len(reach_posts),
        "retrievedPostCount": len(posts),
        "disclosure": disclosure,
        "partnershipEligible": False,
        "holdoutReason": None,
        "why": why,
        "whySource": None,
        "judgmentSource": "pending",
        "assessment": "complete",
        "posts": sorted(posts, key=_post_sort),
    }


def _holdout_reason(posts: list[dict]) -> str:
    present = {post["holdout"] for post in posts if post.get("holdout")}
    for reason in HOLDOUT_PRIORITY:
        if reason in present:
            return reason
    if any(post.get("verdict") == "irrelevant" for post in posts):
        return "irrelevant"
    return "uncertain"


def _rank_key(creator: dict) -> tuple:
    views = creator["sumViews"]
    if views is None:
        return (1, 0, creator["creatorKey"])
    return (0, -views, creator["creatorKey"])


def _post_sort(post: dict) -> tuple:
    views = post["viewsCount"]
    if views is None:
        return (1, 0, post["postKey"])
    return (0, -views, post["postKey"])


def _whole_number(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer() and value >= 0:
        return int(value)
    return None


def _views_sort(post: dict) -> float:
    views = post.get("viewsCount")
    if isinstance(views, (int, float)) and not isinstance(views, bool):
        return float(views)
    return -1.0


def _union(left: list[str], right: list[str]) -> list[str]:
    seen: list[str] = []
    for item in [*left, *right]:
        if item not in seen:
            seen.append(item)
    return seen


def _union_numbers(left: list, right: list) -> list:
    seen: list = []
    for item in [*left, *right]:
        if item not in seen:
            seen.append(item)
    return seen


def _strings(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _mention_handles(value: object) -> list[str]:
    return [item["profileHandle"] for item in _mentions(value) if item.get("profileHandle")]


def _mentions(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    mentions = []
    for item in value:
        if not isinstance(item, dict):
            continue
        handle = item.get("profileHandle")
        mentions.append(
            {
                "profileHandle": handle if isinstance(handle, str) else None,
                "platformId": item.get("platformId") if isinstance(item.get("platformId"), str) else None,
                "id": item.get("id") if isinstance(item.get("id"), str) else None,
            }
        )
    return mentions


def _media(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    projected = []
    for media in value:
        if not isinstance(media, dict):
            continue
        chunks = []
        for chunk in (media.get("transcriptChunks") or [])[:20]:
            if not isinstance(chunk, dict):
                continue
            chunks.append(
                {
                    "startSeconds": chunk.get("startSeconds"),
                    "endSeconds": chunk.get("endSeconds"),
                    "text": chunk.get("text") if isinstance(chunk.get("text"), str) else None,
                }
            )
        frames = []
        raw_frames = media.get("frames") or []
        truncated = len(raw_frames) > 30
        for frame in raw_frames[:30]:
            if not isinstance(frame, dict):
                continue
            regions = []
            for region in frame.get("onScreenTextRegions") or []:
                if isinstance(region, dict) and isinstance(region.get("text"), str):
                    regions.append({"text": region["text"]})
            item = {
                "timestampSeconds": frame.get("timestampSeconds"),
                "url": frame.get("url") if isinstance(frame.get("url"), str) else None,
                "onScreenTextRegions": regions,
            }
            score = frame.get("visualSimilarityScore")
            if isinstance(score, (int, float)) and not isinstance(score, bool):
                item["visualSimilarityScore"] = score
            frames.append(item)
        transcript = media.get("transcript") if isinstance(media.get("transcript"), str) else None
        if transcript and len(transcript) > 2000:
            transcript = transcript[:1999].rstrip() + "…"
        projected.append(
            {
                "transcript": transcript,
                "transcriptChunks": chunks,
                "onScreenText": _strings(media.get("onScreenText"))[:40],
                "frames": frames,
                "framesTruncated": truncated,
            }
        )
    return projected


def _media_text(value: object) -> tuple[list[str], list[str]]:
    transcript: list[str] = []
    screen: list[str] = []
    if not isinstance(value, list):
        return transcript, screen
    for media in value:
        if not isinstance(media, dict):
            continue
        if isinstance(media.get("transcript"), str):
            transcript.append(media["transcript"])
        for chunk in media.get("transcriptChunks") or []:
            if isinstance(chunk, dict) and isinstance(chunk.get("text"), str):
                transcript.append(chunk["text"])
        screen.extend(_strings(media.get("onScreenText")))
        for frame in media.get("frames") or []:
            if not isinstance(frame, dict):
                continue
            for region in frame.get("onScreenTextRegions") or []:
                if isinstance(region, dict) and isinstance(region.get("text"), str):
                    screen.append(region["text"])
    return transcript, screen


def _transcript_and_screen(media: list[dict]) -> list[str]:
    parts: list[str] = []
    for item in media:
        if item.get("transcript"):
            parts.append(item["transcript"])
        for chunk in item.get("transcriptChunks") or []:
            if chunk.get("text"):
                parts.append(chunk["text"])
        parts.extend(item.get("onScreenText") or [])
        for frame in item.get("frames") or []:
            for region in frame.get("onScreenTextRegions") or []:
                if region.get("text"):
                    parts.append(region["text"])
    return parts


def _visual_scores(row: dict) -> list[float]:
    scores: list[float] = []
    for media in row.get("media") or []:
        if not isinstance(media, dict):
            continue
        for frame in media.get("frames") or []:
            if not isinstance(frame, dict):
                continue
            score = frame.get("visualSimilarityScore")
            if isinstance(score, (int, float)) and not isinstance(score, bool):
                scores.append(float(score))
    return scores


def _media_weight(post: dict) -> int:
    weight = 0
    for media in post.get("media") or []:
        weight += len(media.get("transcript") or "")
        weight += 50 * len(media.get("frames") or [])
    return weight
