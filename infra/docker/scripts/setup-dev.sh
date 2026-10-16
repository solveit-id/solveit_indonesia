#!/usr/bin/env bash
# One-time setup of the full-Docker development environment (infra/docker/compose.dev.yaml).
# Run from anywhere with bash (Git Bash on Windows, Linux, macOS):
#   bash infra/docker/scripts/setup-dev.sh
#
# Safe to run again. It only creates what is missing and never overwrites or deletes:
#   - backend/docker/mysql/secrets/*   random MySQL passwords (48 hex characters)
#   - backend/.env, backend/.env.testing  from backend/.env.example, with a new APP_KEY
# then builds the images, starts MySQL, the API, and the frontend, and runs the (additive)
# migrations on the development database. It never removes containers or volumes, never
# prints a secret, and never touches a database other than solveit_indonesia.
# Guide: docs/development/docker-development.md.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
compose_file="$root/infra/docker/compose.dev.yaml"
secrets_dir="$root/backend/docker/mysql/secrets"
backend="$root/backend"

say() { printf 'solveit: %s\n' "$*"; }
random_hex() { head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
random_app_key() { printf 'base64:%s' "$(head -c 32 /dev/urandom | base64 | tr -d '\n')"; }

compose() { docker compose -f "$compose_file" "$@"; }

# Compose `include` needs Docker Compose 2.20 or newer.
version="$(docker compose version --short 2>/dev/null || true)"
if [[ -z "$version" ]]; then
  say "Docker Compose v2 is not available. Install and start Docker Desktop (or Docker Engine with the compose plugin)." >&2
  exit 1
fi
major="${version%%.*}"; rest="${version#*.}"; minor="${rest%%.*}"
if (( major < 2 || (major == 2 && minor < 20) )); then
  say "Docker Compose $version is too old; 2.20 or newer is required." >&2
  exit 1
fi

# 1. MySQL secrets (only the missing ones). The MySQL image reads them as its own user (uid 999)
#    inside the container, so the files stay readable (0644); the folder (0700) keeps other users
#    of this machine out. Compose bind-mounts each file, so the folder mode does not reach the
#    container.
mkdir -p "$secrets_dir"
chmod 700 "$secrets_dir" 2>/dev/null || true
for name in mysql_root_password solveit_dev_password solveit_test_password; do
  if [[ ! -e "$secrets_dir/$name" ]]; then
    random_hex > "$secrets_dir/$name"
    chmod 644 "$secrets_dir/$name" 2>/dev/null || true
    say "created secret $name"
  fi
done

# 2. backend/.env and backend/.env.testing (only if missing). Values are written by the shell's
#    printf built-in, so no password appears in a process list or on screen.
if [[ ! -e "$backend/.env" ]]; then
  dev_password="$(cat "$secrets_dir/solveit_dev_password")"
  app_key="$(random_app_key)"
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      APP_KEY=*) printf 'APP_KEY=%s\n' "$app_key" ;;
      DB_PASSWORD=*) printf 'DB_PASSWORD=%s\n' "$dev_password" ;;
      *) printf '%s\n' "$line" ;;
    esac
  done < "$backend/.env.example" > "$backend/.env"
  chmod 600 "$backend/.env" 2>/dev/null || true
  unset dev_password app_key
  say "created backend/.env (development database solveit_indonesia, user solveit_dev)"
else
  say "backend/.env exists, left unchanged"
fi

if [[ ! -e "$backend/.env.testing" ]]; then
  {
    printf 'APP_ENV=testing\n'
    printf 'APP_KEY=%s\n' "$(random_app_key)"
    printf 'DB_CONNECTION=mysql\n'
    # Host values for the native workflow; inside Docker, compose.dev.yaml sets mysql:3306.
    printf 'DB_HOST=127.0.0.1\n'
    printf 'DB_PORT=3307\n'
    printf 'DB_DATABASE=solveit_indonesia_testing\n'
    printf 'DB_USERNAME=solveit_test\n'
    printf 'DB_PASSWORD=%s\n' "$(cat "$secrets_dir/solveit_test_password")"
  } > "$backend/.env.testing"
  chmod 600 "$backend/.env.testing" 2>/dev/null || true
  say "created backend/.env.testing (testing database solveit_indonesia_testing, user solveit_test)"
else
  say "backend/.env.testing exists, left unchanged"
fi

# 3. Images and services. An existing solveit-mysql container is reused, not recreated.
say "building images"
compose build
say "starting MySQL, backend, frontend, admin (first start installs Composer and npm dependencies)"
compose up -d --wait mysql
compose up -d backend frontend admin

# 4. Additive migrations on the development database only.
say "waiting for the backend dependencies"
for _ in $(seq 1 120); do
  if compose exec -T backend test -f vendor/autoload.php 2>/dev/null; then break; fi
  sleep 5
done
compose exec -T backend php artisan migrate --no-interaction

say "done. Website: http://localhost:${SOLVEIT_FRONTEND_PORT:-5173}  API: http://localhost:${SOLVEIT_BACKEND_PORT:-8000}/up  Admin: http://127.0.0.1:${SOLVEIT_ADMIN_PORT:-5174}"
say "tests: docker compose -f infra/docker/compose.dev.yaml exec backend php artisan test"
