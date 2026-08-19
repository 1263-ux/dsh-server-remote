#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${DSH_SERVER_DOMAIN:-}"
ASSUME_YES=0
if [[ "${1:-}" == "--yes" ]]; then ASSUME_YES=1; fi

fail() { printf 'install: ERROR: %s\n' "$*" >&2; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"; }

[[ $EUID -eq 0 ]] || fail 'run with sudo; no files are changed before preflight completes'
[[ -n "$DOMAIN" ]] || fail 'set DSH_SERVER_DOMAIN to the public DNS name'
[[ "$DOMAIN" != *'/'* && "$DOMAIN" != *' '* ]] || fail 'DSH_SERVER_DOMAIN is not a valid host name'

for cmd in awk curl install node systemctl; do require_cmd "$cmd"; done
[[ -f "$ROOT_DIR/versions.lock" ]] || fail 'versions.lock is missing'
if grep -Eq 'version: UNKNOWN|production_version: UNKNOWN|distribution: UNKNOWN' "$ROOT_DIR/versions.lock"; then
  fail 'versions.lock still contains UNKNOWN values; freeze versions before installation'
fi

printf '%s\n' 'The installer will:'
printf '%s\n' "- configure DSH domain: $DOMAIN"
printf '%s\n' '- create or update the dedicated dsh service user and /var/lib/dsh'
printf '%s\n' '- install pinned DSH/auth/Caddy artifacts from the locked manifest'
printf '%s\n' '- install systemd units and a Caddy configuration'
printf '%s\n' '- run static validation and anonymous smoke tests'
if (( ! ASSUME_YES )); then
  read -r -p 'Continue? [y/N] ' answer
  [[ "$answer" =~ ^[Yy]$ ]] || { printf '%s\n' 'install: cancelled'; exit 0; }
fi

# Package installation and service activation are deliberately not implicit yet.
# They require the selected Linux distribution, exact DSH artifact, and Caddy pin.
fail 'deployment adapters are not enabled until the Linux baseline and exact versions.lock are finalized'
