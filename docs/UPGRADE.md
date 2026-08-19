# Manual Upgrade Procedure

V1 intentionally has no automatic upgrade command.

1. Record the current DSH, auth package, Node, Caddy, Linux, and configuration versions.
2. Back up `$DSH_HOME`, `/etc/dsh-server-remote`, the Caddy configuration, and `versions.lock`.
3. Pin the target package versions and immutable checksums in a branch or staging copy.
4. Install the target versions on a non-production Linux host.
5. Run L1 static Doctor checks.
6. Run anonymous homepage, API, `events.mux`, and `events.host` checks.
7. Run authenticated API, WebSocket, Session, Prompt, streaming, and core Agent tool smoke tests.
8. Restart DSH and Caddy and reboot the test host.
9. Review failures and known limitations. Do not continue when an authentication entry point is unguarded.
10. Upgrade production only after explicit operator approval, then repeat Doctor and smoke tests.

Rollback restores the previous pinned packages and saved configuration, followed by service restart and the same acceptance checks.
