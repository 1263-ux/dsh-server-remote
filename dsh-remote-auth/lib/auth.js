import { hash as argon2Hash, verify as argon2Verify } from 'argon2';

export class AuthHandler {
  constructor(sessionManager, userManager, config) {
    this.sessionManager = sessionManager;
    this.userManager = userManager;
    this.config = config;
    this.loginAttempts = new Map(); // IP -> { count, lockedUntil }
  }

  // 检查 IP 是否被锁定
  isIpLocked(ip) {
    const attempt = this.loginAttempts.get(ip);
    if (!attempt) return false;

    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
      return true;
    }

    // 锁定时间已过，清除记录
    if (attempt.lockedUntil && Date.now() >= attempt.lockedUntil) {
      this.loginAttempts.delete(ip);
      return false;
    }

    return false;
  }

  // 记录登录失败
  recordFailedAttempt(ip) {
    const attempt = this.loginAttempts.get(ip) || { count: 0 };
    attempt.count++;

    if (attempt.count >= this.config.maxLoginAttempts) {
      attempt.lockedUntil = Date.now() + this.config.lockoutDuration * 1000;
    }

    this.loginAttempts.set(ip, attempt);
  }

  // 清除登录失败记录
  clearFailedAttempts(ip) {
    this.loginAttempts.delete(ip);
  }

  // 处理登录请求
  async handleLogin(req, reply) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // 检查 IP 是否被锁定
    if (this.isIpLocked(ip)) {
      return reply.code(429).send({
        error: 'Too Many Requests',
        message: '登录尝试次数过多，请稍后再试',
      });
    }

    const { username, password, remember } = req.body;

    // 验证输入
    if (!username || !password) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: '用户名和密码不能为空',
      });
    }

    // 查找用户
    const user = await this.userManager.getUser(username);
    if (!user) {
      this.recordFailedAttempt(ip);
      return reply.code(401).send({
        error: 'Unauthorized',
        message: '用户名或密码错误',
      });
    }

    // 检查用户是否被禁用
    if (user.disabled) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: '该账户已被禁用',
      });
    }

    // 验证密码
    const isValid = await argon2Verify(user.passwordHash, password);
    if (!isValid) {
      this.recordFailedAttempt(ip);
      return reply.code(401).send({
        error: 'Unauthorized',
        message: '用户名或密码错误',
      });
    }

    // 登录成功，清除失败记录
    this.clearFailedAttempts(ip);

    // 创建 Session
    const sessionToken = await this.sessionManager.createSession({
      username: user.username,
      role: user.role,
      ip,
    });

    // 设置 Cookie
    const cookieOptions = {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
    };

    if (remember) {
      cookieOptions.maxAge = this.config.sessionTtl;
    }

    reply.setCookie(this.config.cookieName, sessionToken, cookieOptions);

    // 返回成功响应
    return reply.send({
      success: true,
      redirect: req.body.next || '/',
      user: {
        username: user.username,
        role: user.role,
      },
    });
  }

  // 处理登出请求
  async handleLogout(req, reply) {
    const sessionToken = req.cookies[this.config.cookieName];

    if (sessionToken) {
      await this.sessionManager.deleteSession(sessionToken);
    }

    reply.clearCookie(this.config.cookieName);

    return reply.send({
      success: true,
      redirect: '/auth/login',
    });
  }
}
