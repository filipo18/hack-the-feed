"""Build the creator-scoped evidence report. No CPM and no accuracy score."""

from __future__ import annotations

import json
import re
from collections import Counter

from creator_discovery.baseline import compact, extract
from creator_discovery.gmi import run_model
from creator_discovery.parse import (
    Enumeration,
    enumerate_capture,
    frame_count,
    load_captures,
    ocr_label,
    transcript_label,
)

SNIPPET_RADIUS = 42


def analyze(paths: list[str], illustrative_names: list[str] | None = None, confirmed_names: set[str] | None = None, env: dict | None = None) -> dict:
    runs = []
    for path in paths:
        for capture in load_captures(path):
            runs.append(_one_capture(capture, illustrative_names or [], confirmed_names or set(), env))
    return {
        "pilot": "creator-discovery",
        "question": "From a creator's own indexed posts, which names can a deterministic surface extract, with an exact quote, without a brand filter.",
        "live_call_made_by_this_pilot": False,
        "accuracy": None,
        "accuracy_note": "No exhaustive annotation and no unique-brand count. No precision or recall.",
        "runs": runs,
        "experiments": _experiments(runs),
        "not_used": [
            "The earlier Ryanair cross-creator sample is not an input. It searched a known brand across many creators. It is not creator enumeration and not blind brand discovery.",
        ],
    }


def _one_capture(capture: dict, names: list[str], confirmed_names: set[str], env: dict | None) -> dict:
    enumeration = enumerate_capture(capture)
    baseline = extract(enumeration, confirmed_names)
    posts = [_post_row(post) for post in enumeration.posts]
    media_transcript = Counter()
    media_ocr = Counter()
    frames = 0
    redacted_frames = 0
    for post in enumeration.posts:
        frames += frame_count(post)
        for media in post.media:
            media_transcript[media.transcript_state] += 1
            media_ocr[media.ocr_state] += 1
            redacted_frames += media.redacted_frames
    stored_removed = enumeration.sanitization_note.get("on_screen_text_strings_removed")
    grounding = [_ground(enumeration, name, baseline) for name in names]
    model = run_model(enumeration.posts, env=env)
    safe_model = {key: value for key, value in model.items() if key != "headers"}
    pagination = enumeration.pagination or {}
    total = pagination.get("totalCount")
    returned = len(enumeration.posts)
    return {
        "kind": enumeration.kind,
        "handle": enumeration.handle,
        "platform": enumeration.platform,
        "creator_only_request": enumeration.creator_only,
        "brand_filter": enumeration.brand_filter,
        "http_status": enumeration.http_status,
        "pagination": pagination,
        "returned_posts": returned,
        "unique_platform_ids": len({post.platform_id for post in enumeration.posts}),
        "coverage": _coverage(total, returned),
        "dropped": [dropped.__dict__ for dropped in enumeration.dropped],
        "posts": posts,
        "media_transcript_states": dict(sorted(media_transcript.items())),
        "media_ocr_states": dict(sorted(media_ocr.items())),
        "frame_count": frames,
        "redacted_frame_placeholders": redacted_frames,
        "posts_with_frames": sum(1 for post in enumeration.posts if frame_count(post) > 0),
        "posts_with_nonempty_transcript": sum(1 for row in posts if row["transcript"] == "present"),
        "posts_with_nonempty_ocr": sum(1 for row in posts if row["ocr"] == "present"),
        "views": _views(posts),
        "baseline": baseline,
        "supplied_string_check": {
            "role": "Strings supplied by the caller. Not a discovery pass, not a gazetteer, and not ground truth.",
            "names": grounding,
        },
        "model": safe_model,
        "vision": {
            "experiment": "not_run",
            "frame_count": frames,
            "design": (
                "A later pass can sample frames, propose a name, and keep it unconfirmed until the same "
                "name is an exact quote in text or a person confirms that frame. visualSimilarity searches "
                "a known asset. It is not an unknown-logo detector. This run did not fetch frames or call a vision model."
            ),
        },
        "ocr_strings_redacted_while_parsing": enumeration.ocr_strings_redacted,
        "stored_sanitization": enumeration.sanitization_note,
        "card_ocr_strings_removed_before_storage": stored_removed,
    }


def _post_row(post) -> dict:
    return {
        "post_id": post.id,
        "platform": post.platform,
        "platform_id": post.platform_id,
        "handle": post.handle,
        "published_at": post.published_at,
        "views": post.views,
        "transcript": transcript_label(post),
        "ocr": ocr_label(post),
        "frames": frame_count(post),
        "media_transcript_states": [media.transcript_state for media in post.media],
        "media_ocr_states": [media.ocr_state for media in post.media],
    }


def _coverage(total, returned: int) -> dict:
    if not isinstance(total, (int, float)) or isinstance(total, bool):
        return {
            "indexed_total_count": None,
            "returned_posts": returned,
            "page_covers_indexed_total": None,
            "note": "No pagination.totalCount on this capture. The rows are not a whole history.",
        }
    return {
        "indexed_total_count": total,
        "returned_posts": returned,
        "page_covers_indexed_total": returned >= total,
        "note": (
            "totalCount is the count on this contents-search response. "
            "The public search help describes a recent index window, a follower floor, and indexing lag. "
            "Those rules are not restated here as measured facts. This page is not the creator's whole history, "
            "and the index is not an on-demand ingest of every post."
        ),
    }


def _views(posts: list[dict]) -> dict:
    known = [post["views"] for post in posts if isinstance(post["views"], (int, float)) and not isinstance(post["views"], bool)]
    missing = [post["platform_id"] for post in posts if post["views"] is None]
    return {
        "per_post": [{"platform_id": post["platform_id"], "views": post["views"]} for post in posts],
        "posts_with_null_views": missing,
        "sum_of_non_null_views_on_returned_posts": sum(known) if known else None,
        "sum_note": "Sum of viewsCount on returned posts that have a number. Not unique reach, not a lifetime total, and not a valuation.",
    }


def _ground(enumeration: Enumeration, name: str, baseline: dict) -> dict:
    hits = []
    for post in enumeration.posts:
        fields = []
        example = None
        pattern = re.compile(rf"(?<![A-Za-z0-9]){re.escape(name)}(?![A-Za-z0-9])", re.IGNORECASE)
        for row in _search_rows(post):
            match = pattern.search(row["text"])
            if not match:
                continue
            fields.append(row["field"])
            candidate = {
                "post_id": post.id,
                "platform_id": post.platform_id,
                "published_at": post.published_at,
                "views": post.views,
                "field": row["field"],
                "media_index": row["media_index"],
                "timestamp_seconds": row["timestamp_seconds"],
                "exact_quote": row["text"][match.start() : match.end()],
                "snippet": _snippet(row["text"], match.start(), match.end()),
            }
            if example is None or _rank(row["field"]) < _rank(example["field"]):
                example = candidate
        if fields:
            hits.append(
                {
                    "platform_id": post.platform_id,
                    "views": post.views,
                    "fields": sorted(set(fields)),
                    "example": example,
                }
            )
    overlap = any(compact(name) == compact(row["name"]) for row in baseline["evidence"] if row["status"] in ("brand_candidate", "confirmed"))
    return {
        "name": name,
        "exact_substring_found": bool(hits),
        "baseline_emitted_same_name": overlap,
        "occurrences": hits,
    }


def _search_rows(post) -> list[dict]:
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
            rows.append({"field": "media_tag", "media_index": media.index, "timestamp_seconds": None, "text": handle})
        if media.transcript:
            rows.append({"field": "transcript", "media_index": media.index, "timestamp_seconds": None, "text": media.transcript})
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
            rows.append({"field": "on_screen_text", "media_index": media.index, "timestamp_seconds": None, "text": text})
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


def _rank(field: str) -> int:
    order = ["caption", "title", "hashtag", "mention", "coauthor", "media_tag", "transcript_chunk", "transcript", "on_screen_text", "frame_ocr"]
    return order.index(field) if field in order else 99


def _snippet(text: str, start: int, end: int) -> str:
    left = max(0, start - SNIPPET_RADIUS)
    right = min(len(text), end + SNIPPET_RADIUS)
    chunk = " ".join(text[left:right].split())
    prefix = "..." if left else ""
    suffix = "..." if right < len(text) else ""
    return prefix + chunk + suffix


def _experiments(runs: list[dict]) -> dict:
    pending = [
        {
            "id": "gmi_inference",
            "status": "unrun",
            "reason": "GMI_API_KEY and GMI_MODEL were read from the environment passed to this process. A missing value leaves the model unrun. This pilot also refuses to send, so a present key would still not be a result. No accuracy is filled in.",
        },
        {
            "id": "vision_frame_model",
            "status": "not_run",
            "reason": "Frame URLs were not fetched. No vision model ran. visualSimilarity was not used.",
        },
        {
            "id": "exhaustive_human_gold",
            "status": "not_available",
            "reason": "Partial manual notes are not an exhaustive brand list. This report does not score the baseline against them.",
        },
        {
            "id": "remaining_indexed_pages",
            "status": "not_run",
            "reason": "Captures here are the first page only. Later offsets were not requested by this pilot.",
        },
        {
            "id": "production_creator_route",
            "status": "not_added",
            "reason": "No backend or frontend route was added. Integration is a later decision.",
        },
    ]
    ran = []
    for run in runs:
        ran.append(
            {
                "id": "parse_and_baseline",
                "handle": run["handle"],
                "platform": run["platform"],
                "returned_posts": run["returned_posts"],
                "creator_only_request": run["creator_only_request"],
                "baseline_candidates": len(run["baseline"]["entities"]),
                "model_experiment": run["model"]["experiment"],
            }
        )
    if any(run["supplied_string_check"]["names"] for run in runs):
        ran.append(
            {
                "id": "supplied_string_quote_check",
                "role": "Checks caller-supplied strings for an exact substring. Does not propose names and does not score accuracy.",
            }
        )
    return {"ran": ran, "pending": pending}


def render_text(report: dict) -> str:
    lines = [
        "Creator discovery pilot",
        "This run reads captured content-search JSON. It does not call Oriane or GMI.",
        "Accuracy is not reported. There is no exhaustive ground truth.",
        "",
    ]
    for run in report["runs"]:
        lines.append(f"Creator {run['handle']} on {run['platform']}")
        lines.append(
            f"  creator-only brand_filter={run['brand_filter']!r} http={run['http_status']} "
            f"returned={run['returned_posts']} indexed_total={run['coverage']['indexed_total_count']} "
            f"page_covers_indexed_total={run['coverage']['page_covers_indexed_total']}"
        )
        lines.append(
            f"  posts with nonempty transcript={run['posts_with_nonempty_transcript']} "
            f"nonempty OCR={run['posts_with_nonempty_ocr']} frames present on posts={run['posts_with_frames']} "
            f"frame_count={run['frame_count']}"
        )
        lines.append(f"  media transcript states {run['media_transcript_states']}")
        lines.append(f"  media OCR states {run['media_ocr_states']}")
        lines.append(f"  dropped rows {len(run['dropped'])}")
        if run["card_ocr_strings_removed_before_storage"]:
            lines.append(
                f"  membership-card on-screen strings removed before this file was stored: {run['card_ocr_strings_removed_before_storage']}"
            )
        lines.append("  posts:")
        for post in run["posts"]:
            lines.append(
                f"    {post['platform_id']} views={post['views']} transcript={post['transcript']} "
                f"ocr={post['ocr']} frames={post['frames']} published={post['published_at']}"
            )
        lines.append("  disclosure:")
        for item in run["baseline"]["disclosures"]:
            codes = ",".join(signal["code"] for signal in item["signals"]) or "none"
            lines.append(f"    {item['platform_id']} {item['state']} signals={codes}")
        lines.append("  baseline candidates (unconfirmed unless a human file said so):")
        if not run["baseline"]["entities"]:
            lines.append("    none")
        for entity in run["baseline"]["entities"]:
            post_bits = ", ".join(
                f"{item['platform_id']} views={item['views']}" for item in entity["matching_posts"]
            )
            lines.append(
                f"    {entity['name']} status={entity['status']} reasons={','.join(entity['confirm_reasons'])} posts=[{post_bits}]"
            )
        lines.append("  baseline evidence:")
        for row in run["baseline"]["evidence"]:
            if row["status"] not in ("brand_candidate", "confirmed"):
                continue
            lines.append(
                f"    {row['platform_id']} {row['field']} {row['snippet']!r} status={row['status']} views={row['views']}"
            )
        lines.append("  surfaces that are not brand candidates:")
        for row in run["baseline"]["not_brand_surfaces"]:
            lines.append(f"    {row['platform_id']} {row['snippet']!r} reason={row['confirm_reason']}")
        if run["supplied_string_check"]["names"]:
            lines.append("  supplied strings (not discovered by the baseline, not a score):")
            for item in run["supplied_string_check"]["names"]:
                if not item["exact_substring_found"]:
                    lines.append(f"    {item['name']}: no exact substring in this creator's returned posts")
                    continue
                fields = sorted({field for hit in item["occurrences"] for field in hit["fields"]})
                example = next((hit["example"] for hit in item["occurrences"] if hit.get("example")), None)
                snippet = example["snippet"] if example else ""
                where = example["field"] if example else ""
                timestamp = example["timestamp_seconds"] if example else None
                lines.append(
                    f"    {item['name']}: grounded fields={fields} baseline_same_name={item['baseline_emitted_same_name']} "
                    f"example_field={where} t={timestamp} snippet={snippet!r}"
                )
        lines.append(
            f"  model experiment={run['model']['experiment']} reason={run['model'].get('reason')} accuracy=None"
        )
        lines.append("  vision experiment=not_run")
        lines.append(
            f"  non-null view sum on returned posts={run['views']['sum_of_non_null_views_on_returned_posts']} "
            f"null views={run['views']['posts_with_null_views']}"
        )
        lines.append("")
    lines.append("Pending: GMI inference, vision, exhaustive annotation, later index pages, production integration.")
    lines.append(report["not_used"][0])
    return "\n".join(lines) + "\n"


def render_findings(report: dict) -> str:
    """Short findings note. Numbers come from the report dict."""
    lines = [
        "# Creator discovery pilot findings",
        "",
        "This file is the output of `python3 -m creator_discovery` on the captures in this directory.",
        "The process did not call Oriane and did not call GMI. It did not add a backend or frontend route.",
        "",
        "The earlier Ryanair cross-creator sample was not loaded. That sample starts from a known brand. These captures do not.",
        "",
        "No accuracy, precision, or recall is stated. The supplied-string section is a quote check of names passed in by the caller. It is not a list of every brand and it is not ground truth.",
        "",
        "## What ran",
        "",
    ]
    for run in report["runs"]:
        lines.append(
            f"- `{run['handle']}` on `{run['platform']}`: brand_filter `{run['brand_filter']}`, HTTP {run['http_status']}, "
            f"{run['returned_posts']} returned posts, indexed totalCount {run['coverage']['indexed_total_count']}, "
            f"page covers that total: {run['coverage']['page_covers_indexed_total']}."
        )
        lines.append(
            f"  Nonempty transcript posts: {run['posts_with_nonempty_transcript']}. "
            f"Nonempty OCR posts: {run['posts_with_nonempty_ocr']}. "
            f"Posts with frames: {run['posts_with_frames']}. Frame count: {run['frame_count']}."
        )
        lines.append(f"  Media transcript states: `{run['media_transcript_states']}`. Media OCR states: `{run['media_ocr_states']}`.")
        if run.get("redacted_frame_placeholders"):
            lines.append(
                f"  Frame objects with an id: {run['frame_count']}. Placeholder frame objects skipped: {run['redacted_frame_placeholders']}."
            )
        lines.append(f"  Rows dropped for author, platform, or duplicate id: {len(run['dropped'])}.")
        removed = run.get("card_ocr_strings_removed_before_storage")
        if removed:
            lines.append(
                f"  The stored capture records {removed} on-screen-text strings removed before commit because they matched a membership-card pattern. Frame-region text in this file did not match that pattern. Those strings are not quoted below."
            )
        lines.append("  Baseline candidates:")
        if not run["baseline"]["entities"]:
            lines.append("  - none")
        for entity in run["baseline"]["entities"]:
            posts = ", ".join(f"{item['platform_id']} (views {item['views']})" for item in entity["matching_posts"])
            lines.append(
                f"  - `{entity['name']}` is `{entity['status']}` ({', '.join(entity['confirm_reasons'])}) on {posts}."
            )
        missed = [
            item["name"]
            for item in run["supplied_string_check"]["names"]
            if item["exact_substring_found"] and not item["baseline_emitted_same_name"]
        ]
        absent = [
            item["name"]
            for item in run["supplied_string_check"]["names"]
            if not item["exact_substring_found"]
        ]
        if run["supplied_string_check"]["names"]:
            lines.append(
                f"  Supplied strings with an exact quote that the baseline did not emit as the same name: {', '.join(missed) if missed else 'none'}."
            )
            lines.append(
                f"  Supplied strings with no exact substring on this creator's returned posts: {', '.join(absent) if absent else 'none'}."
            )
        null_views = run["views"]["posts_with_null_views"]
        if null_views:
            lines.append(f"  Null viewsCount on returned posts: {', '.join(null_views)}.")
        else:
            lines.append("  Every returned post has a viewsCount.")
        lines.append(
            f"  Sum of non-null viewsCount on this page: {run['views']['sum_of_non_null_views_on_returned_posts']}. {run['views']['sum_note']}"
        )
        lines.append(f"  Model experiment: {run['model']['experiment']}. {run['model'].get('reason')}")
        lines.append("")
    transcript_totals: dict[str, int] = {}
    ocr_totals: dict[str, int] = {}
    for run in report["runs"]:
        for key, value in run["media_transcript_states"].items():
            transcript_totals[key] = transcript_totals.get(key, 0) + value
        for key, value in run["media_ocr_states"].items():
            ocr_totals[key] = ocr_totals.get(key, 0) + value
    if report["runs"]:
        lines.append(
            "Across these pages: "
            f"{sum(run['returned_posts'] for run in report['runs'])} posts, "
            f"{sum(run['posts_with_nonempty_transcript'] for run in report['runs'])} with a nonempty transcript, "
            f"{sum(run['posts_with_nonempty_ocr'] for run in report['runs'])} with nonempty OCR, "
            f"{sum(run['posts_with_frames'] for run in report['runs'])} with frames, "
            f"{sum(run['frame_count'] for run in report['runs'])} frame objects with an id. "
            f"Media transcript states {transcript_totals}. Media OCR states {ocr_totals}."
        )
        lines.append("")
    lines.extend(
        [
            "## Grounded strings the baseline did not emit",
            "",
            "Each line is a bounded exact substring from the caller-supplied list. The baseline did not emit that same name. This is not a complete brand list.",
            "",
        ]
    )
    seen_examples = set()
    for run in report["runs"]:
        for item in run["supplied_string_check"]["names"]:
            if not item["exact_substring_found"] or item["baseline_emitted_same_name"]:
                continue
            example = next((hit["example"] for hit in item["occurrences"] if hit.get("example")), None)
            if not example:
                continue
            key = (item["name"], example["platform_id"], example["field"])
            if key in seen_examples:
                continue
            seen_examples.add(key)
            lines.append(
                f"- `{item['name']}` on `{example['platform_id']}` views {example['views']}, field `{example['field']}`, "
                f"timestamp {example['timestamp_seconds']}: {example['snippet']}"
            )
    missing_everywhere = []
    if report["runs"]:
        for item in report["runs"][0]["supplied_string_check"]["names"]:
            found = False
            for run in report["runs"]:
                match = next(row for row in run["supplied_string_check"]["names"] if row["name"] == item["name"])
                found = found or match["exact_substring_found"]
            if not found:
                missing_everywhere.append(item["name"])
    lines.append("")
    if missing_everywhere:
        lines.append(
            "Supplied strings with no bounded exact substring on either returned page: "
            + ", ".join(missing_everywhere)
            + ". A glued OCR spelling is not counted, and a miss here is not a claim that the letters are absent in some other form."
        )
        lines.append("")
    lines.extend(
        [
            "## What this does not show",
            "",
            "- The baseline does not find brands that are only written in a caption sentence, spoken, or burned into a frame. Those strings stay out until a model quote survives the exact-substring check or a person confirms a frame.",
            "- A grounded supplied string is evidence the letters occur. It is not a confirmed brand, a paid deal, or a complete inventory.",
            "- Empty, null, and missing transcripts are different field states. None of them means the video has no brand.",
            "- Disclosure on a post is `disclosed` or `unknown`. Invitation language is a signal. It is not payment proof. A negation does not create an unpaid label.",
            "- Views are the post `viewsCount` on matching returned posts. They are not added across names, not unique reach, and not a price.",
            "- HTTP 206 and a totalCount larger than the page both mean this file is not the rest of the index. The help-center window, follower floor, and lag were not re-measured here.",
            "- Five frames were inspected by the research notes that accompanied the capture. This process did not open those images and did not run a vision model.",
            "- The partial manual annotations described with the capture are not loaded as a 32-row gold set. They were not in the capture file.",
            "- Unit tests on `fixtures/synthetic_creator_posts.json` cover a mixed author and platform, a duplicate platform id, null versus missing versus empty transcript, a person/brand homonym, a disclosure tag, a negation that stays unknown, and a model quote that cannot confirm a name or set a payment label. Those rows are synthetic.",
            "",
            "## Pending",
            "",
        ]
    )
    for item in report["experiments"]["pending"]:
        lines.append(f"- `{item['id']}`: {item['reason']}")
    lines.append("")
    return "\n".join(lines)


def dump_report(report: dict) -> str:
    return json.dumps(report, indent=2, ensure_ascii=False) + "\n"
