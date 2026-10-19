#!/usr/bin/env bash
# Negative tests of the fail-closed guard (check-synthetic-stack.sh) on a running throwaway stack
# (compose.prod.yaml, compose.prod.admin-tls.yaml, profiles bundled-db and admin), run before the
# smoke tests by .github/workflows/docker-ci.yml and for local QA.
#
# Part 1: every consumer (verify-production.sh, verify-admin.sh, drill-backup-restore.sh, and
# the Playwright production test) is started with an unsafe or missing setting and must refuse
# for that reason. A snapshot of container IDs, start times, and row counts taken before and
# after proves that nothing ran: no account was bootstrapped, nothing restarted or re-tagged,
# no row was written.
# Part 2: the stack itself is made unsafe one way at a time (a non-synthetic account row, a real
# looking admin or website origin, an external database host, a port beyond 127.0.0.1); the
# guard and a consumer must refuse, and each change is undone before the next.
#
# Needs the same environment as the smoke tests: SOLVEIT_PROD_PROJECT, SOLVEIT_ENV_FILE,
# SOLVEIT_SECRETS_DIR, SOLVEIT_ADMIN_URL, SOLVEIT_IMAGE_TAG, and admin/node_modules (Playwright).
# It refuses to start unless the guard accepts that environment first.
# SC2016: single-quoted $ is intended; it must expand inside the containers, not on the host.
# shellcheck disable=SC2016
set -euo pipefail
export MSYS_NO_PATHCONV=1

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../.." && { pwd -W 2> /dev/null || pwd; })"
guard="$here/check-synthetic-stack.sh"
project="${SOLVEIT_PROD_PROJECT:-}"
tmp="$(cd "$(mktemp -d)" && { pwd -W 2> /dev/null || pwd; })"
trap 'rm -rf "$tmp"' EXIT

pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*" >&2; exit 1; }

echo "== positive control: the guard accepts this throwaway stack"
bash "$guard" > "$tmp/guard" 2>&1 || { cat "$tmp/guard" >&2; fail "the guard refuses this environment; fix it before testing refusals"; }
pass "guard accepts $project ($(grep -c 'GUARD ok' "$tmp/guard") checks)"

compose() {
  docker compose -p "$project" -f "$root/infra/docker/compose.prod.yaml" \
    -f "$root/infra/docker/compose.prod.admin-tls.yaml" --profile bundled-db --profile admin "$@"
}
root_sql() { docker exec "$(compose ps -q mysql)" bash -c "mysql --defaults-extra-file=<(printf \"[client]\nuser=root\npassword=%s\n\" \"\$(cat /run/secrets/mysql_root_password)\") -N solveit_indonesia -e \"$1\""; }
snapshot() {
  docker ps -a --filter "label=com.docker.compose.project=$project" --format '{{.ID}} {{.Names}} {{.Image}}' | sort
  docker ps -q --filter "label=com.docker.compose.project=$project" | xargs docker inspect -f '{{.Name}} {{.State.StartedAt}} {{.RestartCount}}' | sort
  root_sql "SELECT (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM inquiries), (SELECT COUNT(*) FROM admin_audit_events), (SELECT COUNT(*) FROM admin_access_links)"
  docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^solveit-indonesia/' | sort
}

# refused <reason regex> <description> <command...>: the command must fail and name the reason.
refused() {
  local reason="$1" description="$2"; shift 2
  if "$@" > "$tmp/out" 2>&1; then fail "$description: ACCEPTED"; fi
  grep -qE -- "$reason" "$tmp/out" || fail "$description: refused, but not for '$reason': $(grep -E 'REFUSED|Error|FAIL' "$tmp/out" | head -2 | tr '\n' ' ')"
  pass "$description"
}

verify_production() { bash "$here/verify-production.sh"; }
verify_admin() { bash "$here/verify-admin.sh"; }
drill() { SOLVEIT_DRILL_PROJECT="${SOLVEIT_PROD_PROJECT:-}" bash "$here/drill-backup-restore.sh"; }
playwright() { (cd "$root/admin" && npx playwright test --config playwright.production.config.ts); }
consumers=(verify_production verify_admin drill playwright)

# in_env [-u NAME | NAME=value]... -- <command...>: run in a subshell with those changes.
in_env() {
  (
    while [[ "$1" != -- ]]; do
      if [[ "$1" == -u ]]; then unset "$2"; shift 2; else export "${1?}"; shift; fi
    done
    shift
    "$@"
  )
}

# every_consumer <reason> <description> <in_env changes...>
every_consumer() {
  local reason="$1" description="$2"; shift 2
  local consumer
  for consumer in "${consumers[@]}"; do
    refused "$reason" "$consumer refuses: $description" in_env "$@" -- "$consumer"
  done
}

echo "== part 1: unsafe settings, every consumer refuses before acting"
snapshot > "$tmp/before"
users_before="$(root_sql "SELECT COUNT(*) FROM users")"
every_consumer 'SOLVEIT_PROD_PROJECT is not set|set SOLVEIT_DRILL_PROJECT' "no project named (no default)" -u SOLVEIT_PROD_PROJECT
every_consumer 'development or production project' "the production project solveit-indonesia-prod" SOLVEIT_PROD_PROJECT=solveit-indonesia-prod
refused 'development or production project' "guard refuses the development project solveit-indonesia" in_env SOLVEIT_PROD_PROJECT=solveit-indonesia -- bash "$guard"
every_consumer 'not marked as throwaway' "a project not marked as throwaway (solveit-staging)" SOLVEIT_PROD_PROJECT=solveit-staging
every_consumer 'no running backend' "a throwaway name with no such stack" SOLVEIT_PROD_PROJECT=solveit-absent-smoke
every_consumer 'SOLVEIT_ENV_FILE is not set' "no env file named (the default is the real production.env)" -u SOLVEIT_ENV_FILE
refused 'name of the real configuration' "guard refuses an env file named production.env" in_env SOLVEIT_ENV_FILE=./production.env -- bash "$guard"
refused 'inside the repository' "guard refuses the env template inside the repository" in_env SOLVEIT_ENV_FILE=./production.env.example -- bash "$guard"
every_consumer 'SOLVEIT_SECRETS_DIR is not set' "no secrets folder named (the default is the real secrets/)" -u SOLVEIT_SECRETS_DIR
refused 'inside the repository' "guard refuses the repository's secrets folder" in_env SOLVEIT_SECRETS_DIR=./secrets -- bash "$guard"
refused 'reserved .test host' "Playwright refuses a non-test admin origin" in_env SOLVEIT_ADMIN_URL=https://admin.example.com -- playwright
refused 'reserved .test host' "guard refuses a non-test SOLVEIT_ADMIN_URL" in_env SOLVEIT_ADMIN_URL=https://admin.example.com -- bash "$guard"
refused "differs from the backend" "Playwright refuses an admin origin other than the stack's" in_env SOLVEIT_ADMIN_URL=https://other.solveit.test:8443 -- playwright
refused "differs from the backend" "verify-admin refuses an admin origin other than the stack's" in_env SOLVEIT_ADMIN_URL=https://other.solveit.test:8443 -- verify_admin
snapshot > "$tmp/after"
diff "$tmp/before" "$tmp/after" > "$tmp/diff" || fail "a refused run changed the stack: $(cat "$tmp/diff")"
[[ "$users_before" == "$(root_sql "SELECT COUNT(*) FROM users")" ]] || fail "an account was created"
pass "snapshot identical after every refusal: same containers, start times, images, and row counts (no owner bootstrapped, nothing restarted or re-tagged)"

echo "== part 2: an unsafe stack is refused"
root_sql "INSERT INTO users (name, email, password) VALUES ('Guard probe', 'person@mail.invalid', 'not-a-hash')"
refused 'non-synthetic account or inquiry' "guard refuses a stack holding a non-synthetic account" bash "$guard"
refused 'non-synthetic account or inquiry' "drill refuses it before deleting anything" drill
root_sql "DELETE FROM users WHERE email = 'person@mail.invalid'"
pass "probe row removed"

# with_backend_env <NAME=value>: recreate the backend from a modified copy of the env file.
with_backend_env() {
  sed "s#^${1%%=*}=.*#$1#" "$SOLVEIT_ENV_FILE" > "$tmp/unsafe.env"
  grep -q "^$1\$" "$tmp/unsafe.env" || echo "$1" >> "$tmp/unsafe.env"
  SOLVEIT_ENV_FILE="$tmp/unsafe.env" compose up -d --no-deps --force-recreate --wait backend > /dev/null 2>&1
}
restore_backend() { compose up -d --no-deps --force-recreate --wait backend > /dev/null 2>&1; }
with_backend_env ADMIN_URL=https://admin.example.com
refused 'ADMIN_URL .* not on a reserved .test host' "guard refuses a backend whose ADMIN_URL is not a .test host" bash "$guard"
refused 'ADMIN_URL .* not on a reserved .test host' "verify-admin refuses it" verify_admin
with_backend_env APP_URL=https://www.example.com
refused 'APP_URL .* not a local or .test origin' "guard refuses a backend whose APP_URL is a public origin" bash "$guard"
with_backend_env DB_HOST=db.example.com
refused 'DB_HOST=db.example.com' "guard refuses a backend on an external database" bash "$guard"
refused 'DB_HOST=db.example.com' "verify-production refuses it" verify_production
restore_backend
pass "backend recreated with the original env file"
SOLVEIT_HTTP_BIND=127.0.0.2 compose up -d --no-deps --force-recreate --wait gateway > /dev/null 2>&1
refused 'publishes beyond 127.0.0.1' "guard refuses a port published beyond 127.0.0.1 (127.0.0.2)" bash "$guard"
compose up -d --no-deps --force-recreate --wait gateway > /dev/null 2>&1
pass "gateway back on 127.0.0.1"

echo "== the stack is safe again"
bash "$guard" > "$tmp/guard" 2>&1 || { cat "$tmp/guard" >&2; fail "the guard no longer accepts the restored stack"; }
[[ "$users_before" == "$(root_sql "SELECT COUNT(*) FROM users")" ]] || fail "account count changed"
pass "guard accepts the restored stack; account count unchanged ($users_before)"
echo "All safety guard tests passed."
