#!/usr/bin/env bash
# Smoke test of the private admin listener (B3.2d) on a running production stack started with
# compose.prod.yaml, compose.prod.admin-tls.yaml, and the profiles bundled-db and admin. Synthetic
# data only: used by .github/workflows/docker-ci.yml and for local QA, never against a real
# deployment. It stops, restarts, and re-tags containers of the project it is given (failure and
# rollback rehearsal), and leaves the stack running and healthy on the original image tag.
#
#   SOLVEIT_PROD_PROJECT      Compose project name (default solveit-indonesia-prod)
#   SOLVEIT_BASE_URL          public gateway URL (default http://127.0.0.1:8080)
#   SOLVEIT_ADMIN_HTTP_URL    plain admin listener URL (default http://127.0.0.1:8090)
#   SOLVEIT_ADMIN_TLS_IP      address the TLS admin listener is published on (default 127.0.0.1;
#                             its port is the port of ADMIN_URL)
#   SOLVEIT_IMAGE_TAG         image tag of the running stack (default local)
#
# ADMIN_URL is read from the running backend, the value Laravel checks Host and Origin against.
# Exits non-zero on the first failed check.
# SC2016: single-quoted $ is intended; it must expand inside the containers, not on the host.
# shellcheck disable=SC2016
set -euo pipefail
# Git Bash on Windows would rewrite container paths such as /usr/share/nginx/html, so path
# conversion is off and the repository path is given to Docker in Windows form (pwd -W).
export MSYS_NO_PATHCONV=1

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && { pwd -W 2> /dev/null || pwd; })"
project="${SOLVEIT_PROD_PROJECT:-solveit-indonesia-prod}"
public="${SOLVEIT_BASE_URL:-http://127.0.0.1:8080}"
plain="${SOLVEIT_ADMIN_HTTP_URL:-http://127.0.0.1:8090}"
tls_ip="${SOLVEIT_ADMIN_TLS_IP:-127.0.0.1}"
tag="${SOLVEIT_IMAGE_TAG:-local}"
tmp="$(cd "$(mktemp -d)" && { pwd -W 2> /dev/null || pwd; })"
trap 'rm -rf "$tmp"' EXIT

compose() {
  docker compose -p "$project" -f "$root/infra/docker/compose.prod.yaml" \
    -f "$root/infra/docker/compose.prod.admin-tls.yaml" --profile bundled-db --profile admin "$@"
}
pass() { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*" >&2; exit 1; }

admin="$(compose exec -T backend php -r 'echo getenv("ADMIN_URL");')"
[[ "$admin" =~ ^https://([a-z0-9.-]+):([0-9]+)$ ]] || fail "ADMIN_URL must be https://<host>:<port> for this test, got: $admin"
admin_host="${BASH_REMATCH[1]}"
admin_port="${BASH_REMATCH[2]}"
resolve=(--resolve "$admin_host:$admin_port:$tls_ip")

# request <expected> <description> <curl args...>: body in $tmp/body, headers in $tmp/headers.
# TLS requests use the throwaway certificate of the test (-k), never a real one.
request() {
  local expected="$1" description="$2"; shift 2
  local actual
  actual="$(curl -sS -k -o "$tmp/body" -D "$tmp/headers" -w '%{http_code}' "$@")"
  [[ "$actual" == "$expected" ]] || fail "$description: expected $expected, got $actual"
  pass "$description ($actual)"
}
console() { local path="$1"; shift; request "$@" "${resolve[@]}" "$admin$path"; }
header() { grep -i "^$1:" "$tmp/headers" | head -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'; }
cookie() { grep -i '^set-cookie:' "$tmp/headers" | tr -d '\r' | grep -i "^set-cookie: $1=" | head -1 || true; }
expect_header() { [[ "$(header "$1")" == "$2" ]] || fail "$1 is '$(header "$1")', expected '$2'"; }
mysql_root() { compose exec -T mysql bash -c "mysql --defaults-extra-file=<(printf \"[client]\nuser=root\npassword=%s\n\" \"\$(cat /run/secrets/mysql_root_password)\") -N solveit_indonesia -e \"$1\""; }
wait_for() {
  local expected="$1" url="$2"; shift 2
  for _ in $(seq 1 60); do
    [[ "$(curl -sk -o "$tmp/discard" -w '%{http_code}' "$@" "$url")" == "$expected" ]] && return 0
    sleep 1
  done
  fail "$url did not answer $expected in time"
}

echo "== images"
compose exec -T admin sh -c '! command -v node && ! test -e /usr/share/nginx/html/node_modules && ! test -e /usr/share/nginx/html/src' \
  > /dev/null || fail "Node, node_modules, or source in the admin image"
[[ -z "$(compose exec -T admin find /usr/share/nginx/html -name '*.map')" ]] || fail "source maps in the admin image"
if compose exec -T admin grep -rqE 'referensi-komponen|SOLVEIT_ADMIN_API_TARGET|php artisan serve' /usr/share/nginx/html; then
  fail "component reference or developer hints in the admin image"
fi
pass "admin image: static files only (no Node, node_modules, source, source maps, reference page)"
for service in admin admin-gateway; do
  [[ "$(compose exec -T "$service" id -u)" == 101 ]] || fail "$service does not run as nginx (uid 101)"
  compose exec -T "$service" sh -c '! touch /usr/share/nginx/html/probe 2>/dev/null && ! touch /etc/nginx/probe 2>/dev/null' \
    || fail "$service filesystem is writable"
  found="$(compose exec -T "$service" sh -c "find / -xdev \( -path /proc -o -path /sys -o -path /run/secrets \) -prune -o \( -name '.env' -o -name '.env.*' -o -name '*.env' -o -name '*.sql' -o -name '*.sql.gz' -o -name '*.dump' -o -name '.git' -o -name 'auth.json' \) -print 2>/dev/null; find /usr/share/nginx/html /etc/nginx \( -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '*.pfx' \) -print 2>/dev/null" || true)"
  [[ -z "$found" ]] || fail "$service contains secret-like files: $found"
done
pass "admin and admin-gateway: non-root (uid 101), read-only, no .env, key, dump, or .git files"
rendered="$(compose exec -T admin-gateway nginx -T 2>/dev/null)"
grep -q "server_name $admin_host;" <<< "$rendered" || fail "admin-gateway did not render the admin host from ADMIN_URL"
[[ "$(grep -v '^[[:space:]]*#' <<< "$rendered" | grep -cE '\$\{SOLVEIT_' || true)" == 0 ]] || fail "unrendered template variable in admin-gateway"
pass "admin-gateway rendered server_name $admin_host from ADMIN_URL"

echo "== ports and networks"
for service in admin backend frontend mysql; do
  published="$(docker ps --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=$service" --format '{{.Ports}}')"
  [[ "$published" != *"->"* ]] || fail "$service publishes a port: $published"
done
ports="$(docker ps --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=admin-gateway" --format '{{.Ports}}')"
[[ -n "$ports" ]] || fail "admin-gateway is not running"
while read -r mapping; do
  [[ "$mapping" != *"->"* || "$mapping" == 127.0.0.1:* || "$mapping" == "$tls_ip":* ]] || fail "admin-gateway published beyond loopback: $mapping"
done < <(tr ',' '\n' <<< "$ports" | sed 's/^ *//')
pass "admin-gateway publishes on loopback only ($ports); admin, backend, frontend, mysql: none"
networks() { docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}' "$(compose ps -q "$1")"; }
[[ "$(networks gateway)" != *admin-* ]] || fail "the public gateway joins an admin network: $(networks gateway)"
[[ "$(networks admin-gateway)" != *_internal* && "$(networks admin-gateway)" != *_edge* ]] || fail "admin-gateway joins a website network: $(networks admin-gateway)"
[[ "$(networks admin)" == "${project}_admin-internal " ]] || fail "admin is on other networks: $(networks admin)"
compose exec -T admin-gateway wget -q -T 5 -O /dev/null http://admin:8080/ || fail "admin-gateway cannot reach the console (positive control)"
compose exec -T admin-gateway nc -z -w 3 backend 9000 || fail "admin-gateway cannot reach PHP-FPM (positive control)"
if compose exec -T gateway wget -q -T 5 -O /dev/null http://admin:8080/ 2> /dev/null; then fail "the public gateway reaches the admin console"; fi
if compose exec -T admin-gateway wget -q -T 5 -O /dev/null http://frontend:8080/ 2> /dev/null; then fail "admin-gateway reaches the website container"; fi
if compose exec -T admin-gateway nc -z -w 3 mysql 3306 2> /dev/null; then fail "admin-gateway reaches MySQL"; fi
pass "networks: public gateway and admin listener cannot reach each other's side; admin-gateway cannot reach MySQL"

echo "== console on the TLS listener ($admin)"
console / 200 "GET /"
cp "$tmp/body" "$tmp/index.html"
grep -q '<div id="root"></div>' "$tmp/index.html" || fail "GET / is not the console"
grep -q '<meta name="robots" content="noindex, nofollow"' "$tmp/index.html" || fail "console HTML without noindex"
meta_csp="$(grep -o '<meta http-equiv="Content-Security-Policy" content="[^"]*"' "$tmp/index.html" | sed 's/.*content="//; s/"$//; s/&#39;/'"'"'/g; s/&quot;/"/g; s/&amp;/\&/g')"
[[ -n "$meta_csp" ]] || fail "no CSP meta in the console HTML"
expect_header Content-Security-Policy "$meta_csp; frame-ancestors 'none'"
[[ "$meta_csp" != *unsafe-inline* && "$meta_csp" != *unsafe-eval* && "$meta_csp" == *"script-src 'self'"* ]] || fail "CSP is not strict: $meta_csp"
pass "CSP header = production meta CSP + frame-ancestors 'none' (one definition, admin/security-policy.ts)"
expect_header X-Frame-Options DENY
expect_header X-Content-Type-Options nosniff
expect_header Referrer-Policy same-origin
expect_header X-Robots-Tag "noindex, nofollow"
expect_header Cross-Origin-Opener-Policy same-origin
expect_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
expect_header Cache-Control no-store
expect_header Strict-Transport-Security "max-age=31536000"
expect_header Server nginx
[[ -z "$(header X-Powered-By)" ]] || fail "X-Powered-By exposed"
pass "console headers: X-Frame-Options, nosniff, Referrer-Policy same-origin, X-Robots-Tag, COOP, Permissions-Policy, no-store, HSTS, no version banner"
for path in /masuk /access /akun/keamanan /pengguna/7 /audit?jenis=login /tidak-ada; do
  console "$path" 200 "SPA route $path"
  cmp -s "$tmp/body" "$tmp/index.html" || fail "$path is not the console HTML"
  expect_header Cache-Control no-store
done
asset="$(grep -o '/assets/[A-Za-z0-9_.-]*\.js' "$tmp/index.html" | head -1)"
[[ -n "$asset" ]] || fail "no script in the console HTML"
console "$asset" 200 "GET $asset" -H 'Accept-Encoding: gzip'
expect_header Cache-Control "private, max-age=31536000, immutable"
[[ "$(header Content-Type)" == *javascript* ]] || fail "asset MIME type: $(header Content-Type)"
expect_header Content-Encoding gzip
[[ -n "$(header Content-Security-Policy)" ]] || fail "asset without the security headers"
pass "hashed asset: private immutable cache, JavaScript, gzip, security headers"
console /assets/missing-0000.js 404 "missing asset"
expect_header Cache-Control no-store
console /theme-init.js 200 "GET /theme-init.js (pre-paint theme, external for the CSP)"
console /robots.txt 200 "GET /robots.txt"
grep -q 'Disallow: /' "$tmp/body" || fail "robots.txt does not disallow everything"
console / 405 "POST to the static console" -X POST
console /index.html.map 200 "a .map path is only the SPA shell"
cmp -s "$tmp/body" "$tmp/index.html" || fail "/index.html.map served something other than the shell"

echo "== TLS"
if curl -sS -k "${resolve[@]}" --tls-max 1.1 -o "$tmp/discard" "$admin/" 2> /dev/null; then fail "TLS 1.1 accepted"; fi
pass "TLS 1.0 and 1.1 refused"
curl -sS -k "${resolve[@]}" --tlsv1.2 --tls-max 1.2 -o "$tmp/discard" "$admin/" || fail "TLS 1.2 refused"
pass "TLS 1.2 accepted (1.3 negotiated by default)"
if curl -sS -k --resolve "unknown.example.test:$admin_port:$tls_ip" -o "$tmp/discard" "https://unknown.example.test:$admin_port/" 2> /dev/null; then
  fail "TLS handshake completed for an unknown server name"
fi
pass "unknown SNI: handshake refused (no certificate shown)"
console / 421 "right SNI, foreign Host header" -H 'Host: evil.example.test'
[[ -z "$(cookie '[^=]*')" ]] || fail "421 response set a cookie"
if grep -qi 'http2' <<< "$(curl -V)"; then
  [[ "$(curl -sS -k "${resolve[@]}" --http2 -o "$tmp/discard" -w '%{http_version}' "$admin/")" == 2 ]] || fail "HTTP/2 not negotiated"
  pass "HTTP/2 negotiated"
fi

echo "== admin API boundary"
console /api/v1/admin/auth/csrf-cookie 204 "GET auth/csrf-cookie from the admin origin" -H "Origin: $admin"
session_cookie="$(cookie __Host-solveit-admin-session)"
xsrf_cookie="$(cookie XSRF-TOKEN)"
[[ -n "$session_cookie" ]] || fail "no __Host-solveit-admin-session cookie"
for attribute in '; path=/' '; secure' '; httponly' '; samesite=strict'; do
  [[ "${session_cookie,,}" == *"$attribute"* ]] || fail "session cookie lacks '$attribute'"
done
[[ "${session_cookie,,}" != *domain=* && "${session_cookie,,}" != *expires=* && "${session_cookie,,}" != *max-age=* ]] || fail "session cookie has a Domain or survives the browser: $session_cookie"
pass "session cookie: __Host- prefix, Path=/, Secure, HttpOnly, SameSite=Strict, no Domain, browser-session only"
[[ "${xsrf_cookie,,}" == *'; secure'* && "${xsrf_cookie,,}" == *'; samesite=strict'* && "${xsrf_cookie,,}" != *httponly* && "${xsrf_cookie,,}" != *domain=* ]] \
  || fail "XSRF-TOKEN cookie attributes"
pass "XSRF-TOKEN cookie: Secure, SameSite=Strict, readable by the console (not HttpOnly), no Domain"
expect_header Cache-Control "no-store, private"
expect_header Content-Security-Policy "default-src 'none'; frame-ancestors 'none'"
expect_header Strict-Transport-Security "max-age=31536000"
pass "API headers: no-store private, CSP default-src 'none', HSTS"
console /api/v1/admin/me 401 "GET me without a session" -H "Origin: $admin"
expect_header Cache-Control "no-store, private"
for origin in https://evil.example.test "http://$admin_host:$admin_port" "https://$admin_host" "$public" null; do
  console /api/v1/admin/auth/csrf-cookie 403 "Origin $origin refused" -H "Origin: $origin"
  [[ -z "$(cookie __Host-solveit-admin-session)" ]] || fail "refused origin $origin got a session cookie"
done
for site in cross-site same-site; do
  console /api/v1/admin/auth/csrf-cookie 403 "Sec-Fetch-Site: $site refused" -H "Sec-Fetch-Site: $site"
done
console /api/v1/admin/auth/logout 403 "write without Origin refused" -X POST -H 'Accept: application/json'
console /api/v1/admin/auth/logout 419 "write without a CSRF token refused" -X POST -H "Origin: $admin" -H 'Accept: application/json'
for path in /api/v1/inquiries /API/V1/ADMIN/me /Api/v1/admin/auth/csrf-cookie /api/v1/admin /up /sanctum/csrf-cookie; do
  console "$path" 404 "$path does not exist on the admin host" --path-as-is -H "Origin: $admin"
  [[ -z "$(cookie '[^=]*')" ]] || fail "$path set a cookie"
done
console /api/v1/inquiries 404 "POST /api/v1/inquiries on the admin host" -X POST -H "Origin: $admin" -H 'Content-Type: application/json' -d '{}'

echo "== plain listener (TLS terminated in front of it)"
request 421 "plain listener refuses a foreign Host" "$plain/"
request 421 "plain listener refuses the admin API without the admin Host" -H "Origin: $admin" "$plain/api/v1/admin/auth/csrf-cookie"
request 204 "admin Host forwarded by a proxy: csrf-cookie" -H "Host: $admin_host:$admin_port" -H "Origin: $admin" "$plain/api/v1/admin/auth/csrf-cookie"
[[ -z "$(header Strict-Transport-Security)" ]] || fail "plain listener sent HSTS (the TLS proxy in front sends it)"
pass "plain listener: no HSTS of its own"

# A failed sign-in is audited with the client address (REMOTE_ADDR). A forged X-Forwarded-For
# from an untrusted address must not become that address.
failed_login_ip() {
  request 422 "$1" >&2 -X POST -H "Host: $admin_host:$admin_port" -H "Origin: $admin" -H 'Sec-Fetch-Site: same-origin' \
    -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'X-Forwarded-For: 203.0.113.77' \
    -d "{\"email\":\"nobody-$RANDOM@example.test\",\"password\":\"not the password\"}" "$plain/api/v1/admin/auth/login"
  mysql_root "SELECT ip_address FROM admin_audit_events WHERE action = 'login.failed' ORDER BY id DESC LIMIT 1"
}
observed="$(failed_login_ip "failed sign-in with a forged X-Forwarded-For")"
[[ -n "$observed" && "$observed" != 203.0.113.77 ]] || fail "forged X-Forwarded-For became the audited address ($observed)"
pass "forged X-Forwarded-For ignored: audited address is the connecting peer ($observed)"
# Trust exactly that peer, as an operator does for the TLS proxy in front: now it is honoured.
SOLVEIT_ADMIN_REAL_IP_FROM="$observed/32" compose up -d --wait --no-deps --force-recreate admin-gateway > /dev/null 2>&1
recorded="$(failed_login_ip "failed sign-in through a trusted proxy")"
[[ "$recorded" == 203.0.113.77 ]] || fail "trusted proxy's X-Forwarded-For not honoured ($recorded)"
pass "SOLVEIT_ADMIN_REAL_IP_FROM=$observed/32: the proxy's X-Forwarded-For is the audited address"
compose up -d --wait --no-deps --force-recreate admin-gateway > /dev/null 2>&1
pass "admin-gateway back to trusting no proxy"

echo "== public gateway isolation"
for path in /masuk /access /pengguna /akun/keamanan "$asset"; do
  request 404 "public listener does not serve the console at $path" "$public$path"
  if grep -q 'Konsol admin' "$tmp/body"; then fail "public listener served admin content at $path"; fi
done
for host in "$admin_host:$admin_port" "$admin_host"; do
  request 404 "public listener refuses the admin API with Host $host" --path-as-is -H "Host: $host" -H "Origin: $admin" "$public/api/v1/admin/auth/csrf-cookie"
  [[ -z "$(cookie '[^=]*')" ]] || fail "public listener set a cookie for Host $host"
done

echo "== fail closed on configuration"
for bad in "http://$admin_host" "https://$admin_host/console" "https://Admin.Example.test" "https://$admin_host; return 200" ""; do
  if compose run --rm --no-deps -T -e "ADMIN_URL=$bad" admin-gateway nginx -t > "$tmp/run" 2>&1; then
    fail "admin-gateway started with ADMIN_URL='$bad'"
  fi
  grep -q 'solveit: ADMIN_URL must be' "$tmp/run" || fail "admin-gateway refused ADMIN_URL='$bad' without the expected reason"
done
compose run --rm --no-deps -T admin-gateway nginx -t > /dev/null 2>&1 || fail "admin-gateway configuration test failed (positive control)"
if compose run --rm --no-deps -T -e "SOLVEIT_ADMIN_REAL_IP_FROM=10.0.0.0/8; allow all" admin-gateway nginx -t > /dev/null 2>&1; then
  fail "admin-gateway accepted an injected SOLVEIT_ADMIN_REAL_IP_FROM"
fi
pass "admin-gateway refuses http://, paths, uppercase, injection, and empty ADMIN_URL, and an injected proxy address"
for case in "ADMIN_URL=http://$admin_host" "ADMIN_URL=https://$admin_host/console" "APP_URL=$admin"; do
  if compose run --rm --no-deps -T -e "$case" backend php -r 'echo "started";' > "$tmp/run" 2>&1; then
    fail "backend started with $case"
  fi
  grep -q 'solveit: ADMIN_URL must' "$tmp/run" || fail "backend refused $case without the expected reason"
done
[[ "$(compose run --rm --no-deps -T backend php -r 'echo "started";' 2> /dev/null)" == started ]] || fail "backend did not start with the valid configuration (positive control)"
pass "backend refuses a non-https ADMIN_URL, a path, and the public website origin"

echo "== failure and recovery"
compose stop backend > /dev/null 2>&1
console /api/v1/admin/me 502 "backend down: admin API answers 502" -H "Origin: $admin"
[[ "$(cat "$tmp/body")" == '{"message":"The admin API is unavailable."}' ]] || fail "502 body: $(cat "$tmp/body")"
expect_header Cache-Control no-store
console / 200 "backend down: the console still loads (it reports the outage itself)"
compose start backend > /dev/null 2>&1
compose up -d --wait backend > /dev/null 2>&1
wait_for 401 "$admin/api/v1/admin/me" "${resolve[@]}" -H "Origin: $admin"
pass "backend back: admin API answers again (401 without a session)"
compose stop admin > /dev/null 2>&1
console / 502 "console container down: 502"
console /api/v1/admin/auth/csrf-cookie 204 "console container down: the API is unaffected" -H "Origin: $admin"
compose start admin > /dev/null 2>&1
compose up -d --wait admin admin-gateway > /dev/null 2>&1
wait_for 200 "$admin/" "${resolve[@]}"
pass "console container back"

echo "== rollback by image tag"
for image in admin backend frontend; do
  docker image tag "solveit-indonesia/$image:$tag" "solveit-indonesia/$image:rollback-drill"
done
SOLVEIT_IMAGE_TAG=rollback-drill compose up -d --wait --no-build > /dev/null 2>&1
for service in admin backend frontend; do
  image="$(docker inspect -f '{{.Config.Image}}' "$(compose ps -q "$service")")"
  [[ "$image" == "solveit-indonesia/$service:rollback-drill" ]] || fail "$service runs $image after the rollback"
done
wait_for 200 "$admin/" "${resolve[@]}"
wait_for 401 "$admin/api/v1/admin/me" "${resolve[@]}" -H "Origin: $admin"
wait_for 200 "$public/up"
pass "stack runs the previous tag (rollback-drill): console, admin API, public /up answer"
SOLVEIT_IMAGE_TAG="$tag" compose up -d --wait --no-build > /dev/null 2>&1
for service in admin backend frontend; do
  image="$(docker inspect -f '{{.Config.Image}}' "$(compose ps -q "$service")")"
  [[ "$image" == "solveit-indonesia/$service:$tag" ]] || fail "$service runs $image after rolling forward"
  docker image rm "solveit-indonesia/$service:rollback-drill" > /dev/null
done
wait_for 200 "$admin/" "${resolve[@]}"
wait_for 401 "$admin/api/v1/admin/me" "${resolve[@]}" -H "Origin: $admin"
pass "rolled forward to $tag; drill tags removed"

echo "All admin listener checks passed."
