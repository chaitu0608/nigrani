PY=.venv/bin/python
all: data features experiments train test
data: ; $(PY) -m nigrani.generate
features: ; $(PY) -m nigrani.features
train: ; $(PY) -m nigrani.train
experiments: ; $(PY) -m nigrani.experiments
lint: ; .venv/bin/ruff check nigrani tests
test: ; $(PY) -m pytest -q tests
serve: ; .venv/bin/uvicorn nigrani.api:app --port 8000
mcp: ; $(PY) -m nigrani.mcp_server
