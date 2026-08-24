# dsh-server-remote V1 Implementation Plan

## Day 0: evidence and version freeze
- Fix the exact repository, package, release, commit, license, DSH target, Node runtime, Caddy version, and Linux baseline.
- Record them in `versions.lock`; record the provenance and evidence level in `EVIDENCE.md`.
- Treat `TecFancy/dsh-auth-gate` as the preferred candidate, not a verified dependency, until source and Linux E2E pass.
- Do not use a same-name auth project from another author by accident.


## 1. Dependency gate and Go/No-Go
- Obtain and pin the exact `dsh-auth-gate` repository/package, commit or tarball, release, license, install protocol, and DSH target.
- Confirm the candidate is obtainable and auditable. If the repository/package cannot be fetched or its source cannot be inspected, mark the dependency `BLOCKED/UNVERIFIED` and do not publish V1 on it.
- Verify configuration schema, password storage, cookie/token behavior, rate limiting, logout/disable semantics, fail-closed startup, and manual upgrade/rollback notes.
- Exercise anonymous and authenticated HTTP/API/WebSocket paths against the pinned DSH version.
- Confirm the candidate is an internal DSH plugin and that it actually mounts in the selected web profile; do not infer this from the package name.
- Keep the current Node PoC until this gate passes.
- GO only when source/package access, license, install shape, DSH compatibility, anonymous HTTP/API/dual-WS rejection, and authenticated core smoke tests all pass.
- Because `dsh-auth-gate@0.7.2` declares the rc.6 dependency line while production is running DSH rc.8, rc.8 compatibility remains an explicit risk; the remote smoke tests below are the current evidence, not a substitute for upstream release compatibility.
- The npm tarball shasum/integrity is the immutable package identity until a git commit is independently resolved.
- NO-GO when any of those gates fails. Investigate `dsh-plugin-remote` only as a fallback after a concrete A failure; do not run a parallel feature comparison by default.

## 2. Integration validation
- Run DSH on `127.0.0.1:3080` as a non-root service.
- Put Caddy in front on ports 80/443 with WebSocket proxying and DSH-compatible upstream Host/Origin normalization.
- Verify anonymous homepage, API, and WebSocket are denied.
- Verify authenticated login, Prompt, streaming, Bash, Git, Docker, file operations, Session history, and reconnect.
- Record remote Settings/Credentials/native file-open limitations as expected behavior where applicable.

## 3. Deployment packaging
- Add Linux install script with preflight, displayed plan, explicit confirmation, domain, administrator account, and hidden password input.
- Add systemd units/templates for DSH and Caddy, non-root ownership, restart policy, boot ordering, and explicit Docker-socket risk documentation.
- Add Caddy configuration template, firewall guidance, version manifest, status command, uninstall path, and manual `UPGRADE.md` procedure.
- Do not implement automatic upgrade in V1.
- Do not add a custom proxy, TLS implementation, user/session store, database, or OAuth provider.

## 4. Doctor and recovery
- Implement layered checks: L1 static files/versions/services/permissions, L2 real anonymous local/public-facing HTTP/API/WS requests, and L3 explicitly supplied authenticated credentials for API/WS/Prompt smoke tests.
- Label public-network checks `HUMAN_TRIAL_REQUIRED` when a VPS self-check cannot prove them.
- Make failures actionable and fail closed where a security boundary cannot be proven; never print or persist test credentials.
- Test DSH restart, Caddy restart, machine reboot, network interruption, long-running task, mobile network, and campus network.

## 5. Trial and release
- Have 3–5 team members use the deployment for one week or the available equivalent trial.
- Capture login friction, disconnects, restart recovery, core DSH workflows, account disablement, and concurrent-operation confusion in `V1 Feedback.md`.
- Publish known limitations: DSH is not multi-tenant; avoid concurrent side-effecting changes; no fine-grained permissions, approval isolation, or command audit; remote Settings/Credentials may be limited by upstream UI behavior.
- Only promote Lease or other coordination features when trial evidence demonstrates a repeated need.

## Acceptance
The single release checklist is:
1. Clean Linux VPS install completes without SQL/Redis and DSH runs as non-root.
2. DSH listens only on loopback; public/non-loopback access to port 3080 fails.
3. Caddy provides valid HTTPS and WebSocket proxying.
4. Each member has an independent account.
5. Anonymous homepage/API and both WebSocket upgrades are rejected through the public route.
6. Authenticated Prompt and streaming work.
7. Authenticated Bash, Git, Docker, file operations, Session history, and reconnect work.
8. DSH restart, Caddy restart, and server reboot recover automatically.
9. Mobile and PC access work from an external network.
10. Three real members complete a trial, including one continuous hour without a severe failure.

A V1 release is GO only when all ten items pass; otherwise record the blocker and remain pre-release.

## Phase 2: Minimal team login directory (design only, 2026-08-24)

### Goal

Use one Feishu Bitable table as the administrator-maintained login directory for DSH. The scope is only login allow/deny; it does not attempt per-user Linux, DSH, model, or OKS permissions.

### Confirmed design

- Keep `dsh-auth-gate` as the browser-facing login/session layer.
- Add a small server-side account sync process that reads one configured Bitable table through a Feishu enterprise app and `tenant_access_token`.
- Publish the native `dsh-auth-gate` `/root/.dsh/auth/users.yaml` format; the installed gate uses scrypt hashes and reloads this file on every password login, so no DSH or plugin modification is needed.
- Sync every 60 seconds through a systemd timer; never call Feishu from DSH API or WebSocket request paths.
- Store only `账号`, `密码哈希`, `启用`, `显示名`, and optional `备注` fields. Never store plaintext passwords in Feishu.
- Preserve a separate root-only local users file for a break-glass account and merge it into the published native users file. Local/remote username collisions fail closed.
- Validate, normalize, reject empty/duplicate/invalid snapshots, write metadata, fsync, chmod 0600, and atomically replace the users file.
- Keep last-known-good data while sync age is within 10 minutes. After that, publish only the local break-glass users; if none exist, new password logins remain denied.
- Existing sessions are not forcibly revoked; account state controls new authentication only.

### Minimal Bitable fields

`账号` · `密码哈希（dsh-auth-gate 原生 scrypt 格式）` · `启用` · `显示名` · `备注`

### Non-goals

- No Feishu OAuth login.
- No per-user DSH capability or Linux UID mapping.
- No role matrix, approval workflow, audit database, or permission inheritance.
- No Feishu API call on every DSH API/WebSocket event.
- No custom password algorithm conversion; use the installed auth-gate verifier format.

### Acceptance

1. An enabled row can log in through both public aliases.
2. A disabled row cannot start a new session after the cache refresh window.
3. Existing DSH API/WebSocket authentication behavior remains unchanged.
4. Feishu app credentials are root-owned and never exposed to the browser or Agent prompt.
5. Plaintext passwords never appear in the table, logs, result artifacts, or error messages.
6. If Feishu is unavailable, the service exposes a clear health status, preserves last-known-good data temporarily, and never silently allows unknown accounts.
7. A malformed, duplicate, empty, or invalid-hash remote snapshot never destroys a valid cache.
8. A local break-glass account can recover login after the stale threshold without depending on Feishu.

### Owner gate before implementation

The Owner must provide or approve the Feishu enterprise app, Bitable app token, table ID, and the exact administrator workflow for generating native scrypt password hashes. Implementation of the remote connection must not begin until those values are supplied through a secure channel; they must not be pasted into source files or chat.

### Confirmed auth-gate facts (2026-08-24)

- Package: `dsh-auth-gate@0.7.2`.
- Default users file: `${DSH_HOME}/auth/users.yaml`, currently `/root/.dsh/auth/users.yaml`.
- Schema: `version: 1`, `users.<username>.passwordHash`, optional `disabled`.
- Password verifier: native scrypt format `scrypt$N$r$p$salt$hash`.
- Login path reloads the users file on each password attempt; changes do not require a DSH restart.
- Existing Session validation reads the session table and does not re-check the users file; disabling affects new logins only.
- The implementation lives in `feishu-auth-sync/`; remote deployment is pending the Owner's Feishu app/table parameters and break-glass account setup.
