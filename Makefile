PY=.venv/bin/python
all: data features train sync test
data: ; $(PY) -m nigrani.generate
features: ; $(PY) -m nigrani.features
train: ; $(PY) -m nigrani.train
sync: ; $(PY) -c "from nigrani.service import get_service; print(get_service().sync_alerts())"
lint: ; .venv/bin/ruff check nigrani tests docs
test: ; $(PY) -m pytest -q tests --cov=nigrani --cov-report=term
serve: ; .venv/bin/uvicorn nigrani.api:app --port 8000
mcp: ; $(PY) -m nigrani.mcp_server
web-install: ; cd web && npm ci
web-build: ; cd web && npm run build
web-dev: ; cd web && npm run dev
shots: ; cd web && node scripts/shots.mjs http://localhost:8011
e2e: ; cd web && npm run e2e
elliptic: ; $(PY) -m nigrani.elliptic --download
pump-study: ; $(PY) -m nigrani.pump_experiments
docker: ; docker build -t nigrani . && docker run --rm -p 8000:8000 nigrani
demo: ; NIGRANI_DEMO=1 .venv/bin/uvicorn nigrani.api:app --port 8000
