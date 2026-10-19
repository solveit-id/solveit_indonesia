#!/usr/bin/env bash
# Negative tests of the local team demo's safety (B5a): check-demo-stack.sh and every
# manage-demo.sh command that changes something must refuse unsafe input or an unsafe stack, and
# the smoke tests and restore drill must refuse the demo stack. Runs against a running demo
# rehearsal stack (never the owner's demo): .github/workflows/docker-ci.yml and local QA.
#
#   SOLVEIT_DEMO_PROJECT  the rehearsal project: solveit-demo-<suffix>; solveit-demo itself is
#                         refused here, so the owner's demo data is never touched by a test
#   SOLVEIT_DEMO_HOME     its state folder; plus the same port and tag settings manage-demo.sh
#                         was started with
#
# A snapshot of the project's containers, start times, row counts, and volumes taken before and
# after each group proves that a refusal changed nothing. Unsafe states are created one at a
# time (a stray container, a non-synthetic row, an edited copy of the state folder) and undone
# before the next.
# SC2016: single-quoted $ is intended; it must expand inside the containers, not on the host.
# shellcheck disable=SC2016
set -euo pipefail
export MSYS_NO_PATHCONV=1

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo="$(cd "$here/../../.." && pwd -P)"
manage="$here/manage-demo.sh"
guard="$here/check-demo-stack.sh"
project="${SOLVEIT_DEMO_PROJECT:-}"
home="${SOLVEIT_DEMO_HOME:-}"
tmp="$(mktemp -d)"
stray=()
cleanup() {
  ((${#stray[@]})) && docker rm -f "${stray[@]}" > /dev/null 2>&1
  rm -rf "$tmp"
}
trap cleanup EXIT

pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*" >&2; exit 1; }

[[ "$project" =~ ^solveit-demo-[a-z0-9]+$ ]] || fail "SOLVEIT_DEMO_PROJECT must be a rehearsal project solveit-demo-<suffix> (got '$project'); the owner's solveit-demo is never tested"
[[ -n "$home" && -d "$home" ]] || fail "SOLVEIT_DEMO_HOME must be the rehearsal stack's state folder"

echo "== positive control: the guard and check accept the rehearsal stack"
bash "$guard" stack > "$tmp/out" 2>&1 || { cat "$tmp/out" >&2; fail "the guard refuses the rehearsal stack; fix it before testing refusals"; }
pass "guard accepts $project ($(grep -c 'DEMO GUARD ok' "$tmp/out") checks)"

mysql_exec() {
  docker exec "$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=mysql")" \
    bash -c "mysql --defaults-extra-file=<(printf \"[client]\nuser=root\npassword=%s\n\" \"\$(cat /run/secrets/mysql_root_password)\") -N solveit_indonesia -e \"$1\""
}
snapshot() {
  docker ps -a --filter "label=com.docker.compose.project=$project" --format '{{.ID}} {{.Names}} {{.Image}}' | sort
  docker ps -q --filter "label=com.docker.compose.project=$project" | xargs docker inspect -f '{{.Name}} {{.State.StartedAt}} {{.RestartCount}}' | sort
  mysql_exec "SELECT (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM inquiries), (SELECT COUNT(*) FROM admin_audit_events), (SELECT COUNT(*) FROM admin_access_links), (SELECT COUNT(*) FROM inquiry_notes)"
  docker volume ls -q --filter "label=com.docker.compose.project=$project" | sort
  sed -n 's/^ADMIN_URL=//p' "$home/demo.env"
}
same_as_before() {
  snapshot > "$tmp/after"
  diff -q "$tmp/before" "$tmp/after" > /dev/null || { diff "$tmp/before" "$tmp/after" >&2; fail "$1: something changed"; }
  pass "$1: containers, start times, rows, volumes, and ADMIN_URL unchanged"
}

# refused <reason regex> <description> <command...>: must fail and name the reason.
refused() {
  local reason="$1" description="$2"; shift 2
  if "$@" > "$tmp/out" 2>&1 < /dev/null; then fail "$description: ACCEPTED"; fi
  grep -qE -- "$reason" "$tmp/out" || fail "$description: refused, but not for '$reason': $(grep -E 'REFUSED|GAGAL|FAIL' "$tmp/out" | head -2 | tr '\n' ' ')"
  pass "$description"
}
in_env() {
  (
    while [[ "$1" != -- ]]; do export "${1?}"; shift; done
    shift
    "$@"
  )
}

snapshot > "$tmp/before"

echo "== names: never the development, production, or a non-demo project"
for name in solveit-indonesia solveit-indonesia-prod solveit-ci-prod solveit-demo_qa demo Solveit-Demo; do
  refused "bukan project demo|not a demo project" "manage-demo refuses project '$name'" in_env "SOLVEIT_DEMO_PROJECT=$name" -- bash "$manage" status
  refused "not a demo project" "guard refuses project '$name'" in_env "SOLVEIT_DEMO_PROJECT=$name" -- bash "$guard" config
done
refused "SOLVEIT_DEMO_PROJECT is not set" "guard refuses a missing project" env -u SOLVEIT_DEMO_PROJECT bash "$guard" config
same_as_before "name refusals"

echo "== state folder: outside the repository, marked for this project"
refused "di dalam repository" "prepare refuses a state folder inside the repository" in_env "SOLVEIT_DEMO_HOME=$repo/infra/docker/demo-state-test" -- bash "$manage" prepare
[[ ! -e "$repo/infra/docker/demo-state-test" ]] || fail "prepare created a folder inside the repository before refusing"
pass "nothing was created inside the repository"
refused "inside the repository" "guard refuses the repository as state folder" in_env "SOLVEIT_DEMO_HOME=$repo" -- bash "$guard" config
mkdir -p "$tmp/other"
printf 'solveit-demo-other\n' > "$tmp/other/.solveit-demo-project"
refused "milik project demo lain" "prepare refuses a folder marked for another demo project" in_env "SOLVEIT_DEMO_HOME=$tmp/other" -- bash "$manage" prepare
refused "not marked for project" "guard refuses a folder marked for another demo project" in_env "SOLVEIT_DEMO_HOME=$tmp/other" -- bash "$guard" config
mkdir -p "$tmp/occupied" && : > "$tmp/occupied/production.env"
refused "sudah berisi file lain" "prepare refuses a folder that already holds other files" in_env "SOLVEIT_DEMO_HOME=$tmp/occupied" -- bash "$manage" prepare
[[ ! -e "$tmp/occupied/.solveit-demo-project" ]] || fail "prepare marked a folder that held other files"
same_as_before "state folder refusals"

echo "== env file: demo origins only, own database, nothing trusted"
tampered() {
  rm -rf "$tmp/copy" && cp -R "$home" "$tmp/copy"
  sed -i "$1" "$tmp/copy/demo.env"
}
check_env_refusal() {
  local reason="$1" description="$2" edit="$3"
  tampered "$edit"
  refused "$reason" "guard refuses $description" in_env "SOLVEIT_DEMO_HOME=$tmp/copy" -- bash "$guard" config
  refused "$reason" "seed refuses $description" in_env "SOLVEIT_DEMO_HOME=$tmp/copy" -- bash "$manage" seed
  refused "$reason" "owner refuses $description" in_env "SOLVEIT_DEMO_HOME=$tmp/copy" -- bash "$manage" owner probe@example.test
  refused "$reason" "start refuses $description" in_env "SOLVEIT_DEMO_HOME=$tmp/copy" -- bash "$manage" start
}
check_env_refusal "is neither a Quick Tunnel origin" "a real-looking admin origin" 's#^ADMIN_URL=.*#ADMIN_URL=https://admin.solveit.co.id#'
check_env_refusal "is neither a Quick Tunnel origin" "a plain http admin origin" 's#^ADMIN_URL=.*#ADMIN_URL=http://admin.'"$project"'.localhost:8543#'
check_env_refusal "is neither a Quick Tunnel origin" "a lookalike tunnel origin" 's#^ADMIN_URL=.*#ADMIN_URL=https://abc-def.trycloudflare.com.evil.example#'
check_env_refusal "is neither a Quick Tunnel origin" "Cloudflare's own login host" 's#^ADMIN_URL=.*#ADMIN_URL=https://login.trycloudflare.com#'
check_env_refusal "is not a local origin" "a public website origin" 's#^APP_URL=.*#APP_URL=https://solveit.co.id#'
check_env_refusal "DB_HOST is" "an external database host" 's#^DB_HOST=.*#DB_HOST=host.docker.internal#'
check_env_refusal "not marked SOLVEIT_DEMO" "a missing demo marker" '/^SOLVEIT_DEMO=/d'
check_env_refusal "TRUSTED_PROXIES must stay empty" "trusted proxies" 's#^TRUSTED_PROXIES=.*#TRUSTED_PROXIES=*#'
check_env_refusal "CORS_ALLOWED_ORIGINS must stay empty" "CORS origins" 's#^CORS_ALLOWED_ORIGINS=.*#CORS_ALLOWED_ORIGINS=https://evil.example#'
rm -rf "$tmp/copy" && cp -R "$home" "$tmp/copy" && rm -f "$tmp/copy/secrets/app_key"
refused "secret app_key is missing" "guard refuses a state folder without a secret" in_env "SOLVEIT_DEMO_HOME=$tmp/copy" -- bash "$guard" config
rm -rf "$tmp/copy"
same_as_before "env file refusals"

echo "== input: tunnel URLs and account addresses"
for url in "" "http://abc-def.trycloudflare.com" "https://evil.example" "https://login.trycloudflare.com" \
  "https://abc-def.trycloudflare.com.evil.example" "https://abc-def.trycloudflare.com/path" "https://abc-def.trycloudflare.com:8443"; do
  refused "berikan URL Quick Tunnel lengkap" "tunnel refuses '$url'" bash "$manage" tunnel "$url"
done
for email in owner@gmail.com pemilik@solveit.co.id "x@example.test.evil" ""; do
  refused "domain contoh example.test|domain example.test" "owner refuses '$email'" bash "$manage" owner "$email"
  refused "domain example.test" "recover refuses '$email'" bash "$manage" recover "$email"
done
same_as_before "input refusals"

echo "== tunnel protection probe: only Cloudflare's email sign-in counts as protected"
printf '<!doctype html><div id="root"></div>' > "$tmp/console.html"
printf '{"message":"Misdirected Request."}' > "$tmp/misdirected.json"
printf 'error code: 1033' > "$tmp/cloudflare-error.txt"
: > "$tmp/empty"
host=calm-river-sample-words.trycloudflare.com
classified() {
  local expected="$1" description="$2" actual
  # In a subshell: manage-demo.sh only defines its functions when sourced.
  # shellcheck disable=SC1090
  actual="$(source "$manage" && classify_probe "${@:3}")"
  [[ "$actual" == "$expected" ]] || fail "probe: $description: expected $expected, got $actual"
  pass "probe: $description is $expected"
}
classified protected "302 to login.trycloudflare.com" 302 "https://login.trycloudflare.com/authorize?state=x" "$tmp/empty" "$host"
classified protected "302 to a cloudflareaccess.com team" 302 "https://team.cloudflareaccess.com/cdn-cgi/access/login" "$tmp/empty" "$host"
classified unprotected "the console HTML" 200 "" "$tmp/console.html" "$host"
classified unprotected "the listener's 421" 421 "" "$tmp/misdirected.json" "$host"
classified unprotected "a redirect whose body is the console" 302 "https://$host/masuk" "$tmp/console.html" "$host"
classified unknown "a redirect to the tunnel host itself" 302 "https://$host/masuk" "$tmp/empty" "$host"
classified unknown "a redirect to another Quick Tunnel" 302 "https://other-words-here.trycloudflare.com/" "$tmp/empty" "$host"
classified unknown "a redirect to a lookalike host" 302 "https://login.trycloudflare.com.evil.example/" "$tmp/empty" "$host"
classified unknown "a plain-http redirect" 302 "http://login.trycloudflare.com/" "$tmp/empty" "$host"
classified unknown "200 with another body" 200 "" "$tmp/cloudflare-error.txt" "$host"
classified retry "no answer" 000 "" "$tmp/empty" "$host"
classified retry "Cloudflare 530 (tunnel not ready)" 530 "" "$tmp/cloudflare-error.txt" "$host"

echo "== the running stack: unsafe states one at a time"
consumers_refuse() {
  local reason="$1" description="$2"
  refused "$reason" "guard refuses $description" bash "$guard" stack
  refused "$reason" "seed refuses $description" bash "$manage" seed
  refused "$reason" "owner refuses $description" bash "$manage" owner probe@example.test
  refused "$reason" "check refuses $description" bash "$manage" check
}

image="$(docker inspect -f '{{.Config.Image}}' "$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=admin-gateway")")"
stray+=("$(docker run -d --rm --label "com.docker.compose.project=$project" --label com.docker.compose.service=stray "$image")")
consumers_refuse "was not started with compose.prod.demo.yaml" "a container started without the demo override"
docker rm -f "${stray[-1]}" > /dev/null
stray+=("$(docker run -d --rm --label "com.docker.compose.project=$project" --label com.docker.compose.service=gateway --label org.solveit.environment=demo "$image")")
consumers_refuse "the public gateway is running" "a running public gateway (public inquiry API)"
docker rm -f "${stray[-1]}" > /dev/null
stray+=("$(docker run -d --rm -p 0.0.0.0:18999:8080 --label "com.docker.compose.project=$project" --label com.docker.compose.service=stray --label org.solveit.environment=demo "$image")")
consumers_refuse "publishes beyond 127.0.0.1" "a port published beyond loopback"
docker rm -f "${stray[-1]}" > /dev/null
same_as_before "stray container refusals (each removed again)"

mysql_exec "INSERT INTO users (name, email, password, created_at, updated_at) VALUES ('Bukan Sintetis', 'seseorang@gmail.com', 'x', NOW(), NOW())"
consumers_refuse "account\\(s\\) outside @example.test" "an account outside example.test"
refused "account\\(s\\) outside @example.test" "reset refuses a database with a non-synthetic account" bash "$manage" reset "--yes=$project"
docker volume inspect "${project}_mysql-data" > /dev/null || fail "reset removed the volume although it refused"
mysql_exec "DELETE FROM users WHERE email = 'seseorang@gmail.com'"
same_as_before "non-synthetic account refusal (row removed again)"

admin_url="$(sed -n 's/^ADMIN_URL=//p' "$home/demo.env" | tail -1)"
if [[ "$admin_url" == *.trycloudflare.com ]]; then
  echo "== forwarded addresses: trusted only from the cloudflared path"
  gateway="$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=admin-gateway")"
  backend="$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=backend")"
  marker="demo-forged-$RANDOM$RANDOM"
  # From the backend container (admin-internal network, not the trusted loopback path).
  docker exec -e HOST="${admin_url#https://}" -e MARKER="$marker" "$backend" php -r '
    @file_get_contents("http://admin-gateway:8080/".getenv("MARKER"), false, stream_context_create(["http" => [
      "header" => "Host: ".getenv("HOST")."\r\nX-Forwarded-For: 203.0.113.99\r\n", "ignore_errors" => true]]));' || true
  sleep 1
  seen="$(docker logs --since 2m "$gateway" 2>&1 | grep -F "/$marker " | tail -1 | cut -d' ' -f1)"
  [[ -n "$seen" ]] || fail "the forged request did not reach admin-gateway (no log line)"
  [[ "$seen" != 203.0.113.99 ]] || fail "admin-gateway believed X-Forwarded-For from an untrusted peer"
  pass "X-Forwarded-For from an untrusted peer ($seen) is ignored"
fi

echo "== the smoke tests and the restore drill refuse the demo stack"
refused "REFUSED" "check-synthetic-stack refuses the demo project" \
  in_env "SOLVEIT_PROD_PROJECT=$project" "SOLVEIT_ENV_FILE=$home/demo.env" "SOLVEIT_SECRETS_DIR=$home/secrets" -- bash "$here/check-synthetic-stack.sh"
refused "guard refused this stack" "verify-admin refuses the demo project" \
  in_env "SOLVEIT_PROD_PROJECT=$project" "SOLVEIT_ENV_FILE=$home/demo.env" "SOLVEIT_SECRETS_DIR=$home/secrets" -- bash "$here/verify-admin.sh"
refused "REFUSED|guard" "drill-backup-restore refuses the demo project" \
  in_env "SOLVEIT_DRILL_PROJECT=$project" "SOLVEIT_PROD_PROJECT=$project" "SOLVEIT_ENV_FILE=$home/demo.env" "SOLVEIT_SECRETS_DIR=$home/secrets" -- bash "$here/drill-backup-restore.sh"
same_as_before "smoke test and drill refusals"

echo "== reset needs the exact project name"
refused "konfirmasi tidak cocok" "reset refuses a wrong confirmation" bash "$manage" reset --yes=solveit-demo
refused "konfirmasi tidak cocok" "reset refuses an empty confirmation" bash "$manage" reset
same_as_before "reset refusals"

echo "== positive control again"
bash "$guard" stack > /dev/null 2>&1 || fail "the guard no longer accepts the stack after the tests"
pass "guard still accepts $project; every unsafe change was undone"
