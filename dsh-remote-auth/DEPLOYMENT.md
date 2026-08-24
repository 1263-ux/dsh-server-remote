# 部署配置示例

推荐的配置文件，放在 `~/.dsh/cordis.patch.yml`:

```yaml
- id: dsh-remote-auth
  config:
    # 基础配置
    sessionTtl: 604800           # Session 有效期 (秒)，默认 7 天
    cookieName: dsh_remote_auth  # Cookie 名称
    cookieSecure: true           # 生产环境必须为 true（HTTPS）

    # 安全配置
    maxLoginAttempts: 5          # 最大登录尝试次数
    lockoutDuration: 900         # 锁定时间（秒），默认 15 分钟

    # 品牌定制
    brandName: "Your Company"
    brandSubtitle: "Your Tagline"
    primaryColor: "#667eea"
    secondaryColor: "#764ba2"

    # 用户数据文件（可选，默认 ~/.dsh/auth/users.json）
    # usersFile: "/path/to/users.json"
```

## 生产环境配置

### 1. Caddy 配置 (`/etc/caddy/Caddyfile`)

```
dsh.example.com {
    reverse_proxy localhost:3080

    # 日志
    log {
        output file /var/log/caddy/dsh.log
        format json
    }

    # 安全头
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "no-referrer-when-downgrade"
    }
}
```

### 2. systemd 服务 (`/etc/systemd/system/dsh.service`)

```ini
[Unit]
Description=DeepSeek Harness Web Server
After=network.target

[Service]
Type=simple
User=dsh
Group=dsh
WorkingDirectory=/home/dsh
Environment="NODE_ENV=production"
ExecStart=/usr/bin/dsh web --port 3080 --no-open --trusted-host dsh.example.com
Restart=always
RestartSec=10

# 安全加固
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/dsh/.dsh

[Install]
WantedBy=multi-user.target
```

### 3. 启动服务

```bash
# 重载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start dsh
sudo systemctl start caddy

# 开机自启
sudo systemctl enable dsh
sudo systemctl enable caddy

# 查看状态
sudo systemctl status dsh
sudo systemctl status caddy

# 查看日志
sudo journalctl -u dsh -f
```

## 开发环境配置

开发时可以关闭 `cookieSecure` 以便使用 HTTP：

```yaml
- id: dsh-remote-auth
  config:
    cookieSecure: false  # 仅用于开发
    brandName: "DSH Dev"
```

启动命令：

```bash
dsh web --port 3080 --trusted-host localhost:8080
```

## 环境变量

插件支持通过环境变量覆盖部分配置：

```bash
# 用户数据文件路径
export DSH_AUTH_USERS_FILE=/custom/path/users.json

# Session TTL（秒）
export DSH_AUTH_SESSION_TTL=86400

# 启动 DSH
dsh web --port 3080 --trusted-host your-domain.com
```

## 多实例部署

如果需要部署多个 DSH 实例，每个实例使用独立的配置：

```bash
# 实例 1
dsh --profile web-prod web --port 3080 --trusted-host prod.example.com

# 实例 2
dsh --profile web-staging web --port 3081 --trusted-host staging.example.com
```

每个 profile 有独立的 `cordis.patch.yml` 和用户数据。

## 备份和恢复

### 备份用户数据

```bash
# 备份
cp ~/.dsh/auth/users.json ~/.dsh/auth/users.json.backup

# 恢复
cp ~/.dsh/auth/users.json.backup ~/.dsh/auth/users.json
```

### 定期备份脚本

```bash
#!/bin/bash
# /usr/local/bin/backup-dsh-users.sh

BACKUP_DIR=/backup/dsh
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR
cp ~/.dsh/auth/users.json $BACKUP_DIR/users-$DATE.json

# 保留最近 30 天的备份
find $BACKUP_DIR -name "users-*.json" -mtime +30 -delete
```

添加到 crontab：

```bash
# 每天凌晨 2 点备份
0 2 * * * /usr/local/bin/backup-dsh-users.sh
```

## 监控

### 健康检查

```bash
#!/bin/bash
# 检查 DSH 是否响应

if ! curl -f -s http://localhost:3080/auth/login > /dev/null; then
    echo "DSH is down!"
    # 发送告警或重启服务
    systemctl restart dsh
fi
```

### 日志监控

使用 `journalctl` 或日志收集工具监控错误：

```bash
# 查看最近的错误
journalctl -u dsh --priority=err -n 50

# 实时监控
journalctl -u dsh -f
```
