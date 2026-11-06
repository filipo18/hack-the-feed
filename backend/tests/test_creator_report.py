import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
FIXTURE = json.loads(Path(__file__).parent.joinpath("fixtures/luka_evidence.json").read_text())


class FakeHttp:
    def __init__(self, page, text_payload, vision_payload=None):
        self.page = page
        self.text_payload = text_payload
        self.vision_payload = vision_payload
        self.calls = []

    def __call__(self, url, body, headers, timeout):
        self.calls.append({"url": url, "body": body})
        assert headers["Authorization"].startswith("Bearer ")
        assert "oriane-test-key" not in json.dumps(body)
        assert "gmi-test-key" not in json.dumps(body)
        if "/rest/contents/search" in url:
            return 206, self.page
        if "/chat/completions" in url:
            messages = body["messages"]
            vision = isinstance(messages[0].get("content"), list)
            payload = self.vision_payload if vision else self.text_payload
            if isinstance(payload, Exception):
                raise payload
            return payload
        raise AssertionError(url)


def _page(rows, total):
    return {"data": {"results": rows}, "metadata": {"pagination": {"offset": 0, "limit": 5, "totalCount": total}}}


def _model(rows, key="entities"):
    return 200, {"choices": [{"message": {"content": json.dumps({key: rows})}}]}


def _post(monkeypatch, rows, total, text, vision=None, gmi=True, body=None, cpm_env=None):
    monkeypatch.setenv("ORIANE_API_KEY", "oriane-test-key")
    if gmi:
        monkeypatch.setenv("GMI_API_KEY", "gmi-test-key")
        monkeypatch.setenv("GMI_MODEL", "configured-by-env")
    if cpm_env is not None:
        monkeypatch.setenv("CREATOR_ILLUSTRATIVE_CPM", cpm_env)
    http = FakeHttp(_page(rows, total), text, vision)
    monkeypatch.setattr("app.main.post_json", http)
    response = client.post("/api/creator-report", json=body or {"handle": "@lukadoncic", "platform": "instagram", "maxPosts": 5})
    return response, http


def test_luka_fixture_is_not_returned_when_the_model_finds_nothing(monkeypatch):
    response, http = _post(monkeypatch, FIXTURE["posts"], 3, _model([]), _model([], "observations"))
    assert response.status_code == 200
    body = response.json()
    names = [entity["name"] for entity in body["entities"]]
    assert names == []
    assert "Nike" not in response.text
    assert body["retrieval"]["returnedCount"] == 3
    assert body["retrieval"]["indexedTotalCount"] == 3
    assert [post["platformId"] for post in body["posts"]] == ["Ddt1JFOPfoA", "DdhRRXMiKXA", "DlukaYouTubeCap001"]
    assert body["followers"] == FIXTURE["followers"]
    oriane = http.calls[0]
    assert oriane["body"]["filters"]["profileHandle"]["exactMatch"]["values"] == ["lukadoncic"]
    assert "brand" not in oriane["body"]["filters"]
    assert "visualSimilarity" not in json.dumps(oriane["body"])


def test_luka_evidence_stays_grounded_and_views_stay_null(monkeypatch):
    monkeypatch.setenv("GMI_VISION", "1")
    swoosh = FIXTURE["swoosh"]
    text = _model(
        [
            {
                "name": "YouTube",
                "entityType": "platform_distribution",
                "postId": "DlukaYouTubeCap001",
                "field": "caption",
                "quote": "Full game is on YouTube.",
            },
            {
                "name": "Jordan",
                "entityType": "product",
                "alias": "Jumpman",
                "postId": "DdhRRXMiKXA",
                "field": "on_screen_text",
                "quote": "Jordan",
            },
            {
                "name": "Sony",
                "entityType": "brand",
                "postId": "Ddt1JFOPfoA",
                "field": "caption",
                "quote": "shot on Sony",
            },
            {
                "name": "Nike",
                "entityType": "brand",
                "postId": "cnt_other_author_post_000000004",
                "field": "caption",
                "quote": "Nike shoes",
            },
        ]
    )
    vision = _model(
        [
            {"frameId": swoosh["frameId"], "name": "Nike", "entityType": "brand", "alias": "swoosh", "confidence": 0.99},
            {"frameId": swoosh["frameId"], "name": "Lakers", "entityType": "team"},
            {"frameId": swoosh["frameId"], "name": "NBA", "entityType": "brand"},
            {"frameId": "frm_not_sent", "name": "Adidas", "entityType": "brand"},
        ],
        "observations",
    )
    response, _ = _post(monkeypatch, FIXTURE["posts"], 3, text, vision)
    body = response.json()
    assert response.status_code == 200
    by_name = {entity["name"]: entity for entity in body["entities"]}
    assert set(by_name) == {"YouTube", "Jordan", "Nike", "Lakers", "NBA"}
    assert by_name["YouTube"]["entityType"] == "platform_distribution"
    assert by_name["YouTube"]["evidence"][0]["snippet"] == "Full game is on YouTube."
    nike = by_name["Nike"]
    assert nike["aliases"] == ["swoosh"]
    assert nike["evidence"][0]["frameId"] == swoosh["frameId"]
    assert nike["evidence"][0]["timestampSeconds"] == swoosh["timestampSeconds"]
    assert nike["evidence"][0]["views"] == swoosh["views"]
    assert nike["evidence"][0]["snippet"] is None
    assert nike["evidence"][0]["reviewStatus"] == "unreviewed"
    assert "confidence" not in json.dumps(nike)
    barber = by_name["Jordan"]
    assert barber["aliases"] == []
    assert barber["matchingPosts"][0]["views"] is None
    assert barber["matchingPosts"][0]["platformId"] == FIXTURE["nullViewsPlatformId"]
    assert body["invoice"] is None
    assert body["paymentOwed"] is False
    assert body["illustrativeCpm"] is None
    assert "unpaid" not in response.text
    assert "membership" not in response.text
    assert body["assessment"]["text"] == "complete"
    assert body["assessment"]["vision"] == "complete"
    assert body["visionFramesSent"] == 1


def test_empty_index_is_not_a_missing_account(monkeypatch):
    response, _ = _post(monkeypatch, [], 0, _model([]), gmi=False)
    body = response.json()
    assert body["retrieval"]["message"] == "no indexed content found"
    assert "does not exist" not in response.text
    assert body["entities"] == []
    assert body["assessment"]["reason"] == "no_indexed_posts"


def test_duplicate_author_filter_and_missing_views_on_a_small_page(monkeypatch):
    rows = [
        {
            "id": "cnt_same_author_00000000000001",
            "platform": "tiktok",
            "platformId": "same-post",
            "profileHandle": "cheapholidayexpert",
            "publishedAt": "2026-10-26T00:00:00.000Z",
            "viewsCount": None,
            "caption": "No brand sentence.",
            "hashtags": [],
            "mentions": [],
            "media": [{"transcript": None, "onScreenText": [], "frames": []}],
        },
        {
            "id": "cnt_same_author_00000000000002",
            "platform": "tiktok",
            "platformId": "same-post",
            "profileHandle": "cheapholidayexpert",
            "publishedAt": "2026-10-26T00:00:00.000Z",
            "viewsCount": 5,
            "caption": "duplicate",
            "hashtags": [],
            "mentions": [],
            "media": [],
        },
        {
            "id": "cnt_other_platform_000000000003",
            "platform": "instagram",
            "platformId": "ig-post",
            "profileHandle": "cheapholidayexpert",
            "publishedAt": "2026-10-25T00:00:00.000Z",
            "viewsCount": 9,
            "caption": "other platform",
            "hashtags": [],
            "mentions": [],
            "media": [],
        },
    ]
    response, _ = _post(
        monkeypatch,
        rows,
        24,
        _model([]),
        gmi=False,
        body={"handle": "cheapholidayexpert", "platform": "tiktok", "maxPosts": 5},
    )
    body = response.json()
    assert body["retrieval"]["returnedCount"] == 1
    assert body["retrieval"]["indexedTotalCount"] == 24
    assert body["retrieval"]["paginationComplete"] is False
    assert body["posts"][0]["viewsCount"] is None
    assert body["posts"][0]["transcriptState"] == "null"


def test_model_failure_stays_unassessed_without_a_fallback(monkeypatch):
    from app.http import ProviderCallError

    response, _ = _post(
        monkeypatch,
        FIXTURE["posts"],
        3,
        ProviderCallError("provider connection failed"),
    )
    body = response.json()
    assert body["assessment"]["text"] == "failed"
    assert body["entities"] == []
    assert body["posts"]
    assert "Birkenstock" not in response.text


def test_missing_gmi_blocks_vision_and_does_not_invent_a_cpm(monkeypatch):
    response, http = _post(monkeypatch, FIXTURE["posts"], 3, _model([]), gmi=False)
    body = response.json()
    assert body["assessment"] == {"text": "unassessed", "vision": "blocked", "reason": "gmi_not_configured"}
    assert body["illustrativeCpm"] is None
    assert body["invoice"] is None
    assert all("/chat/completions" not in call["url"] for call in http.calls)
    priced, _ = _post(monkeypatch, FIXTURE["posts"], 3, _model([]), gmi=False, cpm_env="12.5")
    assert priced.json()["illustrativeCpm"] == 12.5
    assert priced.json()["cpmSource"] == "CREATOR_ILLUSTRATIVE_CPM"


def test_brand_field_is_rejected_and_disclosure_is_not_unpaid(monkeypatch):
    rejected = client.post("/api/creator-report", json={"handle": "a", "platform": "instagram", "brand": "Nike"})
    assert rejected.status_code == 422
    row = {
        "id": "cnt_disclosed_post_0000000001",
        "platform": "instagram",
        "platformId": "adpost",
        "profileHandle": "creator",
        "publishedAt": "2026-10-01T00:00:00.000Z",
        "viewsCount": 10,
        "caption": "Hello",
        "hashtags": ["#ad"],
        "mentions": [],
        "media": [],
    }
    response, _ = _post(
        monkeypatch,
        [row],
        1,
        _model([{"name": "Hello", "entityType": "brand", "postId": "adpost", "field": "caption", "quote": "Hello", "disclosure": "unpaid"}]),
        body={"handle": "creator", "platform": "instagram"},
    )
    entity = response.json()["entities"][0]
    assert entity["disclosure"] == "disclosed"
    assert entity["status"] == "candidate"
    assert "unpaid" not in response.text


def test_creator_route_does_not_change_brand_search_health():
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    missing = client.post("/api/search", json={"brand": "Ryanair"})
    assert missing.status_code == 200
    assert missing.json()["assessment"] == "unassessed"
