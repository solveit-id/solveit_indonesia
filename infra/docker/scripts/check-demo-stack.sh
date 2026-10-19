#!/usr/bin/env bash
# Fail-closed guard of the local team demo (B5a, docs/development/cloudflare-demo.md). Read-only:
# it reads files, inspects Docker objects, and runs SELECT queries; it never starts Compose.
# manage-demo.sh runs it before every command that starts, seeds, bootstraps, or deletes
# anything, and stops when it refuses. It is separate from check-synthetic-stack.sh on purpose:
# that guard protects the smoke tests and the restore drill (throwaway projects, .test origins
# only) and is not loosened for the demo. Its refusal of every demo project is part of the
# demo's isolation: verify-production.sh, verify-admin.sh, and drill-backup-restore.sh can never
# run against the demo stack.
#
#   check-demo-stack.sh config   names, folders, and the env file only (before Compose runs)
#   check-demo-stack.sh stack    config, plus the running stack and its data (the default)
#
# Required (manage-demo.sh sets them; no defaults here):
#   SOLVEIT_DEMO_PROJECT  solveit-demo, or solveit-demo-<suffix> for rehearsals and CI; never
#                         the development or production project
#   SOLVEIT_DEMO_HOME     the demo's state folder outside the repository, holding demo.env,
#                         secrets/, and the marker file .solveit-demo-project naming the project
#
# The only admin origins accepted are a Cloudflare Quick Tunnel host
# (https://<words>.trycloudflare.com) and the local rehearsal origin
# https://admin.<project>.localhost:<port>. This exception lives only in the demo tooling: the
# backend and the admin listener refuse anything but https:// as before, and production keeps
# its own rules. Exit 0 with "DEMO GUARD ok" lines, or 1 with "REFUSED: <reason>".
set -euo pipefail
export MSYS_NO_PATHCONV=1

refuse() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }
ok() { printf 'DEMO GUARD ok  %s\n' "$*"; }

mode="${1:-stack}"
[[ "$mode" == config || "$mode" == stack ]] || refuse "unknown mode '$mode' (config or stack)"

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
project="${SOLVEIT_DEMO_PROJECT:-}"

# --- names and folders -----------------------------------------------------------------------
[[ -n "$project" ]] || refuse "SOLVEIT_DEMO_PROJECT is not set (manage-demo.sh sets it)"
[[ "$project" =~ ^solveit-demo(-[a-z0-9]+)?$ ]] || refuse "project '$project' is not a demo project (solveit-demo or solveit-demo-<suffix>)"
ok "project $project is a demo project, not the development or production project"

home="${SOLVEIT_DEMO_HOME:-}"
[[ -n "$home" ]] || refuse "SOLVEIT_DEMO_HOME is not set (manage-demo.sh sets it)"
[[ -d "$home" ]] || refuse "the demo state folder does not exist (run prepare first)"
home="$(cd "$home" && pwd -P)"
[[ "$home" != "$repo" && "$home" != "$repo"/* ]] || refuse "the demo state folder is inside the repository"
[[ -f "$home/.solveit-demo-project" && "$(tr -d '\r\n' < "$home/.solveit-demo-project")" == "$project" ]] \
  || refuse "the state folder is not marked for project $project (.solveit-demo-project)"
env_file="$home/demo.env"
[[ -f "$env_file" ]] || refuse "demo.env is missing in the state folder"
for name in app_key db_app_password db_migrator_password mysql_root_password admin_tls_certificate admin_tls_private_key; do
  [[ -s "$home/secrets/$name" ]] || refuse "secret $name is missing in the state folder"
done
ok "state folder, env file, and secrets are outside the repository and belong to $project"

# KEY=value from the env file (the last one wins, as in Compose); quotes are not used for these.
env_value() { sed -n "s/^$1=//p" "$env_file" | tr -d '\r' | tail -1; }

tunnel_origin='^https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com$'
local_origin="^https://admin\\.${project}\\.localhost:[0-9]{2,5}$"
admin_url="$(env_value ADMIN_URL)"
[[ "$admin_url" =~ $tunnel_origin || "$admin_url" =~ $local_origin ]] \
  || refuse "ADMIN_URL '$admin_url' is neither a Quick Tunnel origin nor https://admin.$project.localhost:<port>"
app_url="$(env_value APP_URL)"
[[ "$app_url" =~ ^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/?$ ]] || refuse "APP_URL '$app_url' is not a local origin"
[[ "$(env_value DB_HOST)" == mysql ]] || refuse "DB_HOST is '$(env_value DB_HOST)', not the demo's own mysql service"
[[ "$(env_value SOLVEIT_DEMO)" == "$project" ]] || refuse "demo.env is not marked SOLVEIT_DEMO=$project"
[[ -z "$(env_value TRUSTED_PROXIES)" ]] || refuse "TRUSTED_PROXIES must stay empty (the admin listener passes the client address)"
[[ -z "$(env_value CORS_ALLOWED_ORIGINS)" ]] || refuse "CORS_ALLOWED_ORIGINS must stay empty in the demo"
ok "ADMIN_URL $admin_url, APP_URL $app_url, DB_HOST=mysql, demo marker present"

[[ "$mode" == config ]] && exit 0

# --- the running stack (read-only Docker queries) ---------------------------------------------
container() {
  docker ps -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=$1" | head -1
}
backend="$(container backend)"
mysql="$(container mysql)"
[[ -n "$backend" ]] || refuse "project $project has no running backend container"
[[ -n "$mysql" ]] || refuse "project $project has no running mysql container"

while read -r name label; do
  [[ "$label" == demo ]] || refuse "container $name was not started with compose.prod.demo.yaml"
done < <(docker ps --filter "label=com.docker.compose.project=$project" --format '{{.Names}} {{.Label "org.solveit.environment"}}')
for service in gateway frontend; do
  [[ -z "$(container "$service")" ]] || refuse "the public $service is running in the demo project"
done
ok "every container carries the demo label; the public gateway and website container are not running"

volume="${project}_mysql-data"
[[ "$(docker volume inspect -f '{{index .Labels "com.docker.compose.project"}}' "$volume" 2> /dev/null)" == "$project" ]] \
  || refuse "volume $volume does not exist or does not belong to project $project"
[[ "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Name}}{{end}}{{end}}' "$mysql")" == "$volume" ]] \
  || refuse "the mysql container does not store its data on $volume"
while read -r name mounts; do
  [[ " $mounts " != *" solveit-mysql-data "* ]] || refuse "$name mounts the development volume solveit-mysql-data"
done < <(docker ps --filter "label=com.docker.compose.project=$project" --format '{{.Names}} {{.Mounts}}' | tr ',' ' ')
ok "MySQL on the project's own volume $volume; nothing mounts solveit-mysql-data"

container_env() { docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$backend" | sed -n "s/^$1=//p" | head -1; }
[[ "$(container_env DB_HOST)" == mysql ]] || refuse "the running backend uses DB_HOST=$(container_env DB_HOST)"
[[ "$(container_env SOLVEIT_DEMO)" == "$project" ]] || refuse "the running backend is not marked SOLVEIT_DEMO=$project"
[[ "$(container_env ADMIN_URL)" == "$admin_url" ]] || refuse "the running backend has ADMIN_URL $(container_env ADMIN_URL), demo.env says $admin_url (run start)"
ok "the running backend uses this demo's env file (ADMIN_URL, DB_HOST, marker)"

while read -r name ports; do
  for mapping in ${ports//,/ }; do
    [[ "$mapping" != *"->"* || "$mapping" == 127.0.0.1:* ]] || refuse "$name publishes beyond 127.0.0.1: $mapping"
  done
done < <(docker ps --filter "label=com.docker.compose.project=$project" --format '{{.Names}} {{.Ports}}')
ok "every published port of $project is on 127.0.0.1"

# Accounts and inquiries of the demo are synthetic: addresses on the reserved example.test domain.
# shellcheck disable=SC2016  # expands inside the container
counts="$(docker exec "$mysql" bash -c 'mysql --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)") -N solveit_indonesia -e "SELECT (SELECT COUNT(*) FROM users WHERE email NOT LIKE '"'"'%@example.test'"'"'), (SELECT COUNT(*) FROM inquiries WHERE contact NOT LIKE '"'"'%@example.test'"'"')"' 2> /dev/null)" \
  || refuse "could not read the demo database to prove its data is synthetic"
read -r foreign_users foreign_inquiries <<< "$counts"
[[ "$foreign_users" == 0 ]] || refuse "the demo database holds $foreign_users account(s) outside @example.test"
[[ "$foreign_inquiries" == 0 ]] || refuse "the demo database holds $foreign_inquiries inquiry contact(s) outside @example.test"
ok "every account and inquiry contact in the demo database is synthetic (@example.test)"
