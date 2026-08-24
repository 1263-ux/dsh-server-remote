# DSH 远程部署项目

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org/)

> 简化的、生产就绪的 DeepSeek Harness 远程部署方案

---

## 🎯 项目目标

让团队成员能够通过互联网安全访问部署在 Linux 服务器上的 DeepSeek Harness (DSH) 和 OKS 知识库。

---

## ✨ 特性

- ✅ **简化架构** - 不需要自定义 Gateway，纯配置驱动
- ✅ **现代化 UI** - 渐变背景、流畅动画、响应式设计
- ✅ **企业级安全** - Argon2 哈希、登录限流、IP 锁定
- ✅ **品牌定制** - Logo、颜色、标题完全可定制
- ✅ **易于部署** - 一键安装，systemd 服务管理
- ✅ **完整文档** - 详细的部署指南和运维文档

---

## 📦 核心组件

### 1. 技术架构

```
Internet (HTTPS)
    ↓
Caddy (反向代理 + HTTPS 终止)
    ↓
DSH (--trusted-host 配置)
    ↓
dsh-remote-auth (认证插件)
```

**关键发现**：DSH 内置的 `--trusted-host` 参数足够，不需要自定义 Gateway！

### 2. dsh-remote-auth 插件

现代化的认证插件，提供：
- 用户名/密码认证
- Session 管理
- 现代化登录界面
- CLI 用户管理工具
- 品牌定制支持

详见 [`dsh-remote-auth/README.md`](dsh-remote-auth/README.md)

---

## 🚀 快速开始

### 前置要求

- Node.js >= 22.0.0
- pnpm
- Linux 服务器（推荐 Ubuntu 22.04+）

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/1263-ux/dsh-server-remote.git
cd dsh-server-remote

# 2. 安装并打包插件
cd dsh-remote-auth
npm install
npm pack

# 3. 安装到 DSH
dsh plugin --profile web add ./dsh-remote-auth-0.1.0.tgz

# 4. 创建管理员账户
echo 'your-strong-password' | dsh-remote-auth user add admin --password-stdin --role admin

# 5. 配置认证
cat > ~/.dsh/cordis.patch.yml << 'EOF'
- id: dsh-remote-auth
  config:
    cookieSecure: true
    brandName: "Your Company"
    brandSubtitle: "Your Tagline"
EOF

# 6. 启动 DSH
dsh web --port 3080 --trusted-host your-domain.com
```

完整部署指南：[`dsh-remote-auth/DEPLOYMENT.md`](dsh-remote-auth/DEPLOYMENT.md)

---

## 📁 项目结构

```
tool-deepseek/
├── README.md                        # 本文档
├── Caddyfile                        # 当前 HTTPS 反向代理示例
├── config/                           # systemd/Caddy/DSH 配置模板
├── install/                          # Linux 安装脚本
├── docs/                             # 安全与升级文档
└── dsh-remote-auth/                 # 认证插件
    ├── README.md                    # 插件文档
    ├── DEPLOYMENT.md                # 部署指南
    ├── package.json
    ├── cordis.patch.yml
    ├── lib/                         # 核心代码
    │   ├── index.js
    │   ├── auth.js
    │   ├── session.js
    │   ├── users.js
    │   └── views/                   # UI 资源
    └── cli/                         # CLI 工具
        └── index.js
```

---

## 📖 文档

- **[插件 README](dsh-remote-auth/README.md)** - dsh-remote-auth 使用说明
- **[部署指南](dsh-remote-auth/DEPLOYMENT.md)** - 生产环境部署详细步骤
- **[安全说明](docs/SECURITY.md)** - 认证、root 权限和 Docker 风险
- **[升级说明](docs/UPGRADE.md)** - 手动升级与回滚流程
- **[dev-loop 结果](.agent/RESULT.md)** - 当前部署和验收证据

---

## 🎨 UI 预览

### 登录页面特性

- 🎨 渐变紫蓝背景 + 动态圆圈动画
- ✨ 流畅的悬停和聚焦效果
- 🔒 密码显示/隐藏切换
- 📱 完全响应式设计
- ⚡ 加载状态和错误提示
- 🎯 品牌化可定制

---

## 🔧 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| Web Server | Caddy | v2.8+ |
| Application | DeepSeek Harness | v0.1.0-rc.7+ |
| Authentication | dsh-remote-auth | v0.1.0 |
| Password Hash | Argon2 | - |
| Session | nanoid | - |
| Frontend | 纯 HTML/CSS/JS | - |

---

## 📊 对比优势

### vs 原计划

| 项目 | 原计划 | 实际方案 | 改进 |
|------|--------|----------|------|
| 自定义代码 | 170 行 | 0 行 | ✅ -100% |
| 配置文件 | 6+ 个 | 2 个 | ✅ -67% |
| 维护复杂度 | 高 | 低 | ✅ 大幅降低 |

### vs dsh-auth-gate

| 功能 | dsh-auth-gate | dsh-remote-auth |
|------|---------------|-----------------|
| UI 设计 | 基础 | ✨ 现代化 |
| 密码哈希 | scrypt | ✨ Argon2 |
| 品牌定制 | 有限 | ✨ 完全可定制 |
| 维护性 | 上游依赖 | ✨ 独立维护 |

---

## 🚧 下一步

### 短期（等待服务器）

- [ ] Linux 生产环境部署验证
- [ ] HTTPS 证书配置测试
- [ ] 外部网络访问验证
- [ ] 性能和稳定性测试

### 中期

- [ ] 集成 OKS 知识库
- [ ] 扩展权限管理（角色系统）
- [ ] 监控和告警系统

### 长期

- [ ] 双因素认证（2FA）
- [ ] OAuth/LDAP 集成
- [ ] SSO 单点登录

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

---

## 📞 联系方式

- 项目维护：Your Team
- 问题反馈：GitHub Issues

---

**项目状态**: 🟢 已完成远端部署验证，适合小团队试用
**重要边界**: 多个账号共享 DSH 的 root 能力、工作区和知识库，当前不是 RBAC 多租户系统
