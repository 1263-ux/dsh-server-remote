# Security Boundary

## V1 boundary

The public entry point is Caddy on ports 80/443. DSH must listen only on `127.0.0.1:3080`; port 3080 must not be exposed by the firewall or cloud security group.

`dsh-auth-gate` protects the DSH web surface. Authentication is not provided by DSH's Host/Origin trust fence. The fence is a reachability policy, not an identity boundary.

V1 does not provide RBAC, command audit, approval isolation, workspace isolation, or a multi-tenant execution sandbox. Team members must avoid concurrent side-effecting operations against the same server environment.

## Docker warning

Running DSH as a non-root Unix user does not make the Agent a low-privilege sandbox. If that user can access `/var/run/docker.sock` or belongs to the Docker group, the Agent has near-root control over the host. Grant Docker access only when the deployment accepts this risk.

## Proxy rules

- Rewrite upstream `Host` and an existing `Origin` for the DSH loopback trust fence.
- Do not trust client-supplied `X-Forwarded-For` for security decisions.
- Do not forward proxy session cookies to an unrelated upstream.
- Preserve WebSocket upgrade headers and strip hop-by-hop headers according to Caddy's proxy behavior.
- Never log passwords, cookies, bearer tokens, API keys, credentials, or full Prompt bodies.

## Authentication limitations

The V1 auth candidate stores sessions according to its package implementation. DSH/auth restarts and disabled-user behavior must be verified on the pinned deployment; do not assume that disabling a user revokes already-issued sessions.

## Upgrade rule

Do not auto-update DSH or the auth plugin in V1. Every version change requires a backup, a test deployment, anonymous HTTP/API/WS checks, authenticated smoke tests, and an explicit operator decision.
