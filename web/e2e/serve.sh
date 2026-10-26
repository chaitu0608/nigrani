#!/usr/bin/env bash
# Start the API against a throwaway DB + registry copy so e2e runs never touch real artifacts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cp -r "$ROOT/artifacts/registry" "$TMP/registry"
export NIGRANI_DB="sqlite:///$TMP/e2e.db" NIGRANI_REGISTRY="$TMP/registry"
PY="$ROOT/.venv/bin/python"; [ -x "$PY" ] || PY=python
cd "$ROOT"
"$PY" -c "from nigrani.service import get_service; print(get_service().sync_alerts())"
exec "$PY" -m uvicorn nigrani.api:app --port "${PORT:-8123}"
