"""GMI key selection and log redaction. Sentinels are not a live provider call."""

import logging

from fastapi.testclient import TestClient

from app.main import app
from app.settings import load_settings

client = TestClient(app)
SENTINEL_MAAS = "maas-sentinel-not-a-live-key"
SENTINEL_MANUAL = "manual-sentinel-not-a-live-key"


def test_manual_key_still_configures_inference(monkeypatch):
    monkeypatch.setenv("GMI_API_KEY", SENTINEL_MANUAL)
    monkeypatch.setenv("GMI_MODEL", "configured-by-env")
    settings = load_settings()
    assert settings.gmi_api_key == SENTINEL_MANUAL
    assert settings.gmi_configured is True


def test_injected_agentbox_key_is_used_when_present(monkeypatch):
    monkeypatch.setenv("GMI_API_KEY", SENTINEL_MANUAL)
    monkeypatch.setenv("GMI_MAAS_API_KEY", SENTINEL_MAAS)
    monkeypatch.setenv("GMI_MODEL", "configured-by-env")
    settings = load_settings()
    assert settings.gmi_api_key == SENTINEL_MAAS


def test_health_reports_config_without_echoing_either_key(monkeypatch):
    monkeypatch.setenv("GMI_MAAS_API_KEY", SENTINEL_MAAS)
    monkeypatch.setenv("GMI_MODEL", "configured-by-env")
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["gmiConfigured"] is True
    assert SENTINEL_MAAS not in response.text
    assert SENTINEL_MANUAL not in response.text


def test_log_filter_redacts_both_key_variables(monkeypatch, caplog):
    monkeypatch.setenv("GMI_API_KEY", SENTINEL_MANUAL)
    monkeypatch.setenv("GMI_MAAS_API_KEY", SENTINEL_MAAS)
    with caplog.at_level(logging.WARNING):
        logging.getLogger("hack-the-feed.test").warning(
            "saw %s and %s",
            SENTINEL_MANUAL,
            SENTINEL_MAAS,
        )
    assert SENTINEL_MAAS not in caplog.text
    assert SENTINEL_MANUAL not in caplog.text
    assert "[redacted]" in caplog.text
