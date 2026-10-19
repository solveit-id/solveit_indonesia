#!/usr/bin/env bash
# Backup and restore drill on an isolated, synthetic production stack (compose.prod.yaml with the
# profile bundled-db). It takes the backup the production guide prescribes, destroys the drill
# project's MySQL container AND its volume, recreates MySQL from nothing, restores the backup,
# and proves that rows, checksums, audit triggers, grants, schema, and the application are back.
# Used by .github/workflows/docker-ci.yml and for local QA.
#
# It deletes a database volume, so it runs only after check-synthetic-stack.sh accepts the
# stack (throwaway project name, temporary env file and secrets outside the repository, the
# project's own MySQL volume and never solveit-mysql-data, DB_HOST=mysql, .test admin origin,
# loopback ports, synthetic data only). Nothing is touched before that.
#
#   SOLVEIT_DRILL_PROJECT  Compose project of the running drill stack (required, a deliberate
#                          second opt-in for the destructive step; checked as SOLVEIT_PROD_PROJECT)
#   SOLVEIT_ENV_FILE, SOLVEIT_SECRETS_DIR  those of the stack (required by the guard)
#   SOLVEIT_BASE_URL       public gateway URL (default http://127.0.0.1:8080)
#
# The backup lives only in a temporary folder that is deleted on exit. Never point this at a
# stack with real data; real backups follow docs/development/docker-production.md.
# SC2016: single-quoted $ is intended; it must expand inside the containers, not on the host.
# shellcheck disable=SC2016
set -euo pipefail
export MSYS_NO_PATHCONV=1

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && { pwd -W 2> /dev/null || pwd; })"
project="${SOLVEIT_DRILL_PROJECT:-}"
public="${SOLVEIT_BASE_URL:-http://127.0.0.1:8080}"
tmp="$(cd "$(mktemp -d)" && { pwd -W 2> /dev/null || pwd; })"
trap 'rm -rf "$tmp"' EXIT
umask 077

pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*" >&2; exit 1; }
compose() { docker compose -p "$project" -f "$root/infra/docker/compose.prod.yaml" --profile bundled-db "$@"; }
root_sql() { compose exec -T mysql bash -c "mysql --defaults-extra-file=<(printf \"[client]\nuser=root\npassword=%s\n\" \"\$(cat /run/secrets/mysql_root_password)\") -N --raw $1"; }
query() { root_sql "solveit_indonesia -e \"$1\""; }
as_app_user() { compose exec -T mysql bash -c "mysql --defaults-extra-file=<(printf \"[client]\nuser=solveit_app\npassword=%s\n\" \"\$(cat /run/secrets/db_app_password)\") -N solveit_indonesia -e \"$1\"" 2>&1; }

echo "== guards (before anything is touched)"
[[ -n "$project" ]] || fail "set SOLVEIT_DRILL_PROJECT to the throwaway project of the drill stack"
SOLVEIT_PROD_PROJECT="$project" bash "$(dirname "${BASH_SOURCE[0]}")/check-synthetic-stack.sh" || fail "the guard refused this stack; nothing was changed"
volume="${project}_mysql-data"
pass "throwaway project $project, its own volume, bundled MySQL, synthetic data only"

echo "== inventory (writes stopped)"
as_app_user "INSERT INTO admin_audit_events (action, actor_type) VALUES ('drill.marker', 'cli')" > /dev/null || fail "could not write the drill marker"
started="$(date +%s)"
compose stop backend > /dev/null 2>&1
tables="inquiries users admin_access_links admin_audit_events sessions cache migrations"
inventory() {
  local table
  for table in $tables; do
    printf '%s %s ' "$table" "$(query "SELECT COUNT(*) FROM $table")"
    root_sql "-e \"CHECKSUM TABLE solveit_indonesia.$table\"" | cut -f2
  done
  query "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = 'solveit_indonesia' AND EVENT_OBJECT_TABLE = 'admin_audit_events'"
}
inventory > "$tmp/before"
[[ "$(grep -c . "$tmp/before")" -gt 1 ]] || fail "empty inventory"
grep -q '^admin_audit_events [1-9]' "$tmp/before" || fail "no audit events to protect"
[[ "$(tail -1 "$tmp/before")" == 2 ]] || fail "expected the two audit triggers before the backup"
pass "inventory: $(head -n -1 "$tmp/before" | awk '{printf "%s=%s ", $1, $2}')"

echo "== backup"
compose exec -T mysql bash -c 'mysqldump --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)") --single-transaction --routines --triggers --events --hex-blob --set-gtid-purged=OFF --databases solveit_indonesia' \
  | gzip > "$tmp/backup.sql.gz"
gzip -t "$tmp/backup.sql.gz" || fail "backup archive is corrupt"
size="$(wc -c < "$tmp/backup.sql.gz" | tr -d ' ')"
checksum="$(sha256sum "$tmp/backup.sql.gz" | cut -c1-16)"
[[ "$(gunzip -c "$tmp/backup.sql.gz" | grep -c 'CREATE.*TRIGGER')" -ge 2 ]] || fail "backup lacks the audit triggers"
# Counted, not grep -q: an early exit would break the pipe and, under pipefail, hide a match.
[[ "$(gunzip -c "$tmp/backup.sql.gz" | grep -ciE 'CREATE USER|GRANT ' || true)" == 0 ]] || fail "backup carries accounts or grants (provisioning belongs to initdb)"
pass "backup: $size bytes gzip, sha256 $checksum..., triggers included, no accounts or grants"

echo "== disaster: the drill project's MySQL container and volume are deleted"
compose rm --stop --force mysql > /dev/null 2>&1
docker volume rm "$volume" > /dev/null
if docker volume inspect "$volume" > /dev/null 2>&1; then fail "volume $volume still exists"; fi
pass "container and volume $volume removed"

echo "== recreate MySQL from nothing and restore"
compose up -d --wait mysql > /dev/null 2>&1
[[ "$(root_sql "-e \"SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'solveit_indonesia'\"")" == 0 ]] || fail "recreated database is not empty"
pass "new MySQL: users provisioned by initdb, database empty"
gunzip -c "$tmp/backup.sql.gz" | compose exec -T mysql bash -c 'mysql --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)")'
inventory > "$tmp/after"
diff "$tmp/before" "$tmp/after" > "$tmp/diff" || fail "restored data differs: $(cat "$tmp/diff")"
pass "row counts, table checksums, and both audit triggers identical to the inventory"
[[ "$(query "SELECT COUNT(*) FROM admin_audit_events WHERE action = 'drill.marker'")" -ge 1 ]] || fail "drill marker missing"
pass "drill marker restored"

echo "== restored database works for the application"
grants="$(root_sql "-e \"SHOW GRANTS FOR solveit_app\"")"
[[ "$grants" == *'GRANT SELECT, INSERT, UPDATE, DELETE ON `solveit\_indonesia`.*'* && "$grants" != *'ALL PRIVILEGES'* ]] || fail "application user grants: $grants"
for statement in "UPDATE admin_audit_events SET action = 'tampered'" "DELETE FROM admin_audit_events"; do
  output="$(as_app_user "$statement" || true)"
  [[ "$output" == *"append-only"* ]] || fail "restored audit log accepted: $statement ($output)"
done
pass "application user: DML only; audit log still append-only after the restore"
if compose --profile ops run --rm migrate php artisan migrate:status --no-ansi 2>&1 | grep -q Pending; then fail "migrations pending after the restore"; fi
pass "migrate:status: every migration ran, none pending"
compose up -d --wait backend > /dev/null 2>&1
for _ in $(seq 1 60); do
  [[ "$(curl -s -o "$tmp/up" -w '%{http_code}' "$public/up")" == 200 ]] && break
  sleep 1
done
[[ "$(cat "$tmp/up")" == '{"status":"ok"}' ]] || fail "/up after the restore: $(cat "$tmp/up")"
pass "backend healthy, /up answers"
echo "Recovery time in this drill: $(($(date +%s) - started)) s from stopping writes to a healthy backend."

echo "Backup and restore drill passed."
