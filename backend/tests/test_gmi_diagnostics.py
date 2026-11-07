import logging

from app.gmi import assess
from app.http import ProviderCallError
from app.settings import load_settings


def _settings(monkeypatch):
    monkeypatch.setenv("GMI_API_KEY", "diagnostic-secret")
    monkeypatch.setenv("GMI_MODEL", "configured-model")
    return load_settings()


def test_model_transport_failure_is_identifiable_in_server_logs(monkeypatch, caplog):
    def failed_request(*args):
        raise ProviderCallError("provider timed out")

    with caplog.at_level(logging.WARNING):
        result = assess(failed_request, _settings(monkeypatch), "Nike", ["nike"], [])

    assert result == (None, "gmi_error")
    assert "GMI request failed: provider timed out" in caplog.text
    assert "diagnostic-secret" not in caplog.text


def test_model_rejection_logs_status_without_provider_payload(monkeypatch, caplog):
    def rejected_request(*args):
        return 401, {"error": {"message": "diagnostic-secret must not be logged"}}

    with caplog.at_level(logging.WARNING):
        result = assess(rejected_request, _settings(monkeypatch), "Nike", ["nike"], [])

    assert result == (None, "gmi_error")
    assert "GMI request rejected: HTTP 401" in caplog.text
    assert "diagnostic-secret" not in caplog.text


def test_model_can_wait_longer_without_extending_retrieval_timeout(monkeypatch):
    monkeypatch.setenv("HTTP_TIMEOUT_SECONDS", "20")
    monkeypatch.setenv("GMI_HTTP_TIMEOUT_SECONDS", "120")
    observed = []

    def failed_request(url, body, headers, timeout):
        observed.append(timeout)
        raise ProviderCallError("provider timed out")

    settings = _settings(monkeypatch)
    assess(failed_request, settings, "Nike", ["nike"], [])

    assert observed == [120.0]
    assert settings.timeout_seconds == 20.0


def test_model_keeps_existing_timeout_when_override_is_unset(monkeypatch):
    monkeypatch.setenv("HTTP_TIMEOUT_SECONDS", "37")
    monkeypatch.delenv("GMI_HTTP_TIMEOUT_SECONDS", raising=False)
    observed = []

    def failed_request(url, body, headers, timeout):
        observed.append(timeout)
        raise ProviderCallError("provider timed out")

    assess(failed_request, _settings(monkeypatch), "Nike", ["nike"], [])

    assert observed == [37.0]


def test_batch_failure_keeps_success_and_safe_diagnostic(monkeypatch):
    import json
    monkeypatch.setenv("GMI_HTTP_TIMEOUT_SECONDS", "120")
    posts = [{"postKey": f"instagram:{i}", "platform": "instagram", "handle": "runner", "viewsCount": 10, "disclosure": "unknown", "evidenceLabels": [], "retrievedBy": []} for i in range(11)]
    def request(url, body, headers, timeout):
        assert timeout == 120
        batch = json.loads(body["messages"][1]["content"])["posts"]
        if len(batch) == 1:
            return 403, {"error": {"code": 1010, "message": "diagnostic-secret"}}
        return 200, {"choices": [{"message": {"content": json.dumps({"posts": [
            {"postKey": p["postKey"], "verdict": "relevant", "holdout": None, "why": "Names brand"}
            for p in batch]})}}]}
    notes = []
    judgments, reason = assess(request, _settings(monkeypatch), "Nike", ["nike"], posts, notes)
    assert len(judgments) == 10
    assert reason == "gmi_error"
    assert notes == ["GMI chat returned HTTP 403. Provider code 1010."]


def test_timeout_diagnostic_uses_model_timeout(monkeypatch):
    monkeypatch.setenv("HTTP_TIMEOUT_SECONDS", "20")
    monkeypatch.setenv("GMI_HTTP_TIMEOUT_SECONDS", "120")
    def request(*args):
        raise ProviderCallError("provider timed out")
    notes = []
    assert assess(request, _settings(monkeypatch), "Nike", ["nike"], [], notes) == (None, "gmi_error")
    assert notes == ["GMI chat provider timed out. Configured timeout 120s."]
