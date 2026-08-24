import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SessionManager } from './session.js';
import { UserManager } from './users.js';
import { AuthHandler } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const name = 'dsh-remote-auth';
export const inject = ['webServer'];

const defaultConfig = {
  sessionTtl: 604800,
  cookieName: 'dsh_remote_auth',
  cookieSecure: false,
  usersFile: '',
  maxLoginAttempts: 5,
  lockoutDuration: 900,
  brandName: 'DeepSeek Harness',
  brandSubtitle: '团队智能协作平台',
  primaryColor: '#667eea',
  secondaryColor: '#764ba2',
};

export function apply(ctx, config) {
  config = { ...defaultConfig, ...config };

  const sessionManager = new SessionManager(config);
  const userManager = new UserManager(config);
  const authHandler = new AuthHandler(sessionManager, userManager, config);

  // 注册认证路由
  ctx.webServer.register({
    path: '/auth/login',
    exact: true,
    handler: async (req, res) => {
      if (req.method === 'GET') {
        // 如果已登录，重定向
        const cookies = parseCookies(req.headers.cookie);
        const session = await sessionManager.getSession(cookies[config.cookieName]);
        if (session) {
          const next = new URL(req.url, 'http://localhost').searchParams.get('next') || '/';
          res.writeHead(302, { Location: next });
          res.end();
          return;
        }

        // 返回登录页面
        let html = await readFile(join(__dirname, 'views', 'login.html'), 'utf-8');
        html = html.replace('{{brandName}}', config.brandName);
        html = html.replace('{{brandSubtitle}}', config.brandSubtitle);
        html = html.replace('{{primaryColor}}', config.primaryColor);
        html = html.replace('{{secondaryColor}}', config.secondaryColor);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } else if (req.method === 'POST') {
        await authHandler.handleLogin(req, res, sessionManager, config);
      } else {
        res.writeHead(405);
        res.end();
      }
    }
  });

  ctx.webServer.register({
    path: '/auth/logout',
    exact: true,
    handler: async (req, res) => {
      if (req.method === 'POST') {
        const cookies = parseCookies(req.headers.cookie);
        const token = cookies[config.cookieName];
        if (token) {
          await sessionManager.deleteSession(token);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(405);
        res.end();
      }
    }
  });

  // TODO: 实现全局认证中间件 - 需要了解DSH如何拦截所有请求

  // 清理定时任务
  const cleanupInterval = setInterval(() => {
    sessionManager.cleanupExpiredSessions().catch(console.error);
  }, 3600000);

  ctx.on('dispose', () => {
    clearInterval(cleanupInterval);
  });
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });

  return cookies;
}
