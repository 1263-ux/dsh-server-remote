#!/usr/bin/env bash
set -uo pipefail

DOMAIN="${DSH_SERVER_DOMAIN:-}"
DSH_URL="${DSH_LOCAL_URL:-http://127.0.0.1:3080}"
FAILURES=0

pass() { printf '%-34s PASS\n' "$1"; }
fail() { printf '%-34s FAIL: %s\n' "$1" "$2"; FAILURES=$((FAILURES + 1)); }
manual() { printf '%-34s HUMAN_TRIAL_REQUIRED\n' "$1"; }

has_command() {
  if command -v "$1" >/dev/null 2>&1; then pass "$2"; else fail "$2" "missing command: $1"; fi
}

printf '%s\n' 'L1 Static'
has_command node 'Node installed'
has_command dsh 'DSH installed'
has_command caddy 'Caddy installed'
has_command systemctl 'systemd available'

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet dsh.service; then
  pass 'DSH service active'
else
  fail 'DSH service active' 'dsh.service is not active'
fi

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet caddy.service; then
  pass 'Caddy service active'
else
  fail 'Caddy service active' 'caddy.service is not active'
fi

if command -v ss >/dev/null 2>&1; then
  listeners="$(ss -ltnH 'sport = :3080' 2>/dev/null || true)"
  if [[ -z "$listeners" ]]; then
    fail 'DSH loopback listener' 'nothing listens on port 3080'
  elif grep -Eq '(^|[[:space:]])(127\.0\.0\.1|\[::1\]):3080([[:space:]]|$)' <<<"$listeners" && ! grep -Eq '(^|[[:space:]])(0\.0\.0\.0|\[::\]|\*):3080([[:space:]]|$)' <<<"$listeners"; then
    pass 'DSH loopback listener'
  else
    fail 'DSH loopback listener' "port 3080 is not loopback-only: $listeners"
  fi
else
  fail 'DSH loopback listener' 'ss command unavailable'
fi

printf '\n%s\n' 'L2 Anonymous Runtime'
if curl --silent --show-error --fail --max-time 5 "$DSH_URL/" >/dev/null; then
  pass 'DSH local HTTP'
else
  fail 'DSH local HTTP' "$DSH_URL is unavailable"
fi

if [[ -z "$DOMAIN" ]]; then
  fail 'Public HTTPS route' 'set DSH_SERVER_DOMAIN'
else
  public="https://$DOMAIN"
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 --header 'Accept: text/html' "$public/" || true)"
  if [[ "$status" == 302 || "$status" == 401 || "$status" == 403 ]]; then
    pass 'Anonymous HTTP blocked'
  else
    fail 'Anonymous HTTP blocked' "expected 302/401/403, got ${status:-request-error}"
  fi

  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 --request POST --header 'Content-Type: application/json' --data '{}' "$public/api/host.describe" || true)"
  if [[ "$status" == 401 || "$status" == 403 ]]; then
    pass 'Anonymous API blocked'
  else
    fail 'Anonymous API blocked' "expected 401/403, got ${status:-request-error}"
  fi

  if command -v node >/dev/null 2>&1 && [[ -f "${DSH_SERVER_ROOT:-/opt/dsh-server-remote}/tests/ws-probe.mjs" ]]; then
    for path in /api/events.mux /api/events.host; do
      if node "${DSH_SERVER_ROOT:-/opt/dsh-server-remote}/tests/ws-probe.mjs" "wss://$DOMAIN$path" 401; then
        pass "Anonymous WS $path blocked"
      else
        fail "Anonymous WS $path blocked" 'expected HTTP 401 during upgrade'
      fi
    done
  else
    fail 'Anonymous WebSocket checks' 'Node probe is unavailable'
  fi
fi

printf '\n%s\n' 'L3 Authenticated Runtime'
manual 'Authenticated login/API/WS'
manual 'Prompt and Agent tools'
manual 'External mobile/PC network'
manual 'One-hour team trial'

exit "$FAILURES"
