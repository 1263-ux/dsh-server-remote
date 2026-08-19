# dsh-server-remote

A small-team deployment kit for running DeepSeek Harness on a Linux server and accessing it through HTTPS with independent accounts.

## V1 scope

```text
Caddy HTTPS
  -> DeepSeek Harness on 127.0.0.1:3080
  -> dsh-auth-gate inside the DSH web profile
```

This project focuses on repeatable installation, service recovery, version evidence, smoke tests, and Doctor diagnostics. It does not implement a new auth system, proxy, TLS layer, RBAC, Operator Lease, approval isolation, or database.

## Status

Pre-release. The local HTTP/WebSocket reference PoC and dependency source audit are complete. Linux VPS integration, Caddy E2E, authenticated smoke tests, reboot recovery, and external team trial remain open gates.

See:

- [`EVIDENCE.md`](EVIDENCE.md) for evidence levels and the current dependency audit.
- [`versions.lock`](versions.lock) for the version freeze.
- [`docs/SECURITY.md`](docs/SECURITY.md) for the security boundary and Docker warning.
- [`docs/UPGRADE.md`](docs/UPGRADE.md) for the manual upgrade procedure.
- [`.agent/PLAN.md`](.agent/PLAN.md) for the Go/No-Go release checklist.

## Local checks

```sh
npm test
```

The Linux installer intentionally fails closed while `versions.lock` still contains `UNKNOWN` values. Do not expose DSH port `3080` publicly.
