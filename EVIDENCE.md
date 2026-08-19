# dsh-server-remote Evidence Ledger

Evidence levels:

- `LOCAL_VERIFIED`: observed from the local DSH source or a reproducible local test.
- `UPSTREAM_DOCUMENTED`: stated by an upstream discussion/README; not independently verified here.
- `THIRD_PARTY_CLAIMED`: a community project claim awaiting source and runtime inspection.
- `E2E_VERIFIED`: reproduced on the pinned Linux deployment and target DSH version.
- `UNKNOWN`: no reliable evidence yet.

## Local PoC: LOCAL_VERIFIED

- DSH loopback endpoint responded on `127.0.0.1:3080`.
- Reference Node proxy rewrote upstream Host and Origin.
- HTTP streaming passed through without buffering.
- `/api/events.mux` WebSocket upgrade and frames passed through.
- Real `session.create` and `session.prompt` passed through the PoC.
- Event frames included subscription, queue, assistant, tool-call, tool-result and turn-end.
- Protocol-level reconnect opened a second mux socket successfully.
- DSH source inspection shows remote browser authority changes `isLoopback` behavior and can limit some Settings/Credentials/AgentPreset UI. A complete real-browser UI trial remains open; treat this as source-observed and an expected V1 limitation until human trial.

Evidence files: `.agent/RESULT.md`, `src/server.js`, `test/server.test.js`, `dsh-remote-gateway-可行性研究报告.md`.

## TecFancy/dsh-auth-gate: SOURCE_AUDITED / PREFERRED CANDIDATE / NOT E2E VERIFIED

Sources: npm registry metadata and downloaded tarball `dsh-auth-gate@0.7.2`; upstream discussion: `https://github.com/deepseek-ai/deepseek-harness/discussions/3360`.

Confirmed from the package manifest/tarball:

- repository `TecFancy/dsh-auth-gate`
- npm package `dsh-auth-gate@0.7.2`
- MIT license and included `LICENSE`
- Node engine `>=22.19.0`
- DSH bundle manifest with `cordis.patch.yml`
- web profile install shape: `dsh plugin --profile web add dsh-auth-gate`
- package checksum: shasum `236debdc73c23138f9e28781e054095bd0e99278`
- package integrity: `sha512-g2x+90ldjEMC5R7Zj9upqpHfjxyUQ66KMueg6cpBkVXdTRkyHmCPTSgJstE4P6H+wCkNABgesf9y/NiGdCU1FA==`

Confirmed by static inspection of the distributed JavaScript:

- hard inject dependency on `webServer`
- wraps exact routes, prefix routes, fallback, and upgrade routes
- wraps future registrations and upgrade registrations
- startup self-check throws if any route or registration method is unguarded
- password mode uses scrypt with random salt and timing-safe comparison
- users file is schema-checked and rejected when group permissions are present; writes use atomic replacement and mode `0600`
- session cookies are `HttpOnly`, `Secure` by default, `SameSite=Lax`; session rows use a storage domain and store only a SHA-256 token digest
- login rate limiting uses IP and account buckets with exponential delay

Still open:

- npm package has DSH dependencies/devDependencies in the rc.6 line while the current production target is rc.7.
- No Linux install, profile mount, Caddy integration, anonymous HTTP/API/dual-WS, authenticated core workflow, restart, or external-network E2E has passed.
- Git commit identity remains unknown; the npm tarball checksum is the current immutable package identity.
- Existing-session behavior after user disable and restart must be tested against the installed package, not only README claims.

## Other candidates: THIRD_PARTY_CLAIMED

- `https://github.com/siberiah2o/dsh-plugin-remote`: fallback/reference candidate; do not use by default.
- `https://github.com/JUANWANG-BUAA/dsh-full-remote`: security and privileged-remote reference only.
- `https://github.com/NIyueeE/dsh-container`: deployment/Caddy reference only.
- `https://github.com/iiwish/dsh-testkit`: candidate testing approach; not a V1 runtime dependency.

Public search did not independently return stable repository metadata for all candidates. Do not upgrade these entries to verified without direct source access and a fixed revision.

## V1 gates still open

1. Capture exact DSH Linux version and commit; distinguish package version from runtime-reported version.
2. Capture auth package tarball/repository commit and verify its install/runtime shape.
3. Pin Caddy, Node runtime, and target Linux baseline.
4. Prove 3080 is unreachable from the public/non-loopback network; local loopback access is expected and is not an authentication boundary.
5. Run anonymous HTTP/API/`events.mux`/`events.host` tests through the public Caddy route.
6. Run authenticated API/WS/Prompt/streaming/core-tool tests.
7. Run restart and external-network trial.
8. Apply the Go/No-Go rules in `.agent/PLAN.md`.

## Day 0 execution record

- `npm view dsh-auth-gate` succeeded: version `0.7.2`, MIT, repository `https://github.com/TecFancy/dsh-auth-gate`, Node `>=22.19.0`.
- `npm view @deepseek-ai/dsh` succeeded: latest `0.1.0-rc.7`, MIT, repository `https://github.com/deepseek-ai/deepseek-harness`.
- `npm pack dsh-auth-gate@0.7.2` succeeded and its tarball was statically audited under `.agent/day0/package`.
- Existing local proxy regression remains green: 3 tests passed.
- GitHub API/`git ls-remote` and Linux runtime access were not available in this Windows environment; commit resolution and Linux E2E remain open.
- WSL enumeration was access-denied and Docker daemon inspection timed out; no Linux deployment result is claimed.
