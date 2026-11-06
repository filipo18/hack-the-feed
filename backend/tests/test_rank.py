import json
from pathlib import Path

from app.gmi import parse_judgments
from app.oriane import text_channel_body, visual_body, written_body
from app.rank import disclosure_for, project_post

FIXTURE = Path(__file__).parent / "fixtures" / "captured_sanitized.json"


def test_written_query_ors_caption_hashtags_and_mentions():
    body = written_body(["ryanair"], ["instagram", "tiktok"])
    assert body["operator"] == "and"
    assert body["filters"]["platform"]["includes"] == ["instagram", "tiktok"]
    children = body["queries"][0]
    assert children["operator"] == "or"
    fields = [list(item["filters"])[0] for item in children["queries"]]
    assert fields == ["caption", "hashtags", "mentionHandles"]
    assert children["queries"][0]["filters"]["caption"]["includesExactly"]["values"] == ["ryanair"]


def test_transcript_and_visual_queries_match_the_live_shape():
    transcript = text_channel_body("transcript", ["ryanair"], ["tiktok"], "transcript")
    assert transcript["filters"]["transcript"]["includesExactly"]["values"] == ["ryanair"]
    visual = visual_body("ast_" + "a" * 28, ["instagram"])
    value = visual["filters"]["visualSimilarity"]["includes"]["values"][0]
    assert value == {"assetId": "ast_" + "a" * 28, "minScore": 0.9}
    assert "maxScore" not in value


def test_disclosure_is_disclosed_or_unknown_and_has_no_unpaid_state():
    assert disclosure_for("Love this #ad") == "disclosed"
    assert disclosure_for("#adapt the recipe") == "unknown"
    assert disclosure_for("Collaboration commerciale with Revolut") == "disclosed"
    assert disclosure_for("Ryanair to Dublin") == "unknown"
    assert disclosure_for("#sponsored") == "disclosed"


def test_captured_sanitized_row_keeps_caption_and_hashtag_evidence():
    payload = json.loads(FIXTURE.read_text())
    assert payload["origin"] == "captured_sanitized"
    post = project_post(payload["row"], "written", ["ryanair"])
    assert post is not None
    assert post["evidenceLabels"] == ["caption", "hashtag"]
    assert post["canonicalPostUrl"] is None
    assert post["paidPartnership"] == "not_in_oriane_schema"
    assert post["viewsCount"] == 13226443


def test_malformed_model_text_is_not_a_judgment():
    assert parse_judgments("Ryanair is relevant, trust me") is None
    assert parse_judgments('{"posts":[{"postKey":"tiktok:1","verdict":"relevant","holdout":null,"why":"this was unpaid"}]}') is None
    parsed = parse_judgments(
        '```json\n{"posts":[{"postKey":"tiktok:1","verdict":"relevant","holdout":null,"why":"The caption says Ryanair."}]}\n```'
    )
    assert parsed is not None
    assert parsed["tiktok:1"]["verdict"] == "relevant"
