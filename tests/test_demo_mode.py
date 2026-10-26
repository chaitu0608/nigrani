"""NIGRANI_DEMO=1 turns the API and MCP server into a read-only public demo."""
import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def demo(monkeypatch):
    monkeypatch.setenv("NIGRANI_DEMO", "1"); monkeypatch.delenv("NIGRANI_API_KEYS", raising=False)
    import nigrani.api as api
    importlib.reload(api); yield api
    monkeypatch.delenv("NIGRANI_DEMO"); importlib.reload(api)


def test_demo_blocks_writes_allows_reads(demo):
    c = TestClient(demo.app); h = {"X-API-Key": "demo-key"}
    assert c.get("/health").json()["demo"] is True
    assert c.get("/v1/me", headers=h).json()["user"] == "demo"
    r = c.post("/v1/alerts/1/close", headers=h, json={"disposition": "false_positive"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "demo_read_only"
    assert c.post("/v1/model/retrain", headers={"X-API-Key": "admin-dev-key"}).status_code == 403
    assert c.get("/v1/me", headers={"X-API-Key": "admin-dev-key"}).status_code == 401  # no admin key in demo


def test_mcp_write_tools_disabled(monkeypatch):
    import nigrani.mcp_server as m
    monkeypatch.setattr(m, "DEMO", True)
    with pytest.raises(PermissionError): m._writable()
