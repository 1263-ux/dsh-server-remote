# dsh-remote-auth

现代化的 DeepSeek Harness 认证插件，提供美观的自定义登录界面。

## 特性

- ✨ 现代化 UI 设计（渐变背景、流畅动画）
- 🔐 用户名/密码认证（Argon2 哈希）
- 🍪 Session 管理（安全 Cookie）
- 🎨 品牌化可定制（Logo、颜色、标题）
- 📱 响应式设计（支持移动端）
- 🚀 零依赖前端（纯 HTML/CSS/JS）
- 🛡️ 安全加固（限流、CSRF 保护）

## 快速开始

### 1. 安装插件

```bash
# 从本地安装
npm pack
dsh plugin --profile web add ./dsh-remote-auth-0.1.0.tgz

# 或从 npm 安装（发布后）
dsh plugin --profile web add dsh-remote-auth
```

### 2. 创建管理员账户

```bash
dsh-remote-auth user add admin --password-stdin
# 输入密码后按 Enter
```

### 3. 配置认证

编辑 `~/.dsh/cordis.patch.yml`：

```yaml
- id: dsh-remote-auth
  config:
    cookieSecure: true  # 生产环境使用 HTTPS 时设为 true
    sessionTtl: 604800  # 7 天
```

### 4. 启动 DSH

```bash
dsh web --port 3080 --trusted-host your-domain.com
```

现在访问你的 DSH 实例，会看到新的登录界面！

## 配置选项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `sessionTtl` | `604800` | Session 有效期（秒），默认 7 天 |
| `cookieName` | `dsh_remote_auth` | Session Cookie 名称 |
| `cookieSecure` | `true` | 是否使用安全 Cookie（HTTPS） |
| `usersFile` | `~/.dsh/auth/users.json` | 用户数据文件路径 |
| `maxLoginAttempts` | `5` | 最大登录尝试次数 |
| `lockoutDuration` | `900` | 锁定时间（秒），默认 15 分钟 |
| `brandName` | `DeepSeek Harness` | 品牌名称 |
| `brandSubtitle` | `团队智能协作平台` | 副标题 |

## 用户管理

### 添加用户

```bash
# 交互式输入密码
dsh-remote-auth user add <username>

# 从标准输入读取密码
echo 'your-password' | dsh-remote-auth user add <username> --password-stdin

# 指定角色（admin/user）
dsh-remote-auth user add <username> --role admin
```

### 列出用户

```bash
dsh-remote-auth user list
```

### 删除用户

```bash
dsh-remote-auth user remove <username>
```

### 禁用/启用用户

```bash
dsh-remote-auth user disable <username>
dsh-remote-auth user enable <username>
```

### 修改密码

```bash
dsh-remote-auth user passwd <username>
```

## 自定义品牌

### 方法 1: 配置文件

编辑 `~/.dsh/cordis.patch.yml`：

```yaml
- id: dsh-remote-auth
  config:
    brandName: "Your Company"
    brandSubtitle: "Your Tagline"
    primaryColor: "#667eea"
    secondaryColor: "#764ba2"
```

### 方法 2: 替换资源文件

```bash
# 替换 Logo
cp your-logo.svg ~/.dsh/profiles/web/node_modules/dsh-remote-auth/lib/views/logo.svg

# 自定义 CSS
cp custom-styles.css ~/.dsh/profiles/web/node_modules/dsh-remote-auth/lib/views/custom.css
```

## 安全特性

- ✅ **Argon2 密码哈希** - 抗暴力破解
- ✅ **登录限流** - 防止暴力攻击
- ✅ **Session 管理** - 安全的 Cookie 设置
- ✅ **CSRF 保护** - 跨站请求伪造防护（可选）
- ✅ **IP 锁定** - 多次失败后临时封禁 IP

## 架构设计

```
┌─────────────────────────────────┐
│      HTTP Request               │
└───────────┬─────────────────────┘
            │
            ↓
┌─────────────────────────────────┐
│   dsh-remote-auth Middleware    │
│   - Check Session Cookie        │
│   - Verify Authentication       │
└───────────┬─────────────────────┘
            │
    ┌───────┴───────┐
    │               │
    ↓               ↓
┌─────────┐   ┌─────────┐
│ Login   │   │  Allow  │
│  Page   │   │ Access  │
└─────────┘   └─────────┘
```

## 与 dsh-auth-gate 对比

| 功能 | dsh-auth-gate | dsh-remote-auth |
|------|---------------|-----------------|
| UI 设计 | 基础 | 现代化 ✨ |
| 密码哈希 | scrypt | Argon2 ✨ |
| 品牌定制 | 有限 | 完全可定制 ✨ |
| 响应式 | 部分 | 完全响应式 ✨ |
| 动画效果 | 无 | 流畅动画 ✨ |
| 维护性 | 上游依赖 | 独立维护 ✨ |

## 开发

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/your-org/dsh-remote-auth.git
cd dsh-remote-auth

# 安装依赖
npm install

# 链接到本地 DSH
npm link
dsh plugin --profile web add $(pwd)

# 测试
npm test
```

### 目录结构

```
dsh-remote-auth/
├── lib/
│   ├── index.js           # 插件主入口
│   ├── auth.js            # 认证逻辑
│   ├── session.js         # Session 管理
│   ├── users.js           # 用户管理
│   └── views/
│       ├── login.html     # 登录页面
│       ├── styles.css     # 样式
│       ├── script.js      # 前端逻辑
│       └── logo.svg       # Logo
├── cli/
│   └── index.js           # CLI 工具
├── package.json
└── README.md
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT

## 致谢

- UI 设计灵感：Stripe, Linear, Vercel
- 基于 [dsh-auth-gate](https://github.com/TecFancy/dsh-auth-gate) 的经验
