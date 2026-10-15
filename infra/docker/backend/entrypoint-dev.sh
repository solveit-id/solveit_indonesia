#!/bin/sh
# Development entrypoint of the backend image (infra/docker/backend/Dockerfile, target dev).
# The source is bind-mounted and vendor/ is a named volume (compose.dev.yaml). On the first
# start that volume is empty, so Composer installs the locked dependencies once. It never
# touches .env, the database, or migrations: those are explicit steps
# (docs/development/docker-development.md).
set -eu

if [ ! -f vendor/autoload.php ]; then
    echo "solveit: vendor/ is empty, running composer install (locked versions)"
    composer install --no-interaction --no-progress --prefer-dist
fi

if [ ! -f .env ]; then
    echo "solveit: backend/.env is missing. Run infra/docker/scripts/setup-dev.sh first." >&2
    exit 1
fi

exec "$@"
