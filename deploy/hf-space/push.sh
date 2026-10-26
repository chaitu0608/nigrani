#!/usr/bin/env bash
# Publish the repo as a Docker Space. Needs: `hf auth login` with a write token. Usage: deploy/hf-space/push.sh <user>/nigrani
set -euo pipefail
SPACE=${1:?usage: push.sh <user>/<space>}
ROOT=$(cd "$(dirname "$0")/../.." && pwd); TMP=$(mktemp -d)
git -C "$ROOT" archive HEAD | tar -x -C "$TMP"
cp "$ROOT/deploy/hf-space/README.md" "$TMP/README.md"
# Spaces route to 7860 and run as uid 1000 (the image already uses that user)
sed -i 's/^ENV NIGRANI_DB=\(.*\) PORT=8000$/ENV NIGRANI_DB=\1 PORT=7860 NIGRANI_DEMO=1/; s/^EXPOSE 8000/EXPOSE 7860/' "$TMP/Dockerfile"
hf repo create "$SPACE" --repo-type space --space_sdk docker --exist-ok 2>/dev/null || hf repo create "$SPACE" --repo-type space --space-sdk docker || true
hf upload "$SPACE" "$TMP" . --repo-type space --commit-message "deploy nigrani demo"
echo "https://huggingface.co/spaces/$SPACE"
