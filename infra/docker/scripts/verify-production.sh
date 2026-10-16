#!/usr/bin/env bash
# Smoke test of a running production stack (infra/docker/compose.prod.yaml) with synthetic data.
# Used by .github/workflows/docker-ci.yml and for local QA; never point it at a real deployment
# with real data: it submits test inquiries.
#
#   SOLVEIT_PROD_PROJECT  Compose project name (default solveit-indonesia-prod)
#   SOLVEIT_BASE_URL      gateway URL (default http://127.0.0.1:8080)
#   SOLVEIT_SECRETS_DIR   secrets folder used by the stack (to read the MySQL root password)
#
# Exits non-zero on the first failed check.
# SC2016: single-quoted $ is intended; it must expand inside the containers, not on the host.
# shellcheck disable=SC2016
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
project="${SOLVEIT_PROD_PROJECT:-solveit-indonesia-prod}"
base="${SOLVEIT_BASE_URL:-http://127.0.0.1:8080}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

compose() { docker compose -p "$project" -f "$root/infra/docker/compose.prod.yaml" --profile bundled-db "$@"; }
pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*" >&2; exit 1; }

# status <expected> <description> <curl args...>: body in $tmp/body, headers in $tmp/headers
status() {
  local expected="$1" description="$2"; shift 2
  local actual
  actual="$(curl -sS -o "$tmp/body" -D "$tmp/headers" -w '%{http_code}' "$@")"
  [[ "$actual" == "$expected" ]] || fail "$description: expected $expected, got $actual"
  pass "$description ($actual)"
}
header() { grep -i "^$1:" "$tmp/headers" | head -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'; }
body_has() { grep -q -- "$1" "$tmp/body" || fail "$2"; }
body_lacks() { if grep -q -- "$1" "$tmp/body"; then fail "$2"; fi; }

echo "== runtime versions and image contents"
php_version="$(compose exec -T backend php -r 'echo PHP_VERSION;')"
compose exec -T backend php -r 'exit(PHP_VERSION_ID >= 80507 && PHP_VERSION_ID < 80600 ? 0 : 1);' || fail "PHP $php_version is not 8.5 >= 8.5.7"
pass "PHP $php_version (8.5, at least 8.5.7)"
for extension in bcmath intl mbstring pdo_mysql 'Zend OPcache'; do
  compose exec -T backend php -m | grep -qx "$extension" || fail "PHP extension $extension missing"
done
pass "PHP extensions bcmath intl mbstring pdo_mysql OPcache"
compose exec -T backend php -r 'exit(ini_get("expose_php") || ini_get("opcache.validate_timestamps") || ini_get("display_errors") ? 1 : 0);' \
  || fail "production php.ini not active"
pass "production php.ini (expose_php, display_errors, opcache.validate_timestamps off)"
laravel="$(compose exec -T backend php artisan --version)"
[[ "$laravel" == *"Laravel Framework 13."* ]] || fail "unexpected Laravel version: $laravel"
pass "$laravel"
[[ "$(compose exec -T backend id -u)" == 33 ]] || fail "backend does not run as www-data"
pass "backend runs as www-data (uid 33)"
compose exec -T backend sh -c 'test ! -e vendor/laravel/boost && test ! -e vendor/phpunit && test ! -e vendor/laravel/pint && test ! -e tests && test ! -e .env' \
  || fail "dev packages, tests, or .env present in the backend image"
if compose exec -T backend php artisan list --raw | grep -q '^boost:'; then fail "Boost commands present"; fi
pass "no Boost, PHPUnit, Pint, tests, or .env in the backend image"
compose exec -T backend sh -c '! touch /var/www/html/app/probe 2>/dev/null' || fail "application code is writable"
pass "application code is read-only"
# Whole filesystem: environment files, dumps, Composer auth, Git metadata. Application folders
# also: keys and certificates (the base images' CA bundles under /etc are expected).
app_dir() { [[ "$1" == backend ]] && echo /var/www/html || echo "/usr/share/nginx/html /etc/nginx"; }
for service in backend frontend; do
  found="$(compose exec -T "$service" sh -c "find / -xdev \( -path /proc -o -path /sys \) -prune -o \( -name '.env' -o -name '.env.*' -o -name '*.env' -o -name '*.sql' -o -name '*.sql.gz' -o -name '*.dump' -o -name 'auth.json' -o -name '.git' \) -print 2>/dev/null; find $(app_dir "$service") \( -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' -o -name 'secrets' \) -print 2>/dev/null" || true)"
  [[ -z "$found" ]] || fail "$service image contains secret-like files: $found"
done
pass "no .env, key, dump, or .git files in backend and frontend images"
if compose exec -T frontend sh -c 'command -v node || test -d /usr/share/nginx/html/node_modules'; then fail "Node or node_modules in the frontend image"; fi
pass "frontend image has no Node runtime or node_modules"

echo "== published ports"
for service in backend frontend mysql; do
  published="$(docker ps --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=$service" --format '{{.Ports}}')"
  [[ "$published" != *"->"* ]] || fail "$service publishes a port: $published"
done
pass "only the gateway publishes a port (backend, frontend, mysql: none)"

echo "== website"
status 200 "GET /" "$base/"
body_has '<html lang="id"' "home page is not the Indonesian page"
[[ "$(header Cache-Control)" == "no-cache" ]] || fail "HTML Cache-Control is not no-cache"
[[ "$(header X-Content-Type-Options)" == "nosniff" ]] || fail "missing X-Content-Type-Options"
[[ -z "$(header X-Powered-By)" ]] || fail "X-Powered-By is exposed"
[[ "$(header Server)" == "nginx" ]] || fail "Server header exposes a version: $(header Server)"
pass "HTML headers: no-cache, nosniff, no version banner"
asset="$(grep -o '/assets/[A-Za-z0-9_.-]*\.css' "$tmp/body" | head -1)"
status 200 "GET /en/" "$base/en/"
body_has '<html lang="en"' "/en/ is not the English page"
status 200 "GET /kontak" "$base/kontak"
body_lacks 'name="homepage"' "the inquiry API channel is enabled in the default production build"
pass "inquiry API channel absent (VITE_INQUIRY_API_ENABLED=false)"
status 200 "GET /en/contact" "$base/en/contact"
status 404 "GET /halaman-tidak-ada" "$base/halaman-tidak-ada"
body_has '<html lang="id"' "Indonesian 404 page not served"
status 404 "GET /en/missing-page" "$base/en/missing-page"
body_has '<html lang="en"' "English 404 page not served under /en/"
status 404 "GET /404.html is not a 200 page" "$base/404.html"
[[ -n "$asset" ]] || fail "no stylesheet found in the home page"
status 200 "GET $asset" -H 'Accept-Encoding: gzip' "$base$asset"
[[ "$(header Cache-Control)" == "public, max-age=31536000, immutable" ]] || fail "asset is not cached immutably"
[[ "$(header Content-Type)" == text/css* ]] || fail "asset MIME type: $(header Content-Type)"
[[ "$(header Content-Encoding)" == "gzip" ]] || fail "asset not compressed"
pass "hashed asset: immutable cache, text/css, gzip"
status 404 "no health endpoint on the public port (GET /healthz)" "$base/healthz"

echo "== API"
status 200 "GET /up" "$base/up"
[[ "$(cat "$tmp/body")" == '{"status":"ok"}' ]] || fail "/up body: $(cat "$tmp/body")"
status 405 "GET /api/v1/inquiries" -H 'Accept: application/json' "$base/api/v1/inquiries"
body_lacks 'trace' "stack trace in an error response"
# A random UUID v4, generated in the backend container so the host needs no extra tool.
key="$(compose exec -T backend php -r '$b = random_bytes(16); $b[6] = chr(ord($b[6]) & 0x0f | 0x40); $b[8] = chr(ord($b[8]) & 0x3f | 0x80); echo vsprintf("%s%s-%s-%s-%s-%s%s%s", str_split(bin2hex($b), 4));')"
payload='{"name":"Smoke Test","contact":"smoke@example.com","service":"website","budget":"belum-tahu","timeline":"fleksibel","message":"Automated production smoke test of the inquiry endpoint."}'
json=(-H 'Content-Type: application/json' -H 'Accept: application/json')
status 201 "POST inquiry with Idempotency-Key" "${json[@]}" -H "Idempotency-Key: $key" -d "$payload" "$base/api/v1/inquiries"
grep -Eq '^\{"id":"INQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}","status":"received"\}$' "$tmp/body" || fail "unexpected 201 body"
[[ -z "$(header Set-Cookie)" ]] || fail "the public inquiry API set a cookie"
pass "inquiry response sets no cookie (stateless public API)"
first="$(cat "$tmp/body")"
status 201 "retry with the same key" "${json[@]}" -H "Idempotency-Key: $key" -d "$payload" "$base/api/v1/inquiries"
[[ "$(cat "$tmp/body")" == "$first" && "$(header Idempotent-Replayed)" == "true" ]] || fail "retry did not return the stored reference"
status 409 "same key, different content" "${json[@]}" -H "Idempotency-Key: $key" -d "${payload/Automated/Changed}" "$base/api/v1/inquiries"
status 400 "malformed Idempotency-Key" "${json[@]}" -H "Idempotency-Key: not-a-uuid" -d "$payload" "$base/api/v1/inquiries"
status 422 "invalid payload" "${json[@]}" -d '{}' "$base/api/v1/inquiries"
# Five attempts so far from this address: the per-minute limit (5) now applies, retries included.
status 429 "rate limit after five attempts" "${json[@]}" -H "Idempotency-Key: $key" -d "$payload" "$base/api/v1/inquiries"
[[ -n "$(header Retry-After)" ]] || fail "429 without Retry-After"

echo "== admin isolation (B3.1a, B3.1b: the admin API is not served on the public listener)"
# --path-as-is keeps curl from normalising the spellings before nginx sees them.
for path in \
  /api/v1/admin /api/v1/admin/ /api/v1/admin/auth/csrf-cookie /api/v1/admin/auth/login \
  /API/V1/ADMIN/auth/login /api/v1/Admin/me /api//v1//admin/auth/csrf-cookie \
  /api/v1/%61dmin/auth/csrf-cookie /api/v1/admin%2Fauth/login /api/v1/./admin/me \
  /api/v1/inquiries/../admin/auth/csrf-cookie \
  /api/v1/admin/users /api/v1/admin/invitations /api/v1/admin/audit-events /api/v1/admin/users/1/credential-reset; do
  for method in GET POST; do
    status 404 "$method $path on the public listener" --path-as-is -X "$method" -H 'Accept: application/json' -H "Origin: $base" "$base$path"
    [[ -z "$(header Set-Cookie)" ]] || fail "$method $path set a cookie"
  done
done
status 404 "Sanctum CSRF path does not exist" --path-as-is "$base/sanctum/csrf-cookie"
session_config="$(compose exec -T backend php -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); echo json_encode([config("session.driver"), config("session.cookie"), config("session.secure"), config("session.same_site"), config("session.http_only"), config("session.encrypt"), config("session.lifetime"), config("session.domain")]);')"
[[ "$session_config" == '["database","__Host-solveit-admin-session",true,"strict",true,true,30,null]' ]] || fail "admin session configuration: $session_config"
pass "admin sessions: database, __Host- cookie, Secure, SameSite=Strict, HttpOnly, encrypted, 30 min idle, no Domain"

echo "== restart"
compose restart backend > /dev/null 2>&1
compose up -d --wait backend > /dev/null 2>&1
status 200 "GET /up after a backend restart" "$base/up"

echo "== database"
rows="$(compose exec -T mysql bash -c 'mysql --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)") -N -e "SELECT VERSION(), (SELECT COUNT(*) FROM solveit_indonesia.inquiries)"')"
[[ "$rows" == 8.4.*$'\t'1 ]] || fail "expected MySQL 8.4 and exactly one stored inquiry, got: $rows"
pass "MySQL $(cut -f1 <<< "$rows"), exactly one inquiry stored (after a retry, a conflict, and a restart)"
grants="$(compose exec -T mysql bash -c 'mysql --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(cat /run/secrets/mysql_root_password)") -N --raw -e "SHOW GRANTS FOR solveit_app"')"
[[ "$grants" == *'GRANT SELECT, INSERT, UPDATE, DELETE ON `solveit\_indonesia`.*'* && "$grants" != *'ALL PRIVILEGES'* ]] || fail "application user grants: $grants"
pass "application user has DML only on solveit_indonesia"
# The application user may append audit events but never change or remove one: the triggers
# created by the migration user refuse UPDATE and DELETE for every account.
as_app_user() { compose exec -T mysql bash -c "mysql --defaults-extra-file=<(printf \"[client]\nuser=solveit_app\npassword=%s\n\" \"\$(cat /run/secrets/db_app_password)\") -N solveit_indonesia -e \"$1\"" 2>&1; }
as_app_user "INSERT INTO admin_audit_events (action, actor_type) VALUES ('smoke.test', 'cli')" > /dev/null || fail "application user cannot append an audit event"
for statement in "UPDATE admin_audit_events SET action = 'tampered'" "DELETE FROM admin_audit_events"; do
  output="$(as_app_user "$statement" || true)"
  [[ "$output" == *"append-only"* ]] || fail "audit log accepted: $statement ($output)"
done
# TRUNCATE is DDL and fires no trigger, so it must need a privilege the application user lacks.
output="$(as_app_user "TRUNCATE TABLE admin_audit_events" || true)"
[[ "$output" == *"denied"* ]] || fail "application user may truncate the audit log ($output)"
[[ "$(as_app_user "SELECT COUNT(*) FROM admin_audit_events WHERE action = 'smoke.test'")" == 1 ]] || fail "audit event missing after refused changes"
pass "audit log is append-only for the application user (UPDATE, DELETE, and TRUNCATE refused)"

echo "All production smoke checks passed."
