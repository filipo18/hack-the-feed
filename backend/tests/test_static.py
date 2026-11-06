"""STATIC_DIR serves the built UI on the same origin as /health and /api/search."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_without_static_dir_frontend_paths_are_not_found(monkeypatch):
    monkeypatch.delenv("STATIC_DIR", raising=False)
    assert client.get("/for-brands").status_code == 404
    assert client.get("/health").json()["status"] == "ok"


def test_static_serves_index_assets_and_deep_links(tmp_path, monkeypatch):
    static = tmp_path / "static"
    assets = static / "assets"
    assets.mkdir(parents=True)
    (static / "index.html").write_text("<div id=\"root\">APP</div>", encoding="utf-8")
    (assets / "app.js").write_text("console.log('asset')", encoding="utf-8")
    outside = tmp_path / "secret.txt"
    outside.write_text("SECRET_SENTINEL", encoding="utf-8")
    (static / "leak.txt").symlink_to(outside)
    monkeypatch.setenv("STATIC_DIR", str(static))

    assert client.get("/").text == "<div id=\"root\">APP</div>"
    assert client.get("/for-brands").text == "<div id=\"root\">APP</div>"
    assert client.get("/brands/Ryanair").text == "<div id=\"root\">APP</div>"
    assert client.get("/creators/someone").text == "<div id=\"root\">APP</div>"
    asset = client.get("/assets/app.js")
    assert asset.status_code == 200
    assert asset.text == "console.log('asset')"
    leaked = client.get("/leak.txt")
    assert "SECRET_SENTINEL" not in leaked.text
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    missing_api = client.get("/api/search")
    assert missing_api.status_code == 404
    assert "APP" not in missing_api.text


def test_search_still_reports_missing_config_when_static_is_mounted(tmp_path, monkeypatch):
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text("APP", encoding="utf-8")
    monkeypatch.setenv("STATIC_DIR", str(static))
    monkeypatch.delenv("ORIANE_API_KEY", raising=False)
    monkeypatch.delenv("GMI_API_KEY", raising=False)
    monkeypatch.delenv("GMI_MODEL", raising=False)
    response = client.post(
        "/api/search",
        json={"brand": "Ryanair", "aliases": [], "platforms": ["instagram", "tiktok"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["assessmentReason"] == "oriane_not_configured"
    assert body["rankedCreators"] == []
    assert "SECRET" not in response.text
