"""Tiny file-based model registry: versioned artifacts + metadata + a production pointer."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import subprocess
from pathlib import Path
from typing import Any

import joblib

ROOT = Path(__file__).resolve().parent.parent
REG = Path(os.environ.get("NIGRANI_REGISTRY", ROOT / "artifacts" / "registry"))


def _index_path() -> Path: return REG / "index.json"


def index() -> dict[str, Any]:
    p = _index_path()
    return json.loads(p.read_text()) if p.exists() else {"production": None, "versions": []}


def _save_index(ix: dict[str, Any]) -> None:
    REG.mkdir(parents=True, exist_ok=True); _index_path().write_text(json.dumps(ix, indent=2, default=str))


def file_sha(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()[:16]


def git_sha() -> str:
    try: return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception: return "unknown"


def register(bundle: dict[str, Any], metadata: dict[str, Any], promote: bool = False) -> str:
    ix = index(); version = f"v{len(ix['versions']) + 1}"
    d = REG / version; d.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, d / "model.joblib")
    meta = {"version": version, "created_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"), "git_sha": git_sha(),
            "artifact_sha": file_sha(d / "model.joblib"), **metadata}
    (d / "metadata.json").write_text(json.dumps(meta, indent=2, default=str))
    ix["versions"].append({k: meta[k] for k in ("version", "created_at", "git_sha", "artifact_sha") } | {"name": metadata.get("name"), "stage": "staging"})
    _save_index(ix)
    if promote or ix["production"] is None: promote_version(version)
    return version


def promote_version(version: str) -> dict[str, Any]:
    ix = index()
    if version not in {v["version"] for v in ix["versions"]}: raise KeyError(f"unknown model version {version}")
    for v in ix["versions"]: v["stage"] = "production" if v["version"] == version else ("archived" if v["stage"] == "production" else v["stage"])
    ix["production"] = version; _save_index(ix); return ix


def metadata(version: str | None = None) -> dict[str, Any]:
    version = version or index()["production"]
    if version is None: raise FileNotFoundError("no model registered; run `make train`")
    return json.loads((REG / version / "metadata.json").read_text())


def load(version: str | None = None) -> dict[str, Any]:
    version = version or index()["production"]
    if version is None: raise FileNotFoundError("no model registered; run `make train`")
    return joblib.load(REG / version / "model.joblib")
