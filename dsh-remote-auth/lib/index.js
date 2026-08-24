import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SessionManager } from './session.js';
import { UserManager } from './users.js';
import { AuthHandler } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const name = 'dsh-remote-auth';

// 注入依赖
export const inject = ['webServer'];

// 默认配置
const defaultConfig = {
  sessionTtl: 604800,           // 7 天
  cookieName: 'dsh_remote_auth',
  cookieSecure: true,
  usersFile: '',                // 默认使用 ~/.dsh/auth/users.json
  maxLoginAttempts: 5,
  lockoutDuration: 900,         // 15 分钟
  brandName: 'DeepSeek Harness',
  brandSubtitle: '团队智能协作平台',
  primaryColor: '#667eea',
  secondaryColor: '#764ba2',
};

export function apply(ctx, config) {
  config = { ...defaultConfig, ...config };

  // 初始化管理器
  const sessionManager = new SessionManager(config);
  const userManager = new UserManager(config);
  const authHandler = new AuthHandler(sessionManager, userManager, config);

  // 安全的logger初始化
  const logger = ctx.logger?.child ? ctx.logger.child({ name: 'dsh-remote-auth' }) : ctx.logger || console;
  logger.info?.('Initializing authentication plugin');

  // 获取webServer服务
  const webserver = ctx.webServer;
  if (!webserver) {
    logger.error?.('webServer service not available');
    return;
  }

  logger.info?.('Injecting authentication middleware');

    // 静态资源路由（登录页面资源）
    webserver.get('/auth/assets/:file', async (req, reply) => {
      const file = req.params.file;
      const allowedFiles = ['styles.css', 'script.js', 'logo.svg'];

      if (!allowedFiles.includes(file)) {
        return reply.code(404).send('Not Found');
      }

      const filePath = join(__dirname, 'views', file);
      const content = await readFile(filePath, 'utf-8');

      const mimeTypes = {
        'css': 'text/css',
        'js': 'application/javascript',
        'svg': 'image/svg+xml',
      };

      const ext = file.split('.').pop();
      reply.type(mimeTypes[ext] || 'text/plain');
      return content;
    });

    // 登录页面
    webserver.get('/auth/login', async (req, reply) => {
      // 如果已登录，重定向
      const session = await sessionManager.getSession(req.cookies[config.cookieName]);
      if (session) {
        const next = req.query.next || '/';
        return reply.redirect(next);
      }

      // 读取并渲染登录页面
      let html = await readFile(join(__dirname, 'views', 'login.html'), 'utf-8');

      // 注入品牌配置
      html = html.replace('{{brandName}}', config.brandName);
      html = html.replace('{{brandSubtitle}}', config.brandSubtitle);
      html = html.replace('{{primaryColor}}', config.primaryColor);
      html = html.replace('{{secondaryColor}}', config.secondaryColor);

      reply.type('text/html');
      return html;
    });

    // 登录处理
    webserver.post('/auth/login', async (req, reply) => {
      return authHandler.handleLogin(req, reply);
    });

    // 登出处理
    webserver.post('/auth/logout', async (req, reply) => {
      return authHandler.handleLogout(req, reply);
    });

    // 认证中间件 - 拦截所有请求
    webserver.addHook('onRequest', async (req, reply) => {
      // 排除认证相关路由
      const publicPaths = ['/auth/login', '/auth/assets/', '/auth/logout'];
      if (publicPaths.some(path => req.url.startsWith(path))) {
        return;
      }

      // 检查 Session
      const sessionToken = req.cookies[config.cookieName];
      const session = await sessionManager.getSession(sessionToken);

      if (!session) {
        // 未登录
        if (req.headers.accept?.includes('text/html')) {
          // 浏览器请求，重定向到登录页
          const next = encodeURIComponent(req.url);
          return reply.redirect(`/auth/login?next=${next}`);
        } else {
          // API 请求，返回 401
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Authentication required',
          });
        }
      }

      // 验证用户是否仍然有效
      const user = await userManager.getUser(session.username);
      if (!user || user.disabled) {
        await sessionManager.deleteSession(sessionToken);
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'User account is disabled',
        });
      }

      // 刷新 Session
      await sessionManager.refreshSession(sessionToken);

      // 将用户信息注入到请求中
      req.user = {
        username: session.username,
        role: user.role,
      };
    });

    logger.info?.('Authentication middleware injected successfully');
  // 清理过期 Session（定时任务）
  const cleanupInterval = setInterval(() => {
    sessionManager.cleanupExpiredSessions().catch(err => {
      logger.error?.('Failed to cleanup expired sessions:', err);
    });
  }, 3600000); // 每小时清理一次

  // 插件卸载时清理
  ctx.on('dispose', () => {
    clearInterval(cleanupInterval);
    logger.info?.('Authentication plugin disposed');
  });
}
