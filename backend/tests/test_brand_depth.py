import json
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.gmi import assess, parse_judgments
from app.settings import load_settings
from app.rank import apply_judgments, group_creators, project_post
from app.main import app
from app.http import ProviderCallError


def row(number, handle="runner", platform="instagram"):
    return {"platform": platform, "platformId": str(number), "profileHandle": handle,
            "profilePlatformId": "runner-id", "viewsCount": 100, "caption": "I run in Nike shoes"}


def setup(monkeypatch, pages, *, fail_model=False, omit_last=False):
    monkeypatch.setenv("ORIANE_API_KEY", "test-oriane")
    monkeypatch.setenv("GMI_API_KEY", "test-gmi")
    monkeypatch.setenv("GMI_MODEL", "test-model")
    calls = []

    def http(url, body, headers, timeout):
        calls.append((url, body))
        if "/chat/completions" in url:
            if fail_model:
                raise ProviderCallError("provider timed out")
            posts = json.loads(body["messages"][1]["content"])["posts"]
            if omit_last:
                posts = posts[:-1]
            return 200, {"choices": [{"message": {"content": json.dumps({"posts": [
                {"postKey": p["postKey"], "verdict": "relevant", "holdout": None,
                 "context": "product_use", "why": "The creator describes running in Nike shoes."}
                for p in posts]})}}]}
        offset = int(parse_qs(urlparse(url).query)["offset"][0])
        page = pages.get(offset, [])
        if isinstance(page, Exception):
            raise page
        return 200, {"data": {"results": page}, "metadata": {"pagination": {"totalCount": 25}}}

    monkeypatch.setattr("app.main.post_json", http)
    return calls


def request(**overrides):
    return TestClient(app).post("/api/search/creator", json={
        "brand": "Nike", "handle": "runner", "platform": "instagram", **overrides})


def test_context_is_validated_without_inventing_product_use():
    base = {"postKey": "instagram:1", "verdict": "relevant", "holdout": None, "why": "Names Nike."}
    for value, expected in [("review", "review"), ("made_up", "unknown"), (None, "unknown")]:
        result = parse_judgments(json.dumps({"posts": [{**base, "context": value}]}))
        assert result["instagram:1"]["context"] == expected


def test_deeper_search_scopes_author_and_brand_and_deduplicates_pages(monkeypatch):
    calls = setup(monkeypatch, {0: [row(i) for i in range(10)], 10: [row(9), row(10), row(11, "stranger"), row(12, platform="tiktok")]})
    response = request()
    assert response.status_code == 200
    data = response.json()
    creator = data["rankedCreators"][0]
    assert creator["relevantPostCount"] == 11
    assert creator["sumViews"] == 1100
    assert creator["posts"][0]["context"] == "product_use"
    assert data["depth"]["status"] == "partial"  # wrong-author rows were rejected
    search = [(url, body) for url, body in calls if "/contents/search" in url]
    assert len(search) == 2
    assert [parse_qs(urlparse(url).query)["offset"] for url, _ in search] == [["0"], ["10"]]
    filters = search[0][1]["filters"]
    assert filters["profileHandle"]["exactMatch"]["values"] == ["runner"]
    assert filters["platform"]["includes"] == ["instagram"]
    assert search[0][1]["operator"] == "and"
    assert set(q["filters"].keys().__iter__().__next__() for q in search[0][1]["queries"][0]["queries"]) == {"caption", "hashtags", "mentionHandles", "transcript", "onScreenText"}


def test_second_page_failure_keeps_assessed_first_page_and_is_not_cached(monkeypatch):
    calls = setup(monkeypatch, {0: [row(i) for i in range(10)], 10: ProviderCallError("provider timed out")})
    data = request().json()
    assert data["depth"]["status"] == "partial"
    assert data["rankedCreators"][0]["relevantPostCount"] == 10
    assert data["warnings"]
    before = len(calls)
    request()
    assert len(calls) > before


def test_missing_model_results_never_count_and_remain_partial(monkeypatch):
    setup(monkeypatch, {0: [row(1), row(2)]}, omit_last=True)
    data = request().json()
    assert data["depth"]["status"] == "partial"
    assert data["rankedCreators"][0]["relevantPostCount"] == 1
    assert data["rankedCreators"][0]["posts"][1]["assessment"] == "pending"


def test_failed_model_does_not_create_a_recommendation(monkeypatch):
    setup(monkeypatch, {0: [row(1)]}, fail_model=True)
    data = request().json()
    assert data["depth"]["status"] == "failed"
    assert data["rankedCreators"] == []


def test_completed_result_is_cached_by_brand_handle_and_platform(monkeypatch):
    calls = setup(monkeypatch, {0: [row(1)]})
    assert request().json()["depth"]["status"] == "complete"
    before = len(calls)
    assert request().json()["cache"] == "hit"
    assert len(calls) == before
    request(brand="Adidas")
    assert len(calls) > before


def test_invalid_creator_search_is_rejected():
    assert request(handle="two words").status_code == 422
    assert request(platform="other").status_code == 422


def test_creator_explanation_comes_from_relevant_evidence():
    popular = project_post({**row(1), "viewsCount": 1000000}, "written", ["nike"])
    relevant = project_post(row(2), "written", ["nike"])
    result = apply_judgments(group_creators([popular, relevant]), {
        "instagram:1": {"verdict": "relevant", "holdout": "complaint", "context": "criticism", "why": "Complains about Nike."},
        "instagram:2": {"verdict": "relevant", "holdout": None, "context": "product_use", "why": "Uses Nike shoes for running."},
    }, ["nike"])
    assert result["rankedCreators"][0]["why"] == "Uses Nike shoes for running."


def test_discovery_assessment_is_batched_to_avoid_truncated_context_output(monkeypatch):
    monkeypatch.setenv("GMI_API_KEY", "test-gmi")
    monkeypatch.setenv("GMI_MODEL", "test-model")
    sizes = []

    def http(url, body, headers, timeout):
        posts = json.loads(body["messages"][1]["content"])["posts"]
        sizes.append(len(posts))
        return 200, {"choices": [{"message": {"content": json.dumps({"posts": [
            {"postKey": p["postKey"], "verdict": "relevant", "holdout": None, "context": "review", "why": "Reviews Nike shoes."}
            for p in posts]})}}]}

    posts = [project_post(row(i), "written", ["nike"]) for i in range(25)]
    judgments, reason = assess(http, load_settings(), "Nike", ["nike"], posts)
    assert sorted(sizes) == [5, 10, 10]
    assert len(judgments) == 25
    assert reason is None
