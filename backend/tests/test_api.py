import json

from fastapi.testclient import TestClient

from app.http import ProviderCallError
from app.main import app, reset_rate_limit
from app.search import run_search
from app.settings import load_settings

client = TestClient(app)


def _row(platform, platform_id, handle, views, creator_id, caption="", hashtags=None, mentions=None, media=None):
    return {
        "id": "cnt_" + platform_id.replace(":", "")[:28].ljust(28, "0"),
        "platform": platform,
        "platformId": platform_id,
        "profileHandle": handle,
        "profilePlatformId": creator_id,
        "profileId": "prf_" + "b" * 28,
        "viewsCount": views,
        "publishedAt": "2026-10-02T00:00:00.000Z",
        "caption": caption,
        "hashtags": hashtags or [],
        "mentions": mentions or [],
        "media": media
        or [{"transcript": None, "transcriptChunks": [], "onScreenText": [], "frames": []}],
    }


def _page(rows, total=40):
    return {
        "data": {"results": rows},
        "metadata": {"pagination": {"offset": 0, "limit": 10, "totalCount": total}},
    }


def _judgment(post_key, verdict="relevant", holdout=None, why="The caption names the brand once."):
    return {"postKey": post_key, "verdict": verdict, "holdout": holdout, "why": why}


class FakeHttp:
    def __init__(self, pages, gmi_payload):
        self.pages = pages
        self.gmi_payload = gmi_payload
        self.calls = []

    def __call__(self, url, body, headers, timeout):
        self.calls.append({"url": url, "body": body, "headers": headers, "timeout": timeout})
        assert "Authorization" in headers
        assert headers["Authorization"].startswith("Bearer ")
        assert "super-secret" not in json.dumps(body)
        if url.endswith("/rest/assets"):
            return 201, {"data": {"id": "ast_" + "c" * 28}}
        if "/chat/completions" in url:
            if isinstance(self.gmi_payload, Exception):
                raise self.gmi_payload
            return self.gmi_payload
        if "sort=viewsCount:desc" in url and body.get("name") == "written":
            if isinstance(self.pages["written"], Exception):
                raise self.pages["written"]
            return 206, self.pages["written"]
        if body.get("name") == "transcript":
            if isinstance(self.pages["transcript"], Exception):
                raise self.pages["transcript"]
            return 206, self.pages["transcript"]
        if body.get("name") == "ocr":
            return 206, self.pages["ocr"]
        if "sort=visualSimilarity:desc" in url:
            return 206, self.pages["visual"]
        raise AssertionError(url)


def _settings(monkeypatch, gmi=True):
    monkeypatch.setenv("ORIANE_API_KEY", "oriane-test-key")
    if gmi:
        monkeypatch.setenv("GMI_API_KEY", "gmi-test-key")
        monkeypatch.setenv("GMI_MODEL", "configured-by-env")
    return load_settings()


def _search(monkeypatch, pages, gmi_payload, body=None, gmi=True):
    http = FakeHttp(pages, gmi_payload)
    payload = run_search(body or {"brand": "Ryanair", "aliases": [], "platforms": ["instagram", "tiktok"]}, _settings(monkeypatch, gmi=gmi), http)
    return payload, http


def test_health_reports_configuration_without_calling_providers():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "orianeConfigured": False, "gmiConfigured": False}


def test_endpoint_dedups_and_ranks_a_single_mention_above_repeat_posts(monkeypatch):
    big = _row("instagram", "one", "solo.creator", 5_000_000, "solo-id", caption="Flew Ryanair once")
    small_a = _row("tiktok", "a", "repeater", 100_000, "repeat-id", caption="Ryanair bag")
    small_b = _row("tiktok", "b", "repeater", 100_000, "repeat-id", caption="Ryanair again")
    shared = _row("instagram", "shared", "overlap", 1_000_000, "overlap-id", caption="Ryanair stairs")
    pages = {
        "written": _page([big, small_a, shared], total=896),
        "transcript": _page([shared, small_b], total=527),
        "ocr": _page([], total=1789),
        "visual": _page([], total=42),
    }
    judgments = [
        _judgment("instagram:one"),
        _judgment("tiktok:a"),
        _judgment("tiktok:b"),
        _judgment("instagram:shared"),
    ]
    monkeypatch.setenv("ORIANE_API_KEY", "oriane-test-key")
    monkeypatch.setenv("GMI_API_KEY", "gmi-test-key")
    monkeypatch.setenv("GMI_MODEL", "configured-by-env")
    monkeypatch.setattr("app.main.post_json", FakeHttp(pages, (200, {"choices": [{"message": {"content": json.dumps({"posts": judgments})}}]})))
    response = client.post("/api/search", json={"brand": "Ryanair"})
    assert response.status_code == 200
    body = response.json()
    assert body["distinctPosts"] == 4
    assert body["retrievedRows"] == 5
    handles = [item["handle"] for item in body["rankedCreators"]]
    assert handles == ["solo.creator", "overlap", "repeater"]
    overlap = next(item for item in body["rankedCreators"] if item["handle"] == "overlap")
    shared_post = overlap["posts"][0]
    assert shared_post["retrievedBy"] == ["written", "transcript"]
    assert overlap["sumViews"] == 1_000_000
    repeater = next(item for item in body["rankedCreators"] if item["handle"] == "repeater")
    assert repeater["sumViews"] == 200_000
    assert repeater["relevantPostCount"] == 2
    assert body["gmiModel"] == "configured-by-env"
    assert "unpaid" not in response.text
    assert "oriane-test-key" not in response.text
    assert body["visionVerificationRun"] is False
    written = next(item for item in body["channels"] if item["channel"] == "written")
    assert written["httpStatus"] == 206
    assert written["indexCandidateCount"] == 896


def test_missing_views_stay_null_and_sort_after_known_sums(monkeypatch):
    known = _row("tiktok", "known", "known.creator", 10, "known-id", caption="Ryanair")
    missing = _row("instagram", "missing", "missing.creator", None, "missing-id", caption="Ryanair")
    pages = {"written": _page([missing, known]), "transcript": _page([]), "ocr": _page([]), "visual": _page([])}
    judgments = [_judgment("tiktok:known"), _judgment("instagram:missing", why="The caption says Ryanair and the view count is absent.")]
    body, _ = _search(monkeypatch, pages, (200, {"choices": [{"message": {"content": json.dumps({"posts": judgments})}}]}))
    assert [item["handle"] for item in body["rankedCreators"]] == ["known.creator", "missing.creator"]
    assert body["rankedCreators"][1]["sumViews"] is None
    assert body["rankedCreators"][1]["viewsIncomplete"] is True


def test_same_handle_on_two_platforms_stays_two_creators(monkeypatch):
    first = _row("instagram", "ig1", "sam", 50, "ig-sam", caption="Ryanair")
    second = _row("tiktok", "tt1", "sam", 80, "tt-sam", caption="Ryanair")
    pages = {"written": _page([first, second]), "transcript": _page([]), "ocr": _page([]), "visual": _page([])}
    judgments = [_judgment("instagram:ig1"), _judgment("tiktok:tt1")]
    body, _ = _search(monkeypatch, pages, (200, {"choices": [{"message": {"content": json.dumps({"posts": judgments})}}]}))
    assert [item["creatorKey"] for item in body["rankedCreators"]] == ["tiktok:tt-sam", "instagram:ig-sam"]


def test_owned_account_and_disclosure_are_not_called_unpaid(monkeypatch):
    owned = _row("tiktok", "own", "ryanair", 9_000_000, "brand-id", caption="seat C7 #ryanair")
    disclosed = _row("instagram", "ad", "other.brand", 20, "other-id", caption="Ryanair in frame. Collaboration commerciale")
    pages = {"written": _page([owned, disclosed]), "transcript": _page([]), "ocr": _page([]), "visual": _page([])}
    judgments = [
        _judgment("tiktok:own", why="This is the brand account."),
        _judgment("instagram:ad", why="The caption names Ryanair and discloses a commercial collaboration."),
    ]
    body, _ = _search(monkeypatch, pages, (200, {"choices": [{"message": {"content": json.dumps({"posts": judgments})}}]}))
    assert [item["handle"] for item in body["rankedCreators"]] == ["other.brand"]
    assert body["rankedCreators"][0]["disclosure"] == "disclosed"
    assert body["rankedCreators"][0]["partnershipEligible"] is True
    held = body["heldOut"][0]
    assert held["handle"] == "ryanair"
    assert held["holdoutReason"] == "owned_account"
    assert held["partnershipEligible"] is False
    assert held["judgmentSource"] == "rule"
    dumped = json.dumps(body)
    assert "unpaid" not in dumped


def test_complaint_holdout_is_not_ranked(monkeypatch):
    complaint = _row("instagram", "news", "itvmeridian", 2_000_000, "news-id", caption="trapped on a Ryanair flight")
    pages = {"written": _page([complaint]), "transcript": _page([]), "ocr": _page([]), "visual": _page([])}
    judgments = [_judgment("instagram:news", verdict="irrelevant", holdout="complaint", why="The caption is a complaint about being trapped on a Ryanair flight.")]
    body, _ = _search(monkeypatch, pages, (200, {"choices": [{"message": {"content": json.dumps({"posts": judgments})}}]}))
    assert body["rankedCreators"] == []
    assert body["heldOut"][0]["holdoutReason"] == "complaint"
    assert body["heldOut"][0]["partnershipEligible"] is False


def test_channel_failure_is_a_warning_and_other_channels_remain(monkeypatch):
    kept = _row("tiktok", "speech", "natooooooosh", 1_600_000, "nato-id", media=[{
        "transcript": "We're taking Ryanair.",
        "transcriptChunks": [{"startSeconds": 20.9, "endSeconds": 26.2, "text": "We're taking Ryanair."}],
        "onScreenText": [],
        "frames": [],
    }])
    pages = {
        "written": ProviderCallError("provider timed out"),
        "transcript": _page([kept], total=527),
        "ocr": _page([], total=0),
        "visual": _page([], total=0),
    }
    judgments = [_judgment("tiktok:speech", why="The transcript says they are taking Ryanair. The caption was not in this sample.")]
    body, _ = _search(monkeypatch, pages, (200, {"choices": [{"message": {"content": json.dumps({"posts": judgments})}}]}))
    written = next(item for item in body["channels"] if item["channel"] == "written")
    assert written["status"] == "failed"
    assert written["retrieved"] == 0
    assert any(item.startswith("written:") for item in body["warnings"])
    assert body["rankedCreators"][0]["handle"] == "natooooooosh"
    assert "transcript" in body["rankedCreators"][0]["posts"][0]["evidenceLabels"]


def test_malformed_model_response_does_not_invent_a_verdict(monkeypatch):
    asr = _row("instagram", "ufc1", "ufc", 2_357_936, "ufc-id", media=[{
        "transcript": "How about this from Ryanair DeRitter?",
        "transcriptChunks": [],
        "onScreenText": [],
        "frames": [],
    }])
    pages = {"written": _page([]), "transcript": _page([asr]), "ocr": _page([]), "visual": _page([])}
    body, http = _search(monkeypatch, pages, (200, {"choices": [{"message": {"content": "I think this is relevant."}}]}))
    assert body["assessment"] == "unassessed"
    assert body["assessmentReason"] == "malformed_model_response"
    assert body["rankedCreators"] == []
    creator = body["unassessedCreators"][0]
    assert creator["handle"] == "ufc"
    assert creator["judgmentSource"] == "pending"
    assert creator["posts"][0]["verdict"] is None
    assert creator["why"] is None
    assert any("/chat/completions" in call["url"] for call in http.calls)


def test_gmi_not_configured_leaves_posts_pending(monkeypatch):
    row = _row("instagram", "ig", "ufc", 10, "ufc-id", caption="Ryanair DeRitter highlight")
    pages = {"written": _page([row]), "transcript": _page([]), "ocr": _page([]), "visual": _page([])}
    body, http = _search(monkeypatch, pages, (500, {"error": "nope"}), gmi=False)
    assert body["assessment"] == "unassessed"
    assert body["assessmentReason"] == "gmi_not_configured"
    assert body["rankedCreators"] == []
    assert body["unassessedCreators"][0]["posts"][0]["assessment"] == "pending"
    assert not any("/chat/completions" in call["url"] for call in http.calls)


def test_gmi_http_failure_names_the_status_and_drops_the_body(monkeypatch):
    row = _row("instagram", "ig", "ufc", 10, "ufc-id", caption="Ryanair once")
    pages = {"written": _page([row]), "transcript": _page([]), "ocr": _page([]), "visual": _page([])}
    secret = "Bearer live-key-must-not-appear"
    body, _ = _search(monkeypatch, pages, (403, {"error": {"code": 1010, "message": secret}}))
    assert body["assessment"] == "unassessed"
    assert body["assessmentReason"] == "gmi_error"
    assert body["rankedCreators"] == []
    warning = " ".join(body["warnings"])
    assert "HTTP 403" in warning
    assert "1010" in warning
    assert "live-key" not in warning
    assert secret not in warning


def test_gmi_timeout_names_the_limit(monkeypatch):
    row = _row("instagram", "ig", "ufc", 10, "ufc-id", caption="Ryanair once")
    pages = {"written": _page([row]), "transcript": _page([]), "ocr": _page([]), "visual": _page([])}
    body, _ = _search(monkeypatch, pages, ProviderCallError("provider timed out"))
    assert body["assessmentReason"] == "gmi_error"
    assert body["rankedCreators"] == []
    assert any("timed out" in item and "20" in item for item in body["warnings"])


def test_visual_asset_is_reused_and_queries_stay_on_one_page(monkeypatch):
    pages = {"written": _page([]), "transcript": _page([]), "ocr": _page([]), "visual": _page([])}
    body, http = _search(
        monkeypatch,
        pages,
        (200, {"choices": [{"message": {"content": "{}"}}]}),
        body={"brand": "Ryanair", "aliases": ["#Ryanair"], "platforms": ["instagram", "tiktok"], "visualText": "RYANAIR lettering on a fuselage"},
        gmi=False,
    )
    again, http_again = _search(
        monkeypatch,
        pages,
        (200, {"choices": [{"message": {"content": "{}"}}]}),
        body={"brand": "Other", "aliases": [], "platforms": ["instagram"], "visualText": "RYANAIR lettering on a fuselage"},
        gmi=False,
    )
    asset_calls = [call for call in [*http.calls, *http_again.calls] if call["url"].endswith("/rest/assets")]
    assert len(asset_calls) == 1
    assert asset_calls[0]["body"] == {"type": "text", "text": "RYANAIR lettering on a fuselage"}
    assert again["visualAssetReused"] is True
    visual_calls = [call for call in http.calls if "visualSimilarity" in call["url"]]
    assert len(visual_calls) == 1
    assert "limit=10" in visual_calls[0]["url"]
    assert "projection=full" in visual_calls[0]["url"]
    assert "offset=0" in visual_calls[0]["url"]
    assert visual_calls[0]["headers"]["Authorization"] == "Bearer oriane-test-key"
    value = visual_calls[0]["body"]["filters"]["visualSimilarity"]["includes"]["values"][0]
    assert value["minScore"] == 0.9
    assert body["terms"] == ["ryanair"]


def test_successful_search_is_cached_until_the_inputs_change(monkeypatch):
    row = _row("instagram", "ig", "solo", 5, "solo-id", caption="Ryanair")
    pages = {"written": _page([row]), "transcript": _page([]), "ocr": _page([]), "visual": _page([])}
    gmi = (200, {"choices": [{"message": {"content": json.dumps({"posts": [_judgment("instagram:ig")]})}}]})
    first, http = _search(monkeypatch, pages, gmi)
    second, http2 = _search(monkeypatch, pages, gmi)
    assert first["cache"] == "miss"
    assert second["cache"] == "hit"
    assert http2.calls == []
    assert second["rankedCreators"][0]["sumViews"] == 5


def test_validation_and_rate_limit(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "1")
    reset_rate_limit()
    assert client.post("/api/search", json={"brand": "   "}).status_code == 422
    assert client.post("/api/search", json={"brand": "Ryanair", "visualImageUrl": "http://example.com/a.png"}).status_code == 422
    monkeypatch.setattr("app.main.post_json", FakeHttp(
        {"written": _page([]), "transcript": _page([]), "ocr": _page([]), "visual": _page([])},
        (200, {"choices": [{"message": {"content": "{}"}}]}),
    ))
    monkeypatch.setenv("ORIANE_API_KEY", "oriane-test-key")
    first = client.post("/api/search", json={"brand": "Ryanair"})
    second = client.post("/api/search", json={"brand": "Ryanair"})
    assert first.status_code == 200
    assert second.status_code == 429
