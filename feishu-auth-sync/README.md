# dsh-feishu-auth-sync

最小的飞书多维表格账号同步器。它不参与 DSH API、WebSocket 或会话校验，只把经过校验的账号记录发布为 `dsh-auth-gate` 原生 `users.yaml`。

## 账号表字段

默认字段名：`账号`、`密码哈希`、`启用`。密码哈希必须是 dsh-auth-gate 原生 scrypt 格式，不能填明文密码。

可选的本地 break-glass 文件使用同样的 users.yaml 格式，默认路径是 `/etc/dsh-auth/users.local.yaml`。同步成功时它会与飞书账号合并；同名账号会拒绝发布。

## 配置

通过 root-only EnvironmentFile 提供：

```text
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_BITABLE_APP_TOKEN=
FEISHU_BITABLE_TABLE_ID=
DSH_USERS_FILE=/root/.dsh/auth/users.yaml
DSH_LOCAL_USERS_FILE=/etc/dsh-auth/users.local.yaml
DSH_MAX_STALE_SECONDS=600
```

同步器每次登录前不访问飞书。成功同步后更新用户文件和 metadata；飞书失败时保留 last-known-good。超过 stale 上限后只发布本地 break-glass 用户，避免普通账号继续登录。

## 安全不变量

- 远程记录为空、重复、用户名非法或密码哈希非法时不覆盖有效缓存。
- 用户文件与 metadata 使用临时文件、fsync、权限 0600 和原子替换。
- 日志不打印密码、哈希、Token 或完整记录。
- 仅控制新登录；现有 Session 的撤销语义仍由 dsh-auth-gate 决定。
