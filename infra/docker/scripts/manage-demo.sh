#!/usr/bin/env bash
# Local team demo of Solveit Admin (B5a): the production admin image and Laravel with a bundled
# MySQL holding synthetic data only, on the owner's computer, reachable through a Cloudflare
# Quick Tunnel the owner opens by hand, or locally for screen sharing. NOT a deployment, never
# the public inquiry channel. On Windows run it through manage-demo.ps1 (same folder).
# Guide (Indonesian, PowerShell): docs/development/cloudflare-demo.md.
#
#   prepare               state folder, secrets, env file (only what is missing), build the
#                         images, then start
#   start                 start or update the stack, keeping its data; migrate and seed the
#                         synthetic data (both idempotent)
#   tunnel <https-url>    use a running Quick Tunnel as the admin origin, only after proving it
#                         asks for the Cloudflare email code (--allowed-mail)
#   local                 back to the local origin https://admin.<project>.localhost:<port>
#   owner <email>         create the demo owner (address on example.test) and print its
#                         one-time activation link
#   recover <email>       new one-time link for a demo account that lost its authenticator
#   seed                  add missing synthetic inquiries and history (idempotent)
#   check                 read-only checks: guard, health, origin, cookies, CSP, data, tunnel
#   status                what is configured and running, without checks
#   stop                  stop the stack; data stays
#   reset                 delete only this demo's database volume, after typed confirmation
#
# Never opens a tunnel, never touches another Compose project, never runs down -v, prune, or a
# global cleanup, never edits backend/.env or infra/docker/production.env, and never writes a
# link, password, TOTP secret, or recovery code to a file.
#
# Advanced settings (defaults suit the owner's demo): SOLVEIT_DEMO_PROJECT (solveit-demo),
# SOLVEIT_DEMO_HOME (state folder outside the repository), SOLVEIT_DEMO_ADMIN_PORT (8190, the
# address cloudflared forwards to), SOLVEIT_DEMO_TLS_PORT (8543, local origin),
# SOLVEIT_DEMO_IMAGE_TAG (demo), SOLVEIT_DEMO_SKIP_PUBLIC_PROBE=1 (CI only: no internet probe
# of a tunnel URL that does not exist).
set -euo pipefail
export MSYS_NO_PATHCONV=1

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo="$(cd "$here/../../.." && pwd -P)"

say() { printf '%s\n' "$*"; }
info() { printf 'INFO   %s\n' "$*"; }
okay() { printf 'OK     %s\n' "$*"; }
warn() { printf 'AWAS   %s\n' "$*" >&2; }
die() { printf 'GAGAL  %s\n' "$*" >&2; exit 1; }

# Docker for Windows reads Windows paths; Git Bash paths are converted where Docker sees them.
native() { if command -v cygpath > /dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

project="${SOLVEIT_DEMO_PROJECT:-solveit-demo}"
if [[ -n "${SOLVEIT_DEMO_HOME:-}" ]]; then
  home="$SOLVEIT_DEMO_HOME"
elif [[ -n "${LOCALAPPDATA:-}" ]] && command -v cygpath > /dev/null 2>&1; then
  home="$(cygpath -u "$LOCALAPPDATA")/solveit-demo/$project"
else
  home="${XDG_STATE_HOME:-$HOME/.local/state}/solveit-demo/$project"
fi
admin_port="${SOLVEIT_DEMO_ADMIN_PORT:-8190}"
tls_port="${SOLVEIT_DEMO_TLS_PORT:-8543}"
tag="${SOLVEIT_DEMO_IMAGE_TAG:-demo}"
# How the person started this tool, for the hints it prints (manage-demo.ps1 sets it).
entry="${SOLVEIT_DEMO_ENTRY:-bash infra/docker/scripts/manage-demo.sh}"
export SOLVEIT_DEMO_PROJECT="$project" SOLVEIT_DEMO_HOME="$home"

[[ "$project" =~ ^solveit-demo(-[a-z0-9]+)?$ ]] || die "SOLVEIT_DEMO_PROJECT '$project' bukan project demo (solveit-demo atau solveit-demo-<akhiran>)"
for port in "$admin_port" "$tls_port"; do
  if [[ ! "$port" =~ ^[0-9]+$ ]] || ((port < 1024 || port > 65535)); then die "port '$port' tidak valid (1024 sampai 65535)"; fi
done
[[ "$admin_port" != "$tls_port" ]] || die "SOLVEIT_DEMO_ADMIN_PORT dan SOLVEIT_DEMO_TLS_PORT harus berbeda"
[[ "$tag" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || die "SOLVEIT_DEMO_IMAGE_TAG '$tag' tidak valid"

local_host="admin.$project.localhost"
local_origin="https://$local_host:$tls_port"
tunnel_pattern='^https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com$'
env_file="$home/demo.env"
secrets="$home/secrets"
peer_file="$home/admin-peer"
compose_dir="$(native "$repo/infra/docker")"

compose() {
  local real_ip=""
  # Only a Quick Tunnel sends the person's address in X-Forwarded-For (cloudflared on this
  # computer, through the loopback port); locally nobody is trusted.
  if [[ "$(current_admin_url)" =~ $tunnel_pattern && -s "$peer_file" ]]; then real_ip="$(cat "$peer_file")"; fi
  SOLVEIT_ENV_FILE="$(native "$env_file")" \
    SOLVEIT_SECRETS_DIR="$(native "$secrets")" \
    SOLVEIT_IMAGE_TAG="$tag" \
    SOLVEIT_HTTP_BIND=127.0.0.1 \
    SOLVEIT_ADMIN_HTTP_BIND=127.0.0.1 \
    SOLVEIT_ADMIN_HTTP_PORT="$admin_port" \
    SOLVEIT_ADMIN_TLS_BIND=127.0.0.1 \
    SOLVEIT_ADMIN_TLS_PORT="$tls_port" \
    SOLVEIT_ADMIN_REAL_IP_FROM="$real_ip" \
    docker compose -p "$project" \
    -f "$compose_dir/compose.prod.yaml" \
    -f "$compose_dir/compose.prod.admin-tls.yaml" \
    -f "$compose_dir/compose.prod.demo.yaml" \
    --profile bundled-db --profile admin "$@"
}

guard() {
  local output
  if ! output="$(bash "$here/check-demo-stack.sh" "$1" 2>&1)"; then
    printf '%s\n' "$output" | sed 's/^/       /' >&2
    die "pengaman demo menolak; tidak ada yang diubah. Baca alasan REFUSED di atas."
  fi
  [[ "${quiet_guard:-}" == 1 ]] || printf '%s\n' "$output" | sed 's/^/       /'
}

current_admin_url() { if [[ -f "$env_file" ]]; then sed -n 's/^ADMIN_URL=//p' "$env_file" | tr -d '\r' | tail -1; fi; }
mode_of() { if [[ "$1" =~ $tunnel_pattern ]]; then echo tunnel; else echo local; fi; }

require_docker() {
  command -v docker > /dev/null 2>&1 || die "perintah docker tidak ditemukan. Pasang dan jalankan Docker Desktop."
  docker info > /dev/null 2>&1 || die "Docker belum berjalan. Buka Docker Desktop, tunggu sampai 'Engine running', lalu ulangi."
  docker compose version > /dev/null 2>&1 || die "Docker Compose v2 tidak tersedia."
}

require_prepared() {
  [[ -f "$home/.solveit-demo-project" ]] || die "demo belum disiapkan. Jalankan dulu: prepare"
}

# --- state folder, secrets, env file: created when missing, never overwritten ------------------
write_secret() {
  local name="$1" value="$2"
  [[ -s "$secrets/$name" ]] && return 0
  (umask 077 && printf '%s' "$value" > "$secrets/$name")
  info "secret $name dibuat"
}

ensure_certificate() {
  local cert="$secrets/admin_tls_certificate" key="$secrets/admin_tls_private_key"
  # openssl from Git for Windows is a native program: it gets Windows paths (path conversion is
  # off so that -subj "/CN=..." stays as it is).
  if [[ -s "$cert" && -s "$key" ]] && openssl x509 -in "$(native "$cert")" -noout -checkend 86400 > /dev/null 2>&1 \
    && openssl x509 -in "$(native "$cert")" -noout -ext subjectAltName 2> /dev/null | grep -q "DNS:$local_host"; then
    return 1
  fi
  # Self-signed for the local rehearsal name only, 30 days, never trusted by anything else. No
  # certificate for a real domain is requested or stored.
  rm -f "$cert" "$key"
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 30 \
    -subj "/CN=$local_host" -addext "subjectAltName=DNS:$local_host" \
    -addext "basicConstraints=critical,CA:FALSE" -addext "extendedKeyUsage=serverAuth" \
    -keyout "$(native "$key")" -out "$(native "$cert")" 2> /dev/null || die "openssl gagal membuat sertifikat lokal"
  info "sertifikat lokal untuk $local_host dibuat (berlaku 30 hari, self-signed)"
  return 0
}

# Absolute, symlink-free form of a path that may not exist yet: its nearest existing ancestor
# resolved, plus the rest. Decided before anything is created.
resolve_path() {
  local path="$1" rest=""
  [[ "$path" = /* || "$path" =~ ^[A-Za-z]: ]] || path="$PWD/$path"
  while [[ ! -d "$path" ]]; do
    rest="/$(basename "$path")$rest"
    path="$(dirname "$path")"
  done
  printf '%s%s\n' "$(cd "$path" && pwd -P)" "$rest"
}

ensure_state() {
  home="$(resolve_path "$home")"
  [[ "$home" != "$repo" && "$home" != "$repo"/* ]] || die "folder status demo tidak boleh di dalam repository: $home"
  mkdir -p "$home"
  if [[ -f "$home/.solveit-demo-project" ]]; then
    [[ "$(tr -d '\r\n' < "$home/.solveit-demo-project")" == "$project" ]] || die "folder $home milik project demo lain"
  else
    [[ -z "$(ls -A "$home")" ]] || die "folder $home sudah berisi file lain; pilih folder kosong lewat SOLVEIT_DEMO_HOME"
    printf '%s\n' "$project" > "$home/.solveit-demo-project"
  fi
  mkdir -p "$secrets"
  command -v openssl > /dev/null 2>&1 || die "openssl tidak ditemukan (Git for Windows menyertakannya)"
  write_secret app_key "base64:$(openssl rand -base64 32)"
  for name in db_app_password db_migrator_password mysql_root_password; do write_secret "$name" "$(openssl rand -hex 24)"; done
  ensure_certificate || true
  # Linux: readable inside the containers (www-data, mysql, nginx), the folder protects them.
  chmod 0444 "$secrets"/* 2> /dev/null || true
  chmod 0700 "$secrets" 2> /dev/null || true
  if [[ ! -f "$env_file" ]]; then
    sed -e "s#^APP_URL=.*#APP_URL=http://localhost:4173#" -e "s#^ADMIN_URL=.*#ADMIN_URL=$local_origin#" \
      "$repo/infra/docker/production.env.example" > "$env_file.tmp"
    printf '\n# Local team demo (manage-demo.sh). The demo guard requires this marker.\nSOLVEIT_DEMO=%s\n' "$project" >> "$env_file.tmp"
    mv "$env_file.tmp" "$env_file"
    info "demo.env dibuat dengan origin lokal $local_origin"
  fi
}

set_admin_url() {
  local url="$1"
  sed "s#^ADMIN_URL=.*#ADMIN_URL=$url#" "$env_file" > "$env_file.tmp" && mv "$env_file.tmp" "$env_file"
}

# --- tunnel protection probe ---------------------------------------------------------------------
# classify_probe <status> <redirect url> <body file> <tunnel host>: one answer to a request for
# the tunnel URL without cookies, as any visitor sends it (tested in test-demo-guards.sh).
# protected:    a redirect to Cloudflare's email sign-in (login.trycloudflare.com for a
#               --allowed-mail Quick Tunnel, <team>.cloudflareaccess.com for Access)
# unprotected:  the answer came from this computer's admin listener (its 421 or the console)
# retry:        nothing answered yet (tunnel starting, DNS not ready)
# unknown:      anything else; never treated as protected
classify_probe() {
  local code="$1" redirect="$2" body="$3" host="$4" target
  if [[ "$code" =~ ^30[1278]$ && "$redirect" == https://* ]]; then
    target="${redirect#https://}"
    target="${target%%[/?#]*}"
    if [[ "$target" != "$host" && ("$target" == login.trycloudflare.com || "$target" =~ ^[a-z0-9-]+\.cloudflareaccess\.com$) ]]; then
      echo protected
      return
    fi
  fi
  if grep -q 'Misdirected Request\|<div id="root"></div>' "$body" 2> /dev/null; then
    echo unprotected
    return
  fi
  case "$code" in
    000 | 404 | 502 | 530) echo retry ;;
    *) echo unknown ;;
  esac
}

# Asks the tunnel URL over the internet, without cookies and without following redirects, a few
# times while the tunnel is still starting. Prints "<verdict> <status> [<redirect host>]".
probe_tunnel() {
  local url="$1" tmp code redirect verdict
  tmp="$(native "$(mktemp -d)")"
  for _ in 1 2 3 4 5 6; do
    : > "$tmp/body"
    read -r code redirect < <(curl -sS --max-time 15 -o "$tmp/body" -D "$tmp/headers" \
      -w '%{http_code} %{redirect_url}\n' "$url/" 2> /dev/null || true)
    code="${code:-000}"
    verdict="$(classify_probe "$code" "${redirect:-}" "$tmp/body" "${url#https://}")"
    [[ "$verdict" == retry ]] || break
    sleep 4
  done
  rm -rf "$tmp"
  [[ "$verdict" == retry ]] && verdict=unknown
  redirect="${redirect#https://}"
  echo "$verdict $code ${redirect%%[/?#]*}"
}

# --- the admin listener's view of loopback connections ----------------------------------------
# Connections to the published loopback port reach admin-gateway from one Docker address (the
# gateway of its network, or Docker Desktop's proxy). Under a Quick Tunnel every connection
# comes that way through cloudflared, which forwards the person's address in X-Forwarded-For
# (Cloudflare appends it last). Trusting exactly this one address lets Laravel's rate limits and
# audit log see each person instead of one shared address. Measured, never assumed.
measure_peer() {
  local marker container line
  marker="solveit-demo-peer-$(openssl rand -hex 6)"
  container="$(compose ps -q admin-gateway)"
  [[ -n "$container" ]] || return 1
  curl -s -o /dev/null --max-time 5 -H "Host: peer-probe.invalid" "http://127.0.0.1:$admin_port/$marker" || true
  sleep 1
  line="$(docker logs --since 2m "$container" 2>&1 | grep -F "/$marker " | tail -1 || true)"
  line="${line%% *}"
  [[ "$line" =~ ^[0-9a-fA-F:.]+$ ]] || return 1
  printf '%s\n' "$line"
}

do_start() {
  require_docker
  require_prepared
  guard config
  local recreate=() url
  if ensure_certificate; then recreate=(--force-recreate admin-gateway); fi
  url="$(current_admin_url)"
  info "menjalankan MySQL demo (volume ${project}_mysql-data)"
  compose up -d --wait mysql
  info "migrasi database demo (hanya menambah tabel yang belum ada)"
  compose --profile ops run --rm migrate
  info "menjalankan Laravel, konsol admin, dan listener admin (loopback saja)"
  compose up -d --wait backend admin admin-gateway
  if [[ "$(mode_of "$url")" == tunnel ]]; then
    local peer
    peer="$(measure_peer)" || die "alamat koneksi loopback ke listener admin tidak dapat diukur"
    if [[ "$(cat "$peer_file" 2> /dev/null || true)" != "$peer" ]]; then
      printf '%s\n' "$peer" > "$peer_file"
      info "listener admin mempercayai X-Forwarded-For hanya dari $peer (jalur cloudflared lewat loopback)"
      compose up -d --wait admin-gateway
    fi
  fi
  if ((${#recreate[@]})); then compose up -d --wait "${recreate[@]}"; fi
  quiet_guard=1 guard stack
  okay "pengaman demo menerima stack ini"
  do_seed
  summary
}

do_seed() {
  quiet_guard=1 guard stack
  info "mengisi data demo sintetis (yang sudah ada tidak diubah)"
  compose exec -T backend php < "$repo/infra/docker/demo/seed-demo-data.php"
}

summary() {
  local url
  url="$(current_admin_url)"
  say ""
  say "Demo admin berjalan (data sintetis, bukan deployment)."
  if [[ "$(mode_of "$url")" == tunnel ]]; then
    say "  Mode     : Quick Tunnel"
    say "  Admin    : $url"
    say "  Lokal    : cloudflared meneruskan ke http://127.0.0.1:$admin_port"
  else
    say "  Mode     : lokal (untuk berbagi layar)"
    say "  Admin    : $url"
    say "             Browser akan memperingatkan sertifikat self-signed: pilih Advanced, lalu Proceed."
    say "  Tunnel   : cloudflared tunnel --url http://127.0.0.1:$admin_port --allowed-mail \"<email-tim>\""
    say "             lalu: $entry tunnel https://<kata-acak>.trycloudflare.com"
  fi
  say "  Data     : ${project}_mysql-data (hanya project ini)"
  say "  Periksa  : $entry check"
}

# --- commands ---------------------------------------------------------------------------------
cmd_prepare() {
  require_docker
  ensure_state
  guard config
  info "membangun image produksi backend dan admin dengan tag $tag (beberapa menit pada kali pertama)"
  compose build backend admin
  do_start
}

cmd_tunnel() {
  local url="${1:-}"
  url="$(printf '%s' "$url" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
  url="${url%/}"
  [[ "$url" =~ $tunnel_pattern ]] || die "berikan URL Quick Tunnel lengkap, misalnya https://contoh-kata-acak.trycloudflare.com (didapat: '${1:-}')"
  require_docker
  require_prepared
  if [[ "${SOLVEIT_DEMO_SKIP_PUBLIC_PROBE:-}" == 1 ]]; then
    warn "pemeriksaan perlindungan tunnel dilewati (SOLVEIT_DEMO_SKIP_PUBLIC_PROBE=1, hanya untuk CI)"
  else
    info "memeriksa bahwa tunnel meminta kode email Cloudflare sebelum admin dibuka"
    local verdict
    verdict="$(probe_tunnel "$url")"
    case "$verdict" in
      protected*) okay "tunnel dilindungi email Cloudflare (${verdict#protected })" ;;
      unprotected*)
        die "tunnel ini TIDAK meminta kode email. Admin tidak dibuka. Hentikan cloudflared (Ctrl+C), lalu jalankan lagi dengan --allowed-mail <email-tim>."
        ;;
      *)
        die "tunnel belum dapat diperiksa (${verdict#unknown }). Pastikan demo berjalan ($entry start), jendela cloudflared masih terbuka, dan URL-nya benar; tunggu 30 detik, lalu ulangi. Admin tidak dibuka."
        ;;
    esac
  fi
  set_admin_url "$url"
  info "ADMIN_URL demo diganti ke $url"
  do_start
  if [[ "${SOLVEIT_DEMO_SKIP_PUBLIC_PROBE:-}" != 1 ]]; then
    case "$(probe_tunnel "$url")" in
      protected*) okay "setelah dibuka, tunnel tetap meminta kode email Cloudflare" ;;
      unprotected*)
        set_admin_url "$local_origin"
        do_start > /dev/null
        die "tunnel berubah menjadi tanpa perlindungan; admin dikembalikan ke mode lokal. Hentikan cloudflared."
        ;;
      *) warn "pemeriksaan ulang tunnel tidak memberi jawaban jelas; jalankan check sebentar lagi" ;;
    esac
  fi
}

cmd_local() {
  require_docker
  require_prepared
  set_admin_url "$local_origin"
  info "ADMIN_URL demo kembali ke $local_origin; URL tunnel lama tidak dilayani lagi"
  do_start
}

valid_demo_email() { [[ "$1" =~ ^[a-z0-9._%+-]+@example\.test$ ]]; }

cmd_owner() {
  local email="${1:-}"
  email="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')"
  valid_demo_email "$email" || die "alamat akun demo harus di domain contoh example.test, misalnya pemilik.demo@example.test. Alamat nyata tidak dipakai (tidak ada email yang dikirim)."
  require_docker
  require_prepared
  guard stack
  say ""
  say "Tautan di bawah hanya muncul sekali, berlaku 30 menit, dan sekali pakai."
  say "Buka di browser komputer ini. Jangan disimpan, difoto, atau dibagikan."
  say ""
  compose exec -T backend php artisan admin:bootstrap-owner "$email" --force --no-interaction
}

cmd_recover() {
  local email="${1:-}"
  email="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')"
  valid_demo_email "$email" || die "alamat akun demo harus di domain example.test"
  require_docker
  require_prepared
  guard stack
  say ""
  say "Akun ini langsung terkunci sampai tautan baru dipakai untuk kata sandi dan autentikator baru."
  say ""
  compose exec -T backend php artisan admin:reset-credentials "$email" --force --no-interaction
}

cmd_seed() {
  require_docker
  require_prepared
  do_seed
}

# check: read-only. Every request goes to this computer's loopback listener, except the tunnel
# probe, which asks the public URL the same way any visitor would.
cmd_check() {
  require_docker
  require_prepared
  local url mode host failures=0 tmp
  url="$(current_admin_url)"
  mode="$(mode_of "$url")"
  host="${url#https://}"
  host="${host%%:*}"
  tmp="$(native "$(mktemp -d)")"
  check_tmp="$tmp"
  trap 'rm -rf "${check_tmp:-}"' EXIT

  say "== pengaman demo"
  guard stack

  say "== layanan"
  local service state
  for service in mysql backend admin admin-gateway; do
    state="$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q "$service")" 2> /dev/null || echo tidak-berjalan)"
    if [[ "$state" == healthy ]]; then okay "$service sehat"; else warn "$service: $state"; failures=$((failures + 1)); fi
  done
  if compose exec -T backend php artisan migrate:status 2> /dev/null | grep -q Pending; then
    warn "ada migrasi yang belum dijalankan (jalankan start)"; failures=$((failures + 1))
  else
    okay "tidak ada migrasi tertunda"
  fi

  say "== origin admin ($mode: $url)"
  local origin_url="$url"
  # fetch <path> [curl args...]: status code; headers in $tmp/h, body in $tmp/b.
  # curl prints the status even when it exits non-zero (000 when nothing answered).
  fetch() {
    local path="$1" code; shift
    if [[ "$mode" == tunnel ]]; then
      code="$(curl -sS --max-time 10 -o "$tmp/b" -D "$tmp/h" -w '%{http_code}' "$@" -H "Host: $host" "http://127.0.0.1:$admin_port$path" 2> /dev/null || true)"
    else
      code="$(curl -sS --max-time 10 -k -o "$tmp/b" -D "$tmp/h" -w '%{http_code}' "$@" --resolve "$host:$tls_port:127.0.0.1" "https://$host:$tls_port$path" 2> /dev/null || true)"
    fi
    printf '%s' "${code:-000}"
  }
  header() { grep -i "^$1:" "$tmp/h" | head -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'; }
  expect() {
    if [[ "$1" == "$2" ]]; then okay "$3"; else warn "$3: didapat '$1', seharusnya '$2'"; failures=$((failures + 1)); fi
  }

  expect "$(fetch /)" 200 "konsol admin terbuka"
  if grep -q '<div id="root"></div>' "$tmp/b" && [[ "$(header Content-Security-Policy)" == *"script-src 'self'"*"frame-ancestors 'none'"* ]] \
    && [[ "$(header Cache-Control)" == no-store ]]; then
    okay "konsol dengan CSP ketat (script-src 'self', frame-ancestors 'none') dan no-store"
  else
    warn "konsol tanpa CSP ketat atau tanpa no-store"; failures=$((failures + 1))
  fi
  expect "$(fetch /inquiry/1)" 200 "rute SPA (/inquiry/1) dilayani konsol"
  expect "$(fetch /api/v1/admin/auth/csrf-cookie -H "Origin: $origin_url")" 204 "API admin menjawab dari origin yang sama"
  local session xsrf
  session="$(grep -i '^set-cookie: __Host-solveit-admin-session=' "$tmp/h" | tr -d '\r' | tr '[:upper:]' '[:lower:]' || true)"
  xsrf="$(grep -i '^set-cookie: XSRF-TOKEN=' "$tmp/h" | tr -d '\r' | tr '[:upper:]' '[:lower:]' || true)"
  if [[ "$session" == *"; secure"* && "$session" == *"; httponly"* && "$session" == *"samesite=strict"* && "$session" == *"path=/"* && "$session" != *"domain="* ]]; then
    okay "cookie sesi __Host- dengan Secure, HttpOnly, SameSite=Strict, Path=/, tanpa Domain"
  else
    warn "cookie sesi __Host- tidak lengkap atribut keamanannya"; failures=$((failures + 1))
  fi
  if [[ "$xsrf" == *"; secure"* && "$xsrf" == *"samesite=strict"* && "$xsrf" != *"httponly"* ]]; then
    okay "cookie XSRF-TOKEN dengan Secure dan SameSite=Strict"
  else
    warn "cookie XSRF-TOKEN tidak sesuai"; failures=$((failures + 1))
  fi
  expect "$(fetch /api/v1/admin/me -H "Origin: https://evil.example")" 403 "origin asing ditolak (403)"
  expect "$(fetch /api/v1/admin/auth/login -X POST -H "Origin: $origin_url" -H 'Content-Type: application/json' -H 'Accept: application/json' --data '{}')" 419 "tulis tanpa token CSRF ditolak (419)"
  expect "$(fetch /api/v1/inquiries -X POST -H "Origin: $origin_url")" 404 "API inquiry publik tidak ada di host admin"
  local other
  other="$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H 'Host: lain.example' "http://127.0.0.1:$admin_port/" || true)"
  expect "${other:-000}" 421 "host lain ditolak listener admin (421)"

  if [[ "$mode" == tunnel ]]; then
    say "== alamat pengunjung lewat tunnel"
    local marker container line
    marker="solveit-demo-realip-$(openssl rand -hex 6)"
    fetch "/$marker" -H "X-Forwarded-For: 203.0.113.77" > /dev/null
    sleep 1
    container="$(compose ps -q admin-gateway)"
    line="$(docker logs --since 2m "$container" 2>&1 | grep -F "/$marker " | tail -1 || true)"
    if [[ "${line%% *}" == 203.0.113.77 ]]; then
      okay "listener admin memakai alamat terakhir X-Forwarded-For dari jalur cloudflared (rate limit dan audit per orang)"
    else
      warn "alamat pengunjung tidak diteruskan (rate limit dan audit memakai satu alamat bersama); jalankan start"
      failures=$((failures + 1))
    fi
    say "== perlindungan tunnel publik"
    if [[ "${SOLVEIT_DEMO_SKIP_PUBLIC_PROBE:-}" == 1 ]]; then
      warn "pemeriksaan tunnel publik dilewati (SOLVEIT_DEMO_SKIP_PUBLIC_PROBE=1)"
    else
      local verdict
      verdict="$(probe_tunnel "$url")"
      case "$verdict" in
        protected*) okay "tunnel meminta kode email Cloudflare sebelum admin (${verdict#protected })" ;;
        unprotected*)
          warn "BAHAYA: tunnel admin TANPA perlindungan email. Hentikan cloudflared sekarang, lalu jalankan: local"
          failures=$((failures + 1))
          ;;
        *) warn "tunnel tidak terjangkau (${verdict#unknown }). Bila cloudflared sudah ditutup, jalankan: local"; failures=$((failures + 1)) ;;
      esac
    fi
  fi

  say "== data demo"
  # shellcheck disable=SC2016  # PHP code, expands inside the container
  compose exec -T backend php -r '
    require "/var/www/html/vendor/autoload.php";
    $app = require "/var/www/html/bootstrap/app.php";
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $users = App\Models\User::query()->get();
    $active = $users->filter(fn ($u) => $u->canSignInToAdmin());
    printf("OK     akun: %d (aktif %d: owner %d, admin %d)\n", $users->count(), $active->count(),
      $active->filter(fn ($u) => $u->role === App\Enums\AdminRole::Owner)->count(),
      $active->filter(fn ($u) => $u->role === App\Enums\AdminRole::Admin)->count());
    $byStatus = App\Models\Inquiry::query()->toBase()->selectRaw("status, COUNT(*) AS n")->groupBy("status")->pluck("n", "status");
    printf("OK     inquiry sintetis: %s\n", $byStatus->isEmpty() ? "belum ada" : $byStatus->map(fn ($n, $s) => "$s $n")->implode(", "));
    if ($active->filter(fn ($u) => $u->role === App\Enums\AdminRole::Owner)->isEmpty()) {
      echo "INFO   belum ada owner demo yang aktif: jalankan owner <alamat@example.test>\n";
    }
  ' || { warn "ringkasan data tidak dapat dibaca"; failures=$((failures + 1)); }

  say ""
  if ((failures == 0)); then
    okay "SIAP: semua pemeriksaan lulus"
  else
    die "$failures pemeriksaan gagal; lihat baris AWAS di atas dan docs/development/cloudflare-demo.md, Troubleshooting"
  fi
}

cmd_status() {
  say "Project      : $project"
  say "Folder status: $(native "$home")"
  if [[ ! -f "$home/.solveit-demo-project" ]]; then say "Belum disiapkan (jalankan prepare)."; return; fi
  local url
  url="$(current_admin_url)"
  say "Mode         : $(mode_of "$url")"
  say "ADMIN_URL    : $url"
  say "Port lokal   : 127.0.0.1:$admin_port (cloudflared), 127.0.0.1:$tls_port (lokal)"
  require_docker
  docker ps -a --filter "label=com.docker.compose.project=$project" --format 'Container    : {{.Names}} {{.Status}}'
  if docker volume inspect "${project}_mysql-data" > /dev/null 2>&1; then say "Volume data  : ${project}_mysql-data"; else say "Volume data  : belum ada"; fi
}

cmd_stop() {
  require_docker
  require_prepared
  guard config > /dev/null
  info "menghentikan stack demo $project (data tetap di volume ${project}_mysql-data)"
  compose down
  okay "demo berhenti. Tutup juga jendela cloudflared (Ctrl+C) bila masih terbuka."
}

cmd_reset() {
  local confirmation="" volume="${project}_mysql-data"
  if [[ "${1:-}" == --yes=* ]]; then confirmation="${1#--yes=}"; fi
  require_docker
  require_prepared
  guard config > /dev/null
  docker volume inspect "$volume" > /dev/null 2>&1 || { okay "volume $volume tidak ada; tidak ada data demo untuk dihapus"; return; }
  [[ "$(docker volume inspect -f '{{index .Labels "com.docker.compose.project"}}' "$volume")" == "$project" ]] \
    || die "volume $volume bukan milik project $project; tidak dihapus"
  [[ "$(docker volume inspect -f '{{index .Labels "com.docker.compose.volume"}}' "$volume")" == mysql-data ]] \
    || die "volume $volume bukan volume data MySQL demo; tidak dihapus"
  local user
  while read -r user; do
    [[ -z "$user" ]] && continue
    [[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$user")" == "$project" ]] \
      || die "volume $volume dipakai container dari project lain ($user); tidak dihapus"
  done < <(docker ps -aq --filter "volume=$volume")
  if [[ -n "$(compose ps -q mysql 2> /dev/null)" ]]; then
    quiet_guard=1 guard stack
    okay "isi database demo terbukti sintetis"
  fi
  if [[ -z "$confirmation" ]]; then
    say "Ini menghapus SEMUA data demo di volume $volume: akun demo, inquiry sintetis, audit demo."
    say "Konfigurasi dan secret di $(native "$home") tetap disimpan. Project Docker lain tidak disentuh."
    printf 'Ketik nama project (%s) untuk melanjutkan: ' "$project"
    read -r confirmation || true
  fi
  [[ "$confirmation" == "$project" ]] || die "konfirmasi tidak cocok; tidak ada yang dihapus"
  compose down
  docker volume rm "$volume" > /dev/null
  rm -f "$peer_file"
  okay "data demo dihapus. Jalankan start untuk database demo baru (owner perlu dibuat ulang)."
}

usage() {
  cat << EOF
Demo lokal Solveit Admin (data sintetis, bukan deployment). Panduan: docs/development/cloudflare-demo.md

  prepare             siapkan folder status, secret, image, database demo, lalu jalankan
  start               jalankan atau perbarui demo (data tetap)
  tunnel <URL>        pakai URL Quick Tunnel (https://...trycloudflare.com) sebagai alamat admin
  local               kembali ke alamat lokal $local_origin
  owner <email>       buat owner demo (alamat @example.test) dan tampilkan tautan aktivasi
  recover <email>     tautan baru untuk akun demo yang kehilangan autentikator
  seed                tambahkan data sintetis yang belum ada
  check               periksa kesiapan tanpa mengubah apa pun
  status              tampilkan konfigurasi dan container
  stop                hentikan demo (data tetap)
  reset               hapus data demo project ini saja (minta konfirmasi)
EOF
}

main() {
  local command="${1:-help}"
  shift || true
  case "$command" in
    prepare) cmd_prepare ;;
    start) do_start ;;
    tunnel) cmd_tunnel "${1:-}" ;;
    local) cmd_local ;;
    owner) cmd_owner "${1:-}" ;;
    recover) cmd_recover "${1:-}" ;;
    seed) cmd_seed ;;
    check) cmd_check ;;
    status) cmd_status ;;
    stop) cmd_stop ;;
    reset) cmd_reset "${1:-}" ;;
    help | -h | --help) usage ;;
    *) usage >&2; die "perintah tidak dikenal: $command" ;;
  esac
}

# Sourced by test-demo-guards.sh to test classify_probe; run as a command otherwise.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
