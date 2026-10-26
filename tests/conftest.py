from __future__ import annotations

import shutil
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from nigrani import registry
from nigrani.service import SurveillanceService, set_service

ROOT = Path(__file__).resolve().parent.parent
ANALYST = {"X-API-Key": "analyst-dev-key"}
ADMIN = {"X-API-Key": "admin-dev-key"}


@pytest.fixture(scope="session")
def reg_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A private copy of the production registry so retrain/promote tests never touch the real one."""
    d = tmp_path_factory.mktemp("reg") / "registry"; shutil.copytree(ROOT / "artifacts" / "registry", d); return d


@pytest.fixture
def svc(tmp_path: Path, reg_dir: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[SurveillanceService]:
    monkeypatch.setattr(registry, "REG", reg_dir)
    s = SurveillanceService(f"sqlite:///{tmp_path / 't.db'}"); s.sync_alerts(); set_service(s)
    yield s
    set_service(None)


@pytest.fixture
def client(svc: SurveillanceService) -> TestClient: return TestClient(__import__("nigrani.api", fromlist=["app"]).app)


@pytest.fixture
def alert_id(svc: SurveillanceService) -> str: return svc.list_alerts(page_size=1)["items"][0]["alert_id"]
