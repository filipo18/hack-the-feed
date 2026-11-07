import pytest

from app.cache import clear_caches
from app.main import reset_rate_limit


@pytest.fixture(autouse=True)
def _isolated(monkeypatch):
    monkeypatch.delenv("ORIANE_API_KEY", raising=False)
    monkeypatch.delenv("GMI_API_KEY", raising=False)
    monkeypatch.delenv("GMI_MAAS_API_KEY", raising=False)
    monkeypatch.delenv("GMI_MODEL", raising=False)
    monkeypatch.delenv("GMI_VISION_MODEL", raising=False)
    monkeypatch.delenv("GMI_VISION", raising=False)
    monkeypatch.delenv("CREATOR_ILLUSTRATIVE_CPM", raising=False)
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "0")
    clear_caches()
    reset_rate_limit()
