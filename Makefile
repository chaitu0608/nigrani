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
