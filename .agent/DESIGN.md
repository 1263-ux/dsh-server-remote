# dsh-server-remote V1 Design

## Evidence rule
A candidate dependency is not a production dependency until its repository, package, release, commit, license, DSH target, and Linux E2E result are recorded in `versions.lock` and `EVIDENCE.md`. Upstream claims remain documented claims until reproduced.


## Goal
让小团队能够低成本、稳定地把 DeepSeek Harness 部署到 Linux 服务器，并通过公网 HTTPS 登录后长期使用核心 DSH Agent 能力。

## Scope
- DSH 作为服务器上的 Agent 本体，监听 loopback。
- `dsh-auth-gate` 作为认证边界，提供独立成员账号和登录状态；集成前必须验证其源码、版本、许可证以及 HTTP/WebSocket 覆盖范围。
- Caddy 负责公网 HTTPS、反向代理和 WebSocket 转发。
- systemd 负责 DSH/Caddy 常驻、崩溃重启和开机恢复。
- 本项目负责部署模板、`install.sh`、`status`、`doctor`、版本兼容检查和文档。

## Non-goals for V1
- Operator Lease、Presence、RBAC、细粒度权限。
- 完整 Audit、命令级审计或 Approval 隔离。
- 自研登录、Session、HTTP proxy、WebSocket proxy 或 TLS。
- SQL、Redis、OAuth、SSO、多 Workspace 隔离。
- DSH fork 或上游功能补丁。

## Key decisions
1. 继续保留当前 Node PoC 作为 Host/Origin、HTTP streaming、WebSocket 和真实 Agent 链路的回归参考，不作为正式常驻网关。
2. 在确认 `dsh-auth-gate` 能拒绝匿名 HTTP、API 和 WebSocket upgrade 前，不删除 PoC，也不承诺它替代认证 Day 2。
3. DSH 只绑定 `127.0.0.1:3080`，公网只开放 Caddy 的 80/443；DSH 和团队服务均以非 root 用户运行。
4. V1 团队协调依靠明确规则：多人拥有独立账号，但避免同时对同一服务器环境执行有副作用的操作。该限制必须写入文档。
5. 远程 Settings/Credentials 等受 DSH UI loopback 判断限制的能力记录为已知限制，除非真实试用证明它阻塞核心使用，否则不进入 V1。

## Acceptance
- Linux 云服务器可常驻运行 DSH。
- DSH 只监听 loopback；从公网或非 loopback 网络访问 3080 失败。服务器本机 loopback 访问是预期行为，不是认证边界。
- 每名成员使用独立账号；未登录 HTTP/API/WS 均被拒绝。
- 登录后 Prompt、Streaming、Bash、Git、Docker、文件操作、Session 历史和 WebSocket 重连可用。
- 服务器、DSH、Caddy 重启后自动恢复。
- `install.sh`、`dsh-team status`、`dsh-team doctor` 能给出可操作结果。
- 手机网络、校园网或等价外网环境稳定使用 1 小时且无严重异常。

## Known limitations
- DSH 当前不是完整多租户执行环境；成员应避免同时修改同一服务器状态。
- V1 不提供细粒度权限、Operator Lock、Approval 隔离或命令级审计。
- 部分远程 Settings/Credentials/native file-open 能力受 DSH 上游和浏览器安全上下文限制。
