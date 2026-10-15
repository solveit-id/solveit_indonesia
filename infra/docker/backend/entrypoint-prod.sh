#!/bin/sh
# Production entrypoint of the backend image (infra/docker/backend/Dockerfile, target prod).
# 1. Reads secrets from files: APP_KEY_FILE and DB_PASSWORD_FILE (Docker or Compose secrets)
#    become APP_KEY and DB_PASSWORD for this process only. Values are never printed.
# 2. Recreates the writable Laravel folders (tmpfs on a read-only container).
# 3. Caches configuration, routes, and events from the runtime environment.
# It never runs migrations: those are an explicit, separate step (compose.prod.yaml, service migrate).
set -eu

for name in APP_KEY DB_PASSWORD; do
    eval "file=\${${name}_FILE:-}"
    if [ -n "$file" ]; then
        if [ ! -r "$file" ]; then
            echo "solveit: ${name}_FILE points to a file this container cannot read" >&2
            exit 1
        fi
        value="$(cat "$file")"
        export "$name=$value"
        unset "${name}_FILE"
    fi
done

if [ -z "${APP_KEY:-}" ]; then
    echo "solveit: APP_KEY (or APP_KEY_FILE) is required" >&2
    exit 1
fi

mkdir -p storage/app/private storage/framework/cache/data storage/framework/sessions \
    storage/framework/views storage/logs bootstrap/cache

php artisan package:discover --quiet
php artisan optimize --quiet

exec "$@"
