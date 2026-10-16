#!/bin/sh
# Development entrypoint of the backend image (infra/docker/backend/Dockerfile, target dev).
# The source is bind-mounted and vendor/ is a named volume (compose.dev.yaml). Composer installs
# the locked dependencies when the volume is empty, and again whenever composer.lock no longer
# matches the lock the volume was installed from (recorded in vendor/.solveit-lock-hash, inside
# the volume): otherwise a volume created before a dependency change keeps booting stale
# packages. It never touches .env, the database, or migrations: those are explicit steps
# (docs/development/docker-development.md).
set -eu

lock_hash="$(sha256sum composer.lock | cut -d' ' -f1)"

if [ ! -f vendor/autoload.php ] || [ "$(cat vendor/.solveit-lock-hash 2>/dev/null || true)" != "$lock_hash" ]; then
    echo "solveit: vendor/ is empty or older than composer.lock, running composer install (locked versions)"
    composer install --no-interaction --no-progress --prefer-dist
    printf '%s\n' "$lock_hash" > vendor/.solveit-lock-hash
fi

if [ ! -f .env ]; then
    echo "solveit: backend/.env is missing. Run infra/docker/scripts/setup-dev.sh first." >&2
    exit 1
fi

exec "$@"
