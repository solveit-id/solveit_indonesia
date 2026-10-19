#!/bin/sh
# Production entrypoint of the backend image (infra/docker/backend/Dockerfile, target prod).
# 1. Reads secrets from files: APP_KEY_FILE and DB_PASSWORD_FILE (Docker or Compose secrets)
#    become APP_KEY and DB_PASSWORD for this process only. Values are never printed.
# 2. Refuses an ADMIN_URL that is not an https:// origin (the admin session cookie depends on it).
# 3. Recreates the writable Laravel folders (tmpfs on a read-only container).
# 4. Caches configuration, routes, and events from the runtime environment.
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

# The admin origin decides the session cookie (Secure and __Host- only with https://) and where
# access links point, so a production backend fails closed on anything but an https:// origin,
# and never accepts the public website's origin (B3.2d).
admin_url="${ADMIN_URL:-}"
admin_url="${admin_url%/}"
if ! printf '%s' "$admin_url" | grep -Eqx 'https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?'; then
    echo "solveit: ADMIN_URL must be the https:// origin of the admin console (lowercase host, optional port, no path)" >&2
    exit 1
fi
if [ "$admin_url" = "${APP_URL%/}" ]; then
    echo "solveit: ADMIN_URL must not be the public website origin (APP_URL)" >&2
    exit 1
fi
unset admin_url

mkdir -p storage/app/private storage/framework/cache/data storage/framework/sessions \
    storage/framework/views storage/logs bootstrap/cache

php artisan package:discover --quiet
php artisan optimize --quiet

exec "$@"
