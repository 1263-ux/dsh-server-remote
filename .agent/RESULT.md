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

## Required Human Trial

1. Open `http://127.0.0.1.nip.io:3090` in a normal browser. This avoids the blocked system hosts-file write and keeps the page hostname non-loopback.
2. Verify the rendered homepage and perform the UI flows: Prompt, `pwd && git status`, file edit, Workspace, Git, Docker, Session history, and visible reconnect behavior.
3. Treat remote Settings/Credentials persistence and native file-open affordances as expected non-loopback limitations, not PoC failures.
4. Current environment still lacks a usable browser automation/debugging entry, so this UI trial remains a human acceptance gate rather than a claimed automated pass.
