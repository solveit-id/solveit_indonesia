#!/bin/sh
# Development entrypoint of the admin image (infra/docker/admin/Dockerfile, target dev).
# The source is bind-mounted and node_modules/ is a named volume (compose.dev.yaml), so Linux
# packages never mix with a node_modules/ installed on the host. npm installs the locked
# dependencies when the volume is empty, and again whenever package-lock.json no longer matches
# the lock the volume was installed from (recorded in node_modules/.solveit-lock-hash, inside
# the volume), so a dependency change never leaves the container on stale packages.
set -eu

lock_hash="$(sha256sum package-lock.json | cut -d' ' -f1)"

if [ ! -f node_modules/.package-lock.json ] || [ "$(cat node_modules/.solveit-lock-hash 2>/dev/null || true)" != "$lock_hash" ]; then
    echo "solveit: node_modules/ is empty or older than package-lock.json, running npm ci (locked versions)"
    npm ci --no-audit --no-fund
    printf '%s\n' "$lock_hash" > node_modules/.solveit-lock-hash
fi

exec "$@"
