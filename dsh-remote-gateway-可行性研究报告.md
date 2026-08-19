# DSH Remote Access Gateway V1 —— 可行性研究报告

> 研究方式：直接阅读本机 DeepSeek Harness checkout（`D:\Kaifa-tool\Apps\deepseek\node_modules\@deepseek-ai\*`）的已发布源码，对计划中的每一个 DSH 相关断言逐条验证。
> 结论先行：**可行。四天计划合理。计划中唯一的"未知风险"（DSH loopback / Host-Origin 信任栅栏）经源码验证机制完全符合计划描述，且计划的"Host/Origin 正规化"方案可以完整穿透栅栏——包括计划以为过不去的特权 API（HTTP 层）。真正剩下的边界在浏览器端 UI，与计划的 P1 判断一致。**

---

## 0. 一句话结论

计划的风险分析方向全对，且被源码逐条证实；有一个重要修正：

- 计划认为 `settings.*` / `credentials.*` / `agentPreset` 创作 / `llm.discoverModels` "即使配置 trustedHosts 也会被强制限制为 loopback"——**HTTP 层确实如此（必须 Host 是 loopback），但 Gateway 把 Host 正规化成 `127.0.0.1:3080` 后，连这 15 个特权方法在 HTTP 层都能通过**。
- 真正过不去的不是 HTTP 栅栏，而是**浏览器端**：客户端插件用 `connection.isLoopback`（由**页面 URL 的 hostname** 决定）来决定是否渲染 Settings / Credentials / AgentPreset 创作 UI。远程浏览器访问 `https://dsh.example.com`，`isLoopback === false`，这些界面根本不会渲染、也不会发起调用。
- 所以计划"管理员在服务器本地配置模型与 Credentials，团队远程负责执行任务"的 P1 边界**正是 DSH 官方设计的边界**，不是缺陷，也**不需要**为它改 DSH 前端（除非 V1.1 想做远程管理 UI，那才需要专门的 compatibility patch，并且 HTTP 层前置条件就是本计划的"正规化"方案）。

---

## 1. 验证范围与证据文件

| 主题 | 证据文件（均为已发布 lib 产物） |
|---|---|
| `/api` 信任栅栏实现 | `@deepseek-ai/dsh-client-connection/lib/index.js` L100-198（`isTrustedApiRequest`） |
| 特权（loopback 限定）方法清单 | 同文件 L504-520（`PRIVILEGED_METHODS`）、L530-586（apply） |
| WebSocket downlink | 同文件 L334-465（`WebSocketDownlinks`）、`lib/types/api-path.d.ts`（`/api/events.mux`、`/api/events.host`） |
| 客户端 isLoopback 判定 | `lib/client.js` L10135-10139、L10165-10167 |
| 客户端 API 基址（同源相对） | `lib/client.js` L10103、L10115-10118 |
| WebSocket 自动重连 | `lib/client.js` L9-11、L114-118（指数退避：500ms ×2^n，上限 10s） |
| 无认证层声明 | `api-request-trust.d.ts` L12-13、`README.md`（"The fence is a reachability policy, not authentication; the Web carrier provides no authentication layer"） |
| CLI 拒绝 `--host 0.0.0.0` | `@deepseek-ai/dsh-web-app/README.md`（"It rejects `--host 0.0.0.0`…"） |
| trustedHosts 接线（CLI / cordis.yml） | `dsh-web-app/cordis.patch.yml` L136、L162-163；`dsh-client-connection/lib/index.js` L480-483 |
| webserver 无 TLS/auth/origin 策略、反代是官方留的加固路径 | `@deepseek-ai/dsh-host-webserver/README.md` L5、L21 |
| 会话/历史磁盘持久化（重启可恢复） | `@deepseek-ai/dsh-host-apiproxy/README.md`（cold session 读取、`SessionStore.flush` 持久化屏障、session.export 等） |

---

## 2. 信任栅栏的精确机制（`isTrustedApiRequest`，`lib/index.js` L184-198）

```js
function isTrustedApiRequest(request, trustedHosts) {
  const host = header(request.headers, "host");            // 1. 必须有 Host
  const hostUrl = parseAuthority(host);
  if (!isLoopbackHostname(hostUrl.hostname)                // 2a. Host 是 loopback
      && !isTrustedAuthority(hostUrl, trustedHosts))       // 2b. 或命中 trustedHosts 条目
    return false;
  if (header(request.headers, "sec-fetch-site") === "cross-site") return false; // 3. 显式 cross-site 拒绝
  const origin = header(request.headers, "origin");
  if (origin === void 0) return true;                      // 4. 无 Origin 即通过
  return new URL(origin).host === hostUrl.host;            // 5. 有 Origin 必须 == Host authority
}
```

要点（与计划第 12、13 节的描述**完全一致**，且有几处计划未写清的细节）：

1. **Host 是唯一不可伪造的锚点**：明文 HTTP 下浏览器对图片/导航等"读取"不携带 Origin 和 Fetch-Metadata，所以无标记请求也必须过 Host 检查（DNS rebinding 防御）。→ Gateway 必须重写 Host，不能只改 Origin。
2. `trustedHosts` 条目必须是裸 authority（`host` 或 `host:port`），WHATWG 解析后须原样读回，否则插件加载直接报错（防 `harness.internal/path` 这类笔误被悄悄授权）。
3. `sec-fetch-site: cross-site` 一律拒绝；**same-origin / same-site / none 都放行**。→ 浏览器在 `dsh.example.com` 页面上发同源 `/api` 请求，标记是 `same-origin`，透传即可。
4. Origin（若有）必须与 Host **完全相等**（host:port）。→ Gateway 把 Host 重写为 `127.0.0.1:3080` 时，Origin 必须同步重写为 `http://127.0.0.1:3080`。

### 该栅栏作用在哪些入口

`apply()`（L530-586）把它套在**三个地方**：

- 所有 `/api` HTTP 路由（L554）：`isTrustedApiRequest(req, trustedHosts)`（带 trustedHosts）；
- 两个 WebSocket upgrade（L570）：同一检查，不过则 `rejectWebSocketUpgrade`（写 403 原始响应，L456-465），**握手前拒绝**；
- 特权方法（L538）：`PRIVILEGED_METHODS.has(method) && !isTrustedApiRequest(request, [])` → **空信任表再查一遍** → 即"必须 loopback"。

### 特权方法完整清单（L504-520，共 15 个）

```
agentPreset.read / copy / openDocument / remove
host.pickDirectory / host.openPath
settings.describe / openDocument / update / replace / mutate
credentials.describe / set / unset
llm.discoverModels
```

不在清单内（计划可放心依赖、远程可用）：`agentPreset.list / select`、`session.*` 全部、`workspace.*` 全部、`host.listDirectory / createDirectory`（browse 目录选择）、`command.* / skill.*`、`llm.providers / llm.models`（模型目录，注释明确说 LAN 客户端的模型选择器需要它）。

> 源码注释（L484-502）给出的理由与计划的判断一模一样：设置/凭据域"stays loopback-same-origin **until a real authentication layer exists**"——即 DSH 维护者把"认证层"留给网关这类前置组件，正是本计划的定位。

---

## 3. 计划断言逐条核对表

| # | 计划断言 | 源码结论 | 判定 |
|---|---|---|---|
| 1 | DSH 保持 `127.0.0.1:3080`，禁止 0.0.0.0 | CLI 明确拒绝 `--host 0.0.0.0`（"intentionally unsupported until remote access has an authentication layer"）；webserver schema 只有 loopback / all-interfaces 两种 bind | ✅ 正确且是官方支持姿势 |
| 2 | "当前 DSH 对所有 `/api` 请求都有 Host/Origin 信任检查" | `isTrustedApiRequest` 套在全部 /api HTTP + 两个 WS upgrade 上 | ✅ 正确 |
| 3 | "即使配置 trustedHosts，settings.* / credentials.* / agentPreset 部分 / host 部分 / llm.discoverModels 仍强制 loopback" | `PRIVILEGED_METHODS` 15 个方法用空信任表再查 → 必须 loopback | ✅ 正确（HTTP 层） |
| 4 | "Gateway 代理给 DSH 时正规化 Host: `127.0.0.1:3080`、Origin: `http://127.0.0.1:3080`" | 栅栏要求 Host loopback + Origin == Host + 非 cross-site；正规化后三条全部满足 | ✅ 正确且**足以通过全部 HTTP 栅栏（含特权方法）** |
| 5 | "WebSocket 检查 Session Cookie，未登录拒绝 Upgrade" | 可行。WS 是只下行通道（客户端发消息会被 1008 关闭，L429-431），网关只需透明双向管道 | ✅ 正确，且比想象更简单 |
| 6 | "连接断掉后客户端会重建连接" | `ConnectionController` 指数退避自动重连（500ms×2^n，上限 10s），断连时清空 hostDescription | ✅ 正确（稳定性验收的"WebSocket 重连"有原生保障） |
| 7 | "DSH 前端自身根据浏览器 URL 判定非 loopback，导致 UI 侧不可持久化" | `isLoopback: isLoopbackHostname(pageLocation.hostname)`（L10167）——**只看页面 URL hostname**，与 HTTP 头无关 | ✅ 正确，这是真正的边界 |
| 8 | "不 Fork DSH；V1 规定管理员本地配置模型/Credentials" | 正是官方设计的边界（见 L484-502 注释），无需改 DSH | ✅ 正确 |
| 9 | "DSH Web carrier 无认证层"（隐含在架构里） | 多处明示："The fence is a reachability policy, not authentication; the Web carrier provides no authentication layer" | ✅ 正确，网关 = 官方预留的认证层位置 |
| 10 | "多人同时访问时避免互相抢 DSH"（Operator Lock） | DSH 本身支持多会话（`session.list`、每连接独立事件流），但共享同一 bash/文件/凭据控制面。V1 加锁是合理的最小护栏 | ✅ 合理（详见 §5.7） |

**结论：计划中没有任何一条 DSH 相关断言被源码否定。** 核心链路（远程浏览器 → 网关 → 127.0.0.1:3080 → Agent → Bash/Git/Docker/文件）不存在已知硬阻塞。

---

## 4. 两种接入模式（关键决策点，建议 V1 用 A）

### 模式 A：loopback 正规化（计划的"优先方案"）

网关对转发到 DSH 的每个请求（HTTP + WS upgrade）：

- `Host: 127.0.0.1:3080`
- 客户端带 `Origin` 时改写为 `http://127.0.0.1:3080`
- `Sec-Fetch-*` **原样透传**（浏览器在 dsh.example.com 页面上发同源请求，标记是 `same-origin`，不是 cross-site）
- 不转发网关侧会话 Cookie 到 DSH（DSH 无认证，也不需要）

效果：**全部** `/api` 请求（含 15 个特权方法）在 HTTP 层通过。远程浏览器 UI 仍不会渲染特权界面（isLoopback 由页面 URL 决定），但 V1.1 若要做"远程 Settings/Credentials 管理兼容补丁"，HTTP 层前置条件就是这个模式——它是**前进兼容**的选择。

### 模式 B：`--trusted-host dsh.example.com` + 透传真实 Host/Origin

DSH 以 `--trusted-host dsh.example.com`（无端口条目，匹配任意端口）启动，网关透传浏览器的 Host/Origin。

效果：普通 API 通过；**15 个特权方法在 HTTP 层硬 403**（Host 非 loopback）。语义更"诚实"，但堵死了 V1.1 远程管理路径，且与模式 A 相比，对 UI 可见能力**没有任何差别**（远程 UI 反正不渲染特权界面）。

> **建议**：V1 用模式 A，同时 DSH 完全不需要配置 `trustedHosts`（避免两套逻辑叠加）。安全上注意：模式 A 下特权方法"HTTP 层可过"意味着**认证边界完全在网关**——这正是计划的本意，但要在 README/安全验收里明确"网关是唯一认证边界"。

---

## 5. 计划需要修正 / 补充的点

1. **"验证"应为"正规化"**（第 12 节措辞）：网关对 Host/Origin 做的是 **rewrite**，不是 verify。需要 verify 的是网关自己的 Session，不是浏览器发来的 Host/Origin（浏览器 Host 是 dsh.example.com，按 DSH 栅栏标准本来就不该通过）。

2. **特权 API 不是"过不去"而是"UI 不渲染"**（第 13 节）：HTTP 层在模式 A 下可过；远程不可用的是**界面**。计划的 P1 边界结论不变，但风险描述要改——这直接影响 Day 1 spike 的预期（见 §6）。

3. **远程浏览器的 UX 降级清单**（计划未列，验收时会被当成 bug 报）：
   - 主题/偏好（ui-theme、locale、ui-conversation）**不持久化**，仅进程内（`dsh-client-ui-settings` README：远程浏览器 settings scope 永不跨线）；
   - "在文件夹中显示 / 打开文件"等原生动作不出现（`dsh-client-ui-deliverables` README，远程默认省略——这是正确行为）；
   - 欢迎/onboarding 确认是进程内的，刷新后可能再出现；
   - 原生目录选择器不可用（远程走 browse 流程：`host.listDirectory/createDirectory`，非特权，可用）。

4. **代理必须透传的能力**（网关实现约束）：
   - POST body 上限 ≥ DSH 默认 `maxRequestBodyBytes`（160MB，`lib/index.js` L532），图片以 base64 进 JSON envelope；代理要流式转发，不要缓冲到内存；
   - `GET /api/session.export` 是流式 ZIP（chunked），必须透明流式；
   - POST 响应可能是流式（chunked），不能等完整响应再回；
   - WS：转发 `Connection: Upgrade / Upgrade: websocket / Sec-WebSocket-*`，双向透传原始帧，浏览器断开时关闭上游（反之亦然）。

5. **限流的真实 IP**：网关只被 Caddy 访问（127.0.0.1），从 `X-Forwarded-For` 取真实 IP 时只信任 loopback 对端的 XFF，或让 Caddy 负责连接级限流（`rate_limit`），网关再做应用级（登录失败）限流。V1 简单做法：网关读 XFF（peer 必须是 127.0.0.1，Caddy 是唯一上游）。

6. **登录页/认证端点不得挂在 `/api` 下**：DSH 的 `/api` 前缀全部代理给 DSH；网关自己的 `/login`、静态登录页、登出走独立前缀（如 `/auth/*`），避免与 DSH 路由冲突，也避免被 DSH 的栅栏逻辑影响。

7. **Operator Lock 补充**：DSH 支持多会话、每连接独立事件流——两个用户在**不同 session** 里技术上可并行，V1 锁的理由是共享 bash/文件/凭据控制面 + 单 UI 状态，这个理由要写进 README（否则以后有人问"为什么锁"）。释放时机建议：`退出` 按钮 + **WS 断开**（页面关闭，网关能感知 upgrade socket close）+ 10 分钟空闲。锁状态放网关进程内存即可（单一网关实例）。

8. **`nativeOpen` 配置不需要动**：远程页面本来就不显示原生打开动作；headless 云服务器目录选择器自动解析到 browse 后端。不用在 DSH 配置里做任何额外设置。

9. **性能验收（P95 < 20ms）**：网关↔DSH 是 localhost，纯 Node 转发单个小型 HTTP 请求亚毫秒级，P95 < 5ms 都很轻松，远低于目标。真正的延迟在"成员↔VPS"与"VPS↔模型 API"，计划判断正确。

10. **Caddy 侧**：`reverse_proxy` 原生支持 WS 透传与 HTTP→HTTPS 跳转；唯一注意点是 Caddy 默认保留客户端 Host（dsh.example.com），由网关负责改写为 loopback——不要在 Caddy 里 `host_header` 改，免得与网关逻辑重叠。

---

## 6. 修正后的 Day 1 Spike 清单（精确到可观察行为）

Day 1 的目标不变：**先证明"远程完整使用 DSH"没有硬阻塞**。按源码证据，P0 项全部是普通（非特权）方法，在模式 A 下应当全部通过；Day 1 真正要测的是**端到端链路**，而不是"能不能过栅栏"（栅栏已证明能过）。建议顺序：

1. `dsh --profile web` 在 Linux 上以 127.0.0.1:3080 启动 ✅（已知可行）
2. 临时用 `socat`/最小 Node 反代做"正规化转发"（Host/Origin 改写），浏览器用 `--host-resolver-rules` 或 hosts 把 dsh.example.com 指到本机验证（本地即可完成，不必先上公网）
3. 逐项打勾（对应源码依据）：

| 验收项 | 源码依据 | 预期 |
|---|---|---|
| 首页完整加载（SPA + 静态资源） | frontend-static 同源回退 | ✅ |
| 创建 Session | `session.create`（非特权） | ✅ |
| Prompt / 流式输出 | `session.prompt` + events.mux WS | ✅ |
| Bash / 文件读写 / Git / Docker | Agent 工具，无特权门 | ✅ |
| Workspace 创建（目录选择走 browse） | `host.listDirectory/createDirectory` 非特权；`host.pickDirectory` 特权但远程 UI 不调用 | ✅ |
| 历史 Session | `session.list` / `session.history`（含冷读取） | ✅ |
| WebSocket 重连 | ConnectionController 退避重连 | ✅ |
| Settings / Credentials / AgentPreset 创作 | `PRIVILEGED_METHODS` + UI `isLoopback` | ⚠️ UI 不渲染（P1，符合计划边界） |
| 模型目录/切换 | `llm.providers/models` 非特权；`session.selectModel` | ✅ |
| `llm.discoverModels` | 特权 | ⚠️ 远程 UI 不触发（P1） |

**Day 1 完成标准（计划原文）成立**：核心 Agent 链路（远程浏览器→网关→DSH→bash→结果返回）无硬阻塞。甚至可以提前：如果 Day 1 只做"正规化反代 + 浏览器验证"，就能把 4 天计划的**最大不确定项清零**。

---

## 7. 安全边界复核（对照计划第 19 节）

| 验收项 | 结论 |
|---|---|
| DSH 仅监听 127.0.0.1 | ✅ CLI 支持且是官方姿势；防火墙层面再封 3080 双保险 |
| 公网只有 HTTPS、HTTP 自动跳 | ✅ Caddy 原生 |
| 无明文密码、Argon2id | ✅ 网关自实现，无 DSH 依赖（node `argon2` 包，Node 22 可用） |
| Session Token 随机、Cookie HttpOnly/Secure/SameSite=Strict | ✅ 标准做法；crypto.randomBytes(32) 足够 |
| 未登录 API / WS 失败 | ✅ 网关在代理前检查（HTTP + upgrade 都检查，计划已覆盖） |
| 登录后 HTTP / WS 正常 | ✅ 模式 A 栅栏全过 |
| Origin/Host 绕过测试 | ⚠️ **新增必测项**：直接连 127.0.0.1:3080 的请求（Host: 127.0.0.1:3080 但无网关认证）在 DSH 栅栏上**会通过**——所以必须在**网关**层拒绝一切非网关来源。部署时：DSH 绑 127.0.0.1 + systemd 里网关与 DSH 都只允许本地进程互访；**不要**把 DSH 暴露给任何网络接口。这个测试项计划里没有，要加 |
| 连续错误密码限流 | ✅ 内存计数即可（见 §5.5 的 IP 来源处理） |
| DSH/Gateway 非 root、无 sudo NOPASSWD | ✅ 部署项，与 DSH 无关，照做 |

> 补充一个计划没有的验收项：**"网关进程本身被攻破/被绕过"的纵深**——V1 至少保证 3080 不出公网、Caddy 是唯一入口、DSH 以最小权限用户运行。

---

## 8. 工期复核

| 计划判断 | 复核 |
|---|---|
| 登录/Session/Proxy/WS/users.yaml/Operator Lock/部署：小 | ✅ 全部成立，无新增难点 |
| 真正的不确定项只有 DSH loopback 兼容 | ✅ 经源码验证，机制明确、方案（模式 A）可完整穿透 HTTP 栅栏；剩余边界（UI isLoopback）与计划 P1 判断一致 |
| 核心功能 2~3 天 | ✅ 成立（Day 1 就能把最大风险清零） |
| 多人验收 + 收口 1 天 | ✅ 成立 |
| "如果 Day 1 验证通过，三天完成概率很高" | ✅ 成立，且比计划预期的概率更高——因为"即使配置 trustedHosts 也强制 loopback"里最吓人的部分（特权 API HTTP 层）在模式 A 下不构成阻塞 |

---

## 9. 最终结论

1. **项目可行**，架构（Caddy → Gateway → DSH 127.0.0.1:3080）正是 DSH 官方文档预留的"real reverse proxy / authentication layer"位置。
2. **计划的 DSH 风险分析全部被源码证实**，且"正规化 Host/Origin"方案被证明可以穿透全部 HTTP 信任栅栏（含 15 个特权方法）。
3. **唯一真实边界是浏览器端 `isLoopback`**（由页面 URL 决定）→ 远程不渲染 Settings/Credentials/AgentPreset 创作 UI。计划的 V1 边界（本地管理配置、远程执行任务）就是 DSH 官方设计的边界，无需 Fork、无需改前端。
4. 建议修正点集中在：措辞（verify→rewrite）、代理透传约束（160MB body、流式 ZIP、chunked 响应、WS 管道）、XFF 信任、认证端点避让 `/api`、以及**新增一条安全验收项（绕过网关直连 DSH 必须失败）**。
5. **开工建议**：Day 1 不必等 Linux 云服务器——本地 Windows 就能用最小 Node 反代 + hosts 劫持完成"正规化转发"端到端验证，把计划里最大的不确定项在第一天就清零。
