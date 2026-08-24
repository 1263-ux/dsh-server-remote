# Day 1 PoC Result

## V1 Direction Update

The project is now scoped as `dsh-team-remote`: Linux-resident DSH, Caddy HTTPS, independently verified `dsh-auth-gate`, repeatable deployment, status, doctor, and real core-Agent trial. Operator Lease, Presence, RBAC, approval isolation, full audit, and custom proxy/TLS/auth are explicitly out of V1. Existing PoC code and evidence remain regression references; the temporary HTTP/HTTPS PoC processes were stopped after this decision.


## Status

PARTIAL / READY FOR HUMAN TRIAL

## Implemented

- `src/server.js`: loopback-only HTTP reverse proxy on `127.0.0.1:3090`
- Host rewrite to the configured DSH upstream authority (`127.0.0.1:3080` in production PoC)
- Origin rewrite when present
- `Sec-Fetch-*` preservation
- Streaming HTTP response piping
- WebSocket upgrade tunnel for `/api/events.mux` and `/api/events.host`
- Upgraded socket lifecycle cleanup
- `test/server.test.js`: rewrite, streaming, and WebSocket protocol tests
- `package.json`: start/test scripts

## Verification Evidence

- DSH direct endpoint `127.0.0.1:3080/`: HTTP 200
- PoC homepage `127.0.0.1:3090/`: HTTP 200, DSH SPA content, chunked transfer
- Real DSH RPC through PoC:
  - `POST /api/host.describe`
  - HTTP 200
  - returned actual DSH version `0.0.1`, cwd, provider/model, and attached session count
- Real DSH WebSocket through PoC:
  - `GET /api/events.mux` with valid WebSocket key
  - HTTP 101 Switching Protocols
- Local protocol suite:
  - 3 tests passed
  - rewrite invariant passed
  - delayed/chunked streaming passed
  - WebSocket upgrade/frame tunnel passed

## Known Environment Limitation

- Browser hostname trial using `dsh.test` was not completed because writing `C:\Windows\System32\drivers\etc\hosts` was denied by the current environment.
- `curl --resolve` verified the hostname-shaped HTTP route, but it cannot replace a real browser trial for DSH UI, Prompt, Bash, File, Workspace, Git, Docker, and client-side reconnect behavior.
- The PoC process remains running on `127.0.0.1:3090` for manual trial.

## Additional Round 2 Evidence

- `127.0.0.1.nip.io` resolves to `127.0.0.1`, so it supplied a non-loopback browser authority without editing the system hosts file.
- Real DSH `session.create` through `http://127.0.0.1.nip.io:3090`: HTTP 200, session created with the standard agent preset.
- Real DSH `session.prompt` through the same non-loopback authority: HTTP 200, accepted `执行 pwd && git status`.
- Real `/api/events.mux` received session subscription, queue, assistant, tool-call, tool-result, and turn-end frames.
- Session history confirmed the Agent executed `pwd; git status`; the actual result was returned over the proxied DSH event path. The DSH checkout is not itself a Git repository, so `git status` correctly returned exit code 1.
- WebSocket reconnect protocol trial passed: first mux socket opened and received frames, it was closed, then a second socket opened and received frames.

## Historical Local PoC Trial

1. Open `http://127.0.0.1.nip.io:3090` in a normal browser. This avoids the blocked system hosts-file write and keeps the page hostname non-loopback.
2. Verify the rendered homepage and perform the UI flows: Prompt, `pwd && git status`, file edit, Workspace, Git, Docker, Session history, and visible reconnect behavior.
3. Treat remote Settings/Credentials persistence and native file-open affordances as expected non-loopback limitations, not PoC failures.
4. This local PoC trial is retained as historical context; it is superseded for the remote deployment by the real browser acceptance recorded below.

## Remote Deployment Result (2026-08-22)

Status: DEPLOYED / READY FOR TEAM TRIAL

- Target server: `47.82.119.154`; SSH maintenance access confirmed.
- DSH `0.1.0-rc.8` runs as `root` on `127.0.0.1:3080`; it is not exposed directly.
- Caddy `v2.11.4` is enabled and active on ports `80/443`; HTTP redirects to HTTPS.
- Browser acceptance initially failed on `https://47.82.119.154/` with Chrome `ERR_CERT_AUTHORITY_INVALID`; the explicit IP certificate was self-signed.
- The production entry now uses `https://47.82.119.154.nip.io/`, which resolves to the server and has a publicly trusted Let's Encrypt certificate. Bare-IP HTTP redirects to that hostname.
- Added and verified a second public HTTPS alias, `https://47-82-119-154.sslip.io/`, with its own Let's Encrypt certificate to cover networks that block or mishandle `nip.io`.
- External Caddy logs show Windows Chrome and Windows WeChat clients reaching the public alias over TLS/HTTP2; repeated `/plugins/events` `context canceled` entries mean those clients connected and then canceled the event stream, so the exact client-side failure still needs the affected user's URL/error evidence.
- Clean public-route login checks using the active `admin` account passed on both aliases: login `302`, `/auth/status` authenticated `true`, and `/` HTTP `200`. This validates the server-side login chain, but cannot certify a third party's local DNS/proxy/browser policy without their exact error.
- Real in-app browser acceptance reached `/auth/login?next=%2F`; the rendered login page was visually checked by screenshot and browser console errors/warnings were empty. Admin and temporary team-account login were both exercised.
- Caddy rewrites `Host` to `127.0.0.1:3080` and removes `Origin` to satisfy DSH's trust fence.
- `dsh-auth-gate@0.7.2` is installed in password mode with `cookieSecure: true`; the service is enabled and active.
- Anonymous page access returns `302` to `/auth/login`; authenticated admin access returns `200`.
- Anonymous WebSocket upgrade returns `401`; authenticated `/api/events.mux` upgrade returns `101 Switching Protocols`.
- A disposable second account completed login successfully and was disabled after the test, proving multi-user account handling without leaving an extra active account.
- Authenticated `POST /api/host.describe` returned DSH host/provider/model metadata through the public HTTPS route.

Operational boundary: `dsh-auth-gate` provides independent login accounts, but all accounts share the same root DSH instance, workspace, server authority, and session history. It is not RBAC or per-user isolation. Team members must avoid concurrent destructive operations until a lease/audit layer is added.

## Team Account Acceptance (2026-08-22)

- Created temporary account `team-qa` with the plugin CLI and logged in through the real browser at `https://47.82.119.154.nip.io/`.
- Browser evidence: the account reached the DSH main page, rendered the first-use notice, workspace selector (`test-kb`), session list, prompt editor, access-mode selector, model selector, and sign-out control.
- Submitted a real prompt from the team account: `pwd && whoami && printf TEAM_QA_OK`.
- DSH approval flow appeared as expected because the host has no usable `workspace-write` sandbox backend. After one approval, the command completed successfully with `/root/test-kb`, `root`, and `TEAM_QA_OK`; the result was confirmed in the persisted session JSONL.
- Disabled `team-qa` after the test. A subsequent public HTTPS login attempt returned `401`; `dsh` and `caddy` remained active and enabled.

### Team Acceptance Decision

Functional acceptance passes for the stated baseline: a second account can log in through the public browser and control the Linux host. Strict isolation acceptance does not pass: the second account is also root, sees the same workspace/session authority, and disabling an account does not revoke already-issued sessions until expiry. This is a shared-root operator console, not a multi-tenant system.

## OKS / dsh-oks Acceptance (2026-08-22)

Status: DEPLOYED / CONNECTED / TOOL-VERIFIED

- Installed OKS 0.6.5 with Python 3.12 and pipx. The active root is the existing knowledge base `/root/test-kb`; the empty `/opt/oks-knowledge-base` is not used, avoiding a split knowledge store.
- Active status: Wiki 6, Raw 110 files, 11 Raw evidence bundles, Drafts 0, Domains 1, quality average 55.0/100, active coverage 100%.
- Installed `dsh-oks` from `github:open-agent-power/dsh-oks`. Because its upstream host entry points to TypeScript source and Node 24 rejects type stripping under `node_modules`, built a host ESM artifact and redirected the installed package entry points; backups are under `/root/dsh-deploy-backup`.
- Rebuilt the DSH browser/client bundles with `/opt/dsh` `pnpm run build`, restarted DSH, and verified `dsh` and `caddy` are active.
- Browser acceptance passed at `https://47.82.119.154.nip.io/`: Settings contains an `OKS` section, reports `已连接`, and lists the original Wiki entries for OCR, DOCX, PDF, and multimodal ingest.
- Real Agent acceptance passed: `oks_status` and `oks_recall` returned the expected statistics and DOCX/PDF/OCR/multimodal hits without bash execution.
- `oks lint` has one pre-existing warning: `wiki/oks-concepts.md` uses `status: published`, which the current linter does not accept. It was left unchanged to preserve original data.

Operational boundary: dsh-oks adds OKS recall/status/Wiki browsing to the existing shared-root DSH authority; it does not add per-user knowledge-base isolation or RBAC.

## Remote Configuration Repair / dev-loop Closure (2026-08-22)

Status: FIXED / REMOTE ACCEPTANCE PASSED

### Findings

- The `manifest.webmanifest` 401 was caused by `dsh-auth-gate` protecting every route by default, not by a TLS handshake failure.
- DSH intentionally restricted privileged RPCs such as `settings.*`, `credentials.*`, and `llm.discoverModels` to loopback. A public browser therefore could not load the provider directory or persist host settings even after login.
- The browser settings client also downgraded every non-loopback page to the in-memory scope. This made the OKS settings screen appear empty and disconnected from the server-side knowledge base.

### Implemented repair

- Added an opt-in authenticated privileged-RPC path in the DSH connection layer. It asks the installed `dsh-auth-gate` for the current request decision and accepts only an authenticated `allow`; anonymous requests remain denied and loopback behavior is unchanged.
- Enabled that path in `/root/.dsh/cordis.patch.yml` for this deployment.
- Added an explicit web-build marker for this authenticated deployment so the settings client uses the host scope after login. The marker does not grant access; the server-side auth check remains mandatory.
- Changed Caddy to anonymously serve only the exact `manifest.webmanifest` and `favicon.svg` files. API, WebSocket, JavaScript assets, and all other pages remain behind login.
- Backups of changed remote files are under `/root/dsh-deploy-backup/repair-20260822-authenticated`.

### Verification evidence

- Full DSH build passed after the changes.
- Targeted connection/settings regression suite passed: 2 test files, 34 tests.
- `dsh` and `caddy` are both `active` and `enabled`; the last ten minutes of DSH journal contain no error entries.
- Both public aliases return `manifest.webmanifest` as HTTP 200 with `application/manifest+json`; anonymous `/api/settings/describe` remains HTTP 401 on both aliases.
- Fresh authenticated browser acceptance showed the DeepSeek provider with “API 密钥已配置” and the OKS panel with “已连接” plus the existing Wiki/Raw statistics and entries.
- Model smoke test returned `MODEL_SMOKE_OK` in about two seconds with no tool call; browser error logs were empty.
- OKS tool acceptance (`oks_status` and `oks_recall`) returned the existing knowledge-base statistics and DOCX/PDF/OCR/multimodal hits.

### Remaining team-use risks

- All authenticated accounts still share one root DSH process, Linux authority, workspace, session history, model credentials, and OKS knowledge base. The new authenticated settings path intentionally lets team members use the shared model/OKS configuration; it is not RBAC or tenant isolation.
- `dsh-auth-gate` accounts are independent login identities, but the current deployment does not provide per-user filesystem permissions, approval policy, audit trail, or concurrent-operation locking. This remains the main production hardening item for a larger team.
- The existing OKS linter warning for `wiki/oks-concepts.md` (`status: published`) remains unchanged because it is source-data compatibility, not a deployment failure.

## Feishu Login Directory / dsh-feishu-auth-sync (2026-08-24)

Status: PORTABLE IMPLEMENTATION VERIFIED / REMOTE INTEGRATION PENDING FEISHU AUTHORIZATION

### Confirmed auth-gate facts

- Remote `dsh-auth-gate@0.7.2` uses `/root/.dsh/auth/users.yaml` by default.
- The native schema is `version: 1` with `users.<username>.passwordHash` and optional `disabled`.
- The native password format is scrypt, not Argon2 or bcrypt.
- Password login reloads the users file for each attempt, so a successful sync does not require restarting DSH.
- Existing sessions validate against the session store and do not re-read the users file; disabling an account affects new logins only.

### Local implementation

- Added `feishu-auth-sync/`, a standalone Fetch/Validate/Normalize/Publish adapter.
- Reads Feishu Bitable records through the server-side tenant token flow.
- Publishes the native auth-gate users YAML with atomic replacement, fsync, mode 0600, and metadata.
- Rejects invalid usernames, invalid native scrypt hashes, duplicate records, empty remote snapshots, and local/remote username collisions.
- Preserves last-known-good data during short Feishu failures.
- After the stale threshold, publishes only the root-owned local break-glass users file; without one, new password logins remain denied.
- Added systemd service/timer templates without real credentials.
- Added portable environment configuration for API base URL, request timeout, page size, and arbitrary Bitable field names.
- Added `node src/cli.js hash-password` to generate the installed auth-gate-compatible native scrypt format without storing plaintext.
- Tightened scrypt validation to require the real 16-byte salt and 32-byte derived key lengths used by `dsh-auth-gate`.
- Added a no-secret environment template at `config/dsh-feishu-auth.env.example`.

### Verification

- Syncer-specific tests: 9 passed, 0 failed after the stricter native-hash validation.
- Generated a test hash with the new CLI and confirmed the expected native format; no plaintext was persisted.
- All syncer and auth-plugin JavaScript files passed `node --check`.
- CLI rejects missing Feishu configuration.
- No real Feishu credentials, password hashes, tokens, or account data were added to the repository.

### Blocker for remote integration

The Feishu home page is reachable, but the developer console requires the Owner's browser login. The Owner must authenticate at the Feishu developer console and authorize the enterprise app to read the selected Bitable. App ID, app secret, app token, table ID, and the approved break-glass account procedure must be transferred through a secure server-side channel, never Git or chat. Remote deployment, dry-run, and login acceptance remain pending those inputs.
