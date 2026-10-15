#!/bin/sh
# Development entrypoint of the frontend image (infra/docker/frontend/Dockerfile, target dev).
# The source is bind-mounted and node_modules/ is a named volume (compose.dev.yaml), so Linux
# packages never mix with a node_modules/ installed on the host. On the first start the volume
# is empty and npm installs the locked dependencies once.
set -eu

if [ ! -f node_modules/.package-lock.json ]; then
    echo "solveit: node_modules/ is empty, running npm ci (locked versions)"
    npm ci --no-audit --no-fund
fi

exec "$@"
