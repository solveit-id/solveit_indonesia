#!/usr/bin/env bash
# Fail-closed guard for every script and test that changes a running production-image stack:
# verify-production.sh, verify-admin.sh, drill-backup-restore.sh, and the Playwright production
# test (admin/playwright.production.config.ts). They bootstrap accounts, submit inquiries, write
# audit rows, restart, re-tag, recreate, or delete containers and volumes, so they may run only
# against a throwaway stack with synthetic data. This guard is read-only: it inspects Docker
# objects and runs SELECT queries, and never starts Compose, which could create or change
# containers. Each consumer runs it first and stops if it refuses.
#
# Required (no defaults on purpose; the Compose defaults point at the real configuration):
#   SOLVEIT_PROD_PROJECT  Compose project of the running throwaway stack: lowercase, contains
#                         smoke, drill, or ci, never solveit-indonesia or solveit-indonesia-prod
#   SOLVEIT_ENV_FILE      env file the stack was started with, outside the repository and never
#                         named production.env
#   SOLVEIT_SECRETS_DIR   secrets folder of the stack, outside the repository
# Optional:
#   SOLVEIT_ADMIN_URL     expected admin origin; must equal the backend's ADMIN_URL
#
# What the running stack must show: containers of that project only; the bundled MySQL service
# on the project's own volume <project>_mysql-data (never solveit-mysql-data); DB_HOST=mysql;
# ADMIN_URL on a reserved .test host; APP_URL on localhost, 127.0.0.1, or a .test host; every
# published port on 127.0.0.1; every stored account and inquiry contact synthetic
# (example.test, example.com). Exit 0 with "GUARD ok" lines, or 1 with "REFUSED: <reason>".
set -euo pipefail
export MSYS_NO_PATHCONV=1

refuse() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }
ok() { printf 'GUARD ok  %s\n' "$*"; }

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
project="${SOLVEIT_PROD_PROJECT:-}"

# --- names and paths: decided before Docker is asked anything --------------------------------
[[ -n "$project" ]] || refuse "SOLVEIT_PROD_PROJECT is not set; name the throwaway project explicitly (no default)"
[[ "$project" != solveit-indonesia && "$project" != solveit-indonesia-prod ]] || refuse "project $project is the development or production project"
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || refuse "project name '$project' is not a plain lowercase Compose name"
[[ "$project" =~ (smoke|drill|ci) ]] || refuse "project $project is not marked as throwaway (its name must contain smoke, drill, or ci)"
ok "project $project is explicit and marked as throwaway"

# Relative paths are resolved like Compose does: against infra/docker/.
resolve() {
  local path="$1"
  [[ "$path" = /* || "$path" =~ ^[A-Za-z]: ]] || path="$repo/infra/docker/$path"
  if [[ -d "$path" ]]; then (cd "$path" && pwd -P); else
    [[ -d "$(dirname "$path")" ]] || return 1
    printf '%s/%s\n' "$(cd "$(dirname "$path")" && pwd -P)" "$(basename "$path")"
  fi
}
inside_repo() { [[ "$1" == "$repo" || "$1" == "$repo"/* ]]; }

[[ -n "${SOLVEIT_ENV_FILE:-}" ]] || refuse "SOLVEIT_ENV_FILE is not set (the Compose default is the real infra/docker/production.env)"
env_file="$(resolve "$SOLVEIT_ENV_FILE")" || refuse "SOLVEIT_ENV_FILE folder does not exist"
[[ "$(basename "$env_file")" != production.env ]] || refuse "SOLVEIT_ENV_FILE is a production.env, the name of the real configuration"
if inside_repo "$env_file"; then refuse "SOLVEIT_ENV_FILE is inside the repository; use a copy in a temporary folder"; fi
[[ -f "$env_file" ]] || refuse "SOLVEIT_ENV_FILE does not exist"
ok "env file is a temporary copy outside the repository"

[[ -n "${SOLVEIT_SECRETS_DIR:-}" ]] || refuse "SOLVEIT_SECRETS_DIR is not set (the Compose default is the real infra/docker/secrets)"
secrets_dir="$(resolve "$SOLVEIT_SECRETS_DIR")" || refuse "SOLVEIT_SECRETS_DIR does not exist"
if inside_repo "$secrets_dir"; then refuse "SOLVEIT_SECRETS_DIR is inside the repository; use a temporary folder"; fi
[[ -d "$secrets_dir" ]] || refuse "SOLVEIT_SECRETS_DIR does not exist"
ok "secrets folder is temporary and outside the repository"

# --- the running stack (read-only Docker queries) ---------------------------------------------
container() {
  docker ps -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=$1" | head -1
}
backend="$(container backend)"
mysql="$(container mysql)"
[[ -n "$backend" ]] || refuse "project $project has no running backend container"
[[ -n "$mysql" ]] || refuse "project $project has no running bundled mysql container (profile bundled-db)"

volume="${project}_mysql-data"
[[ "$volume" != solveit-mysql-data ]] || refuse "the development volume solveit-mysql-data"
[[ "$(docker volume inspect -f '{{index .Labels "com.docker.compose.project"}}' "$volume" 2> /dev/null)" == "$project" ]] \
  || refuse "volume $volume does not exist or does not belong to project $project"
[[ "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Name}}{{end}}{{end}}' "$mysql")" == "$volume" ]] \
  || refuse "the mysql container does not store its data on $volume"
ok "bundled MySQL on the project's own volume $volume"

env_of() { docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$backend" | sed -n "s/^$1=//p" | head -1; }
[[ "$(env_of DB_HOST)" == mysql ]] || refuse "the backend uses DB_HOST=$(env_of DB_HOST), not the bundled mysql service"
admin_url="$(env_of ADMIN_URL)"
[[ "$admin_url" =~ ^https://[a-z0-9.-]+\.test(:[0-9]+)?$ ]] || refuse "ADMIN_URL '$admin_url' is not on a reserved .test host"
if [[ -n "${SOLVEIT_ADMIN_URL:-}" ]]; then
  [[ "$SOLVEIT_ADMIN_URL" =~ ^https://[a-z0-9.-]+\.test(:[0-9]+)?$ ]] || refuse "SOLVEIT_ADMIN_URL '$SOLVEIT_ADMIN_URL' is not on a reserved .test host"
  [[ "$SOLVEIT_ADMIN_URL" == "$admin_url" ]] || refuse "SOLVEIT_ADMIN_URL '$SOLVEIT_ADMIN_URL' differs from the backend's ADMIN_URL '$admin_url'"
fi
app_url="$(env_of APP_URL)"
[[ "$app_url" =~ ^https?://(localhost|127\.0\.0\.1|[a-z0-9.-]+\.test)(:[0-9]+)?/?$ ]] || refuse "APP_URL '$app_url' is not a local or .test origin"
ok "ADMIN_URL $admin_url and APP_URL $app_url are test origins; DB_HOST=mysql"

while read -r name ports; do
  for mapping in ${ports//,/ }; do
    [[ "$mapping" != *"->"* || "$mapping" == 127.0.0.1:* ]] || refuse "$name publishes beyond 127.0.0.1: $mapping"
  done
done < <(docker ps --filter "label=com.docker.compose.project=$project" --format '{{.Names}} {{.Ports}}')
ok "every published port of $project is on 127.0.0.1"

# shellcheck disable=SC2016  # expands inside the container
non_synthetic="$(docker exec "$mysql" bash -c 'mysql --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)") -N solveit_indonesia -e "SELECT (SELECT COUNT(*) FROM users WHERE email NOT LIKE '"'"'%@example.test'"'"') + (SELECT COUNT(*) FROM inquiries WHERE contact NOT LIKE '"'"'%@example.test'"'"' AND contact NOT LIKE '"'"'%@example.com'"'"')"' 2> /dev/null)" \
  || refuse "could not read the stack's database to prove its data is synthetic"
[[ "$non_synthetic" == 0 ]] || refuse "the database holds $non_synthetic non-synthetic account or inquiry row(s)"
ok "every stored account and inquiry contact is synthetic"
