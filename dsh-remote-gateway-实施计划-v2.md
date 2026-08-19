# dsh-team-remote V1 实施计划

> 本计划取代原来的“自研认证 + Gateway + Operator Lock”路线。V1 只验证并产品化：Linux 常驻 DSH、公网 HTTPS、独立账号登录、认证后的核心 Agent 使用，以及可重复部署和 Doctor。

## 1. V1 边界

### 做

- DSH 作为服务器上的 Agent 本体，监听 `127.0.0.1:3080`。
- `dsh-auth-gate` 提供成员账号、登录、会话和 HTTP/WebSocket 认证。
- Caddy 提供公网 HTTPS、反向代理和 WebSocket 转发。
- systemd 提供常驻、崩溃重启和开机恢复。
- 本项目提供 `install.sh`、`dsh-team status`、`dsh-team doctor`、配置模板、版本检查和部署文档。
- 真实验证 Prompt、Streaming、Bash、Git、Docker、文件操作、Session 历史和 WebSocket 重连。

### 不做

- 自研登录、Session、HTTP Proxy、WebSocket Proxy 或 TLS。
- SQL、Redis、OAuth、SSO、RBAC、细粒度权限、多 Workspace 隔离。
- Operator Lease、Presence、完整 Audit、命令级审计或 Approval 隔离。
- DSH fork 或上游功能补丁。

团队规则先写清楚：多人拥有独立账号，但应避免同时对同一服务器环境执行有副作用的操作。真实试用反复证明需要后，再设计 V1.1 的简单 Operator Lock。

## 2. 依赖门禁：固定 dsh-auth-gate

在集成前必须拿到准确的仓库、版本或 commit，并核验：

- 许可证和维护状态。
- 支持的 DSH 版本、安装协议和配置 schema。
- 用户配置与密码存储、文件权限和禁用用户语义。
- Cookie/Bearer Token 的 TTL、Secure、HttpOnly、SameSite 和注销失效行为。
- 登录失败限流和 fail-closed 启动行为。
- 普通 HTTP、DSH API、`/api/events.mux`、`/api/events.host` WebSocket upgrade 是否全部受保护。
- 认证用户身份是否通过稳定接口暴露；团队项目不得解析 auth-gate 私有 session 内部。
- 升级、回滚和与当前 DSH 版本的兼容性。

在此门禁通过前，当前 `src/server.js` PoC 不删除。它保留为 Host/Origin、HTTP streaming、WebSocket 和真实 Agent 链路的回归参考，不作为正式常驻网关。

## 3. Day 1：集成验证

固定版本并运行：

```text
Caddy → dsh-auth-gate + DSH
```

DSH 保持 loopback 监听，Caddy 负责公网入口和 WebSocket 转发。需要确认 DSH 所需的 upstream `Host` / `Origin` 正规化在 Caddy 配置中正确完成。

验收矩阵：

| 场景 | 预期 |
|---|---|
| 匿名首页 | 拒绝或跳转登录 |
| 匿名 API | 拒绝 |
| 匿名 `/api/events.mux` | WebSocket 握手拒绝 |
| 匿名 `/api/events.host` | WebSocket 握手拒绝 |
| 登录 | 成功 |
| Prompt / Streaming | 成功 |
| Bash / Git / Docker | 成功 |
| 文件操作 | 成功 |
| Session 历史 | 成功 |
| WebSocket 断线重连 | 成功 |

远程 Settings/Credentials、native file-open 等受 DSH UI loopback 判断限制的能力记录为已知限制，不因它们扩展 V1 范围。

## 4. Day 2：部署化

提供：

- `install.sh`：输入域名、管理员账号和密码，生成或安装所需配置。
- DSH 与 Caddy 的 systemd unit/template。
- 非 root 专用用户、目录所有权和最小权限。
- Caddy HTTPS 配置模板和 WebSocket 反代配置。
- 防火墙说明：公网只开放 80/443，3080 不开放。
- DSH、auth-gate、Caddy 的版本固定、检查和回滚说明。
- `dsh-team status` 查看服务状态、监听地址和当前版本。

不引入自研认证存储、数据库、代理进程或 TLS 代码。

## 5. Day 3：Doctor 与恢复

`dsh-team doctor` 至少检查：

```text
DeepSeek Harness        PASS/FAIL
Auth plugin             PASS/FAIL
DSH loopback            PASS/FAIL
HTTPS                   PASS/FAIL
Anonymous HTTP blocked  PASS/FAIL
Anonymous API blocked   PASS/FAIL
Anonymous WS blocked    PASS/FAIL
Authenticated API       PASS/FAIL
Authenticated WebSocket PASS/FAIL
systemd                 PASS/FAIL
```

每个失败项都给出原因和下一条修复命令。验证 DSH restart、Caddy restart、服务器 reboot、断网恢复和长任务恢复；认证边界无法证明时 Doctor 必须失败，不显示伪绿色状态。

## 6. Day 4：真实团队 Trial

邀请 3–5 名成员使用，重点记录：

- 登录和账号禁用是否方便。
- Prompt、长任务、文件、Git、Docker 是否正常。
- 手机网络、校园网或等价外网是否稳定。
- 断线、刷新、服务重启、服务器重启后的恢复。
- 是否频繁发生多人同时修改服务器状态。
- 远程 Settings/Credentials 限制是否阻塞实际工作。

产出 `V1 Feedback.md`。只有反馈反复证明并发操作确实造成问题，才进入 V1.1 Operator Lock；不在 V1 预先实现自动超时、WS 感知或 Agent 状态机。

## 7. V1 完成标准

- [ ] 干净 Linux VPS 安装完成，无 SQL/Redis，DSH 以非 root 运行。
- [ ] DSH 只监听 loopback；公网/非 loopback 访问 `3080` 失败。本机 loopback 访问是预期行为。
- [ ] 公网域名 HTTPS 正常，Caddy WebSocket 代理正常。
- [ ] 每个团队成员使用独立账号。
- [ ] 通过公网入口未登录无法访问首页/API/`events.mux`/`events.host`。
- [ ] 登录后 Prompt/Streaming 正常。
- [ ] 登录后 Bash/Git/Docker/文件操作、Session 历史和重连正常。
- [ ] DSH restart、Caddy restart、服务器 reboot 后自动恢复。
- [ ] 手机和 PC 从外部网络实际使用稳定。
- [ ] 至少三名真实成员完成 Trial，连续使用 1 小时无严重异常。

十项全部通过才是 V1 GO；否则保持预发布并记录 blocker。

## 8. Known Limitations

- DSH 当前不是完整多租户执行环境。
- 团队成员应避免同时执行会修改同一服务器状态的任务。
- V1 不提供 Lease、Presence、RBAC、细粒度权限、Approval 隔离或完整 Audit。
- 部分远程 Settings/Credentials/native file-open 能力受 DSH 上游和浏览器安全上下文限制。
