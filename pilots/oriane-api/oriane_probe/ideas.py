"""Hackathon alternatives whose cited fields must exist on the pinned schema.

Ranks are a documentation judgment for a 3.5 hour, two-person build.
They are not measured scores and they are not live-index proof.
"""

from __future__ import annotations

from oriane_probe.snapshot import schema

ALTERNATIVES = (
    {
        "rank": 1,
        "slug": "beside-the-caption",
        "title": "Beside the Caption",
        "recommended": True,
        "documented_calls": [
            "POST /rest/profiles/search",
            "POST /rest/contents/search projection=default limit=5",
            "POST /rest/contents/search projection=full limit=1 by content id",
        ],
        "schema_properties": (
            ("SearchProfilesRequest.Filters.Body", "handle"),
            ("SearchContentsRequest.Filters.Body", "profileHandle"),
            ("SearchContentsRequest.Filters.Body", "id"),
            ("SearchContentsRequest.Filters.Body", "platform"),
            ("SearchContentsResponse.BasicResult.Body", "viewsCount"),
            ("SearchContentsResponse.DefaultMedia.Body", "caption"),
            ("SearchContentsResponse.DefaultMedia.Body", "transcript"),
            ("SearchContentsResponse.DefaultMedia.Body", "onScreenText"),
            ("SearchContentsResponse.FullMedia.Body", "transcriptChunks"),
            ("SearchContentsResponse.FullMedia.Body", "frames"),
            ("SearchContentsResponse.TranscriptChunk.Body", "startSeconds"),
            ("SearchContentsResponse.TranscriptChunk.Body", "endSeconds"),
            ("SearchContentsResponse.TranscriptChunk.Body", "text"),
            ("SearchContentsResponse.Frame.Body", "timestampSeconds"),
            ("SearchContentsResponse.Frame.Body", "url"),
            ("SearchContentsResponse.Frame.Body", "onScreenTextRegions"),
            ("SearchContentsResponse.FullResult.Body", "thumbnailMediaUrl"),
            ("SearchContentsResponse.FullResult.Body", "platformId"),
        ),
    },
    {
        "rank": 2,
        "slug": "untagged-in-the-transcript",
        "title": "Untagged in the Transcript",
        "recommended": False,
        "documented_calls": [
            "POST /rest/contents/search transcript includesExactly, profileHandle excludesExactly, mentionHandles excludesExactly, projection=full, limit=5",
        ],
        "schema_properties": (
            ("SearchContentsRequest.Filters.Body", "transcript"),
            ("SearchContentsRequest.Filters.Body", "profileHandle"),
            ("SearchContentsRequest.Filters.Body", "mentionHandles"),
            ("SearchContentsResponse.FullMedia.Body", "transcriptChunks"),
            ("SearchContentsResponse.Frame.Body", "timestampSeconds"),
            ("SearchContentsResponse.Mention.Body", "profileHandle"),
        ),
    },
    {
        "rank": 3,
        "slug": "frame-echo",
        "title": "Frame Echo",
        "recommended": False,
        "documented_calls": [
            "POST /rest/assets",
            "POST /rest/contents/search visualSimilarity, sort=visualSimilarity, projection=full",
        ],
        "schema_properties": (
            ("CreateAssetRequest.TextBody", "text"),
            ("CreateAssetResponse.Body", "id"),
            ("SearchContentsRequest.Filters.Body", "visualSimilarity"),
            ("SearchContentsResponse.Frame.Body", "visualSimilarityScore"),
            ("SearchContentsResponse.Frame.Body", "url"),
        ),
    },
)

REJECTED_STANDALONE = (
    {
        "slug": "who-owes-you",
        "title": "Who Owes You",
        "reason": (
            "Creator-scoped search, viewsCount, and thumbnails are real schema fields. "
            "A brand ledger and an unpaid-versus-paid flag are not. Open-ended brand naming "
            "would be a second model on top of caption, transcript, and unlabeled frames."
        ),
    },
    {
        "slug": "did-they-actually-say-that",
        "title": "Did They Actually Say That?",
        "reason": (
            "Timed transcript chunks are a strong primitive and should stay inside Beside the Caption. "
            "A yes/no quote checker is the weak product: transcript null has no documented meaning of "
            "'not said', fuzzy match is defined as partial-word match, and there is still no post URL "
            "to open the moment. A stage demo also dies when the exact sentence is outside the index."
        ),
    },
)


def assert_citations(spec: dict) -> list[str]:
    """Return cited property paths. Raise if a citation is not in the snapshot."""
    cited: list[str] = []
    recommended = [idea for idea in ALTERNATIVES if idea["recommended"]]
    if len(recommended) != 1 or recommended[0]["rank"] != 1:
        raise AssertionError("Exactly one alternative is recommended, and it is rank 1.")
    ranks = [idea["rank"] for idea in ALTERNATIVES]
    if ranks != [1, 2, 3]:
        raise AssertionError("Alternatives must stay ranked 1, 2, 3.")
    for idea in ALTERNATIVES:
        for schema_name, property_name in idea["schema_properties"]:
            properties = schema(spec, schema_name)["properties"]
            if property_name not in properties:
                raise KeyError(f"{idea['slug']} cites missing {schema_name}.{property_name}")
            cited.append(f"{schema_name}.{property_name}")
    return cited
