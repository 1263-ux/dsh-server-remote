import { nanoid } from 'nanoid';

export class SessionManager {
  constructor(config) {
    this.config = config;
    this.sessions = new Map(); // sessionToken -> { username, role, ip, createdAt, lastAccessAt }
  }

  // 创建新 Session
  async createSession(data) {
    const token = nanoid(32);
    const now = Date.now();

    this.sessions.set(token, {
      username: data.username,
      role: data.role,
      ip: data.ip,
      createdAt: now,
      lastAccessAt: now,
    });

    return token;
  }

  // 获取 Session
  async getSession(token) {
    if (!token) return null;

    const session = this.sessions.get(token);
    if (!session) return null;

    // 检查是否过期
    const now = Date.now();
    const age = now - session.createdAt;
    const maxAge = this.config.sessionTtl * 1000;

    if (age > maxAge) {
      // Session 已过期
      this.sessions.delete(token);
      return null;
    }

    return session;
  }

  // 刷新 Session 最后访问时间
  async refreshSession(token) {
    const session = this.sessions.get(token);
    if (session) {
      session.lastAccessAt = Date.now();
    }
  }

  // 删除 Session
  async deleteSession(token) {
    this.sessions.delete(token);
  }

  // 清理过期 Session
  async cleanupExpiredSessions() {
    const now = Date.now();
    const maxAge = this.config.sessionTtl * 1000;
    let cleaned = 0;

    for (const [token, session] of this.sessions.entries()) {
      const age = now - session.createdAt;
      if (age > maxAge) {
        this.sessions.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionManager] Cleaned ${cleaned} expired sessions`);
    }
  }

  // 获取所有活跃 Session（用于管理）
  async getActiveSessions() {
    const now = Date.now();
    const maxAge = this.config.sessionTtl * 1000;
    const active = [];

    for (const [token, session] of this.sessions.entries()) {
      const age = now - session.createdAt;
      if (age <= maxAge) {
        active.push({
          username: session.username,
          ip: session.ip,
          createdAt: new Date(session.createdAt).toISOString(),
          lastAccessAt: new Date(session.lastAccessAt).toISOString(),
        });
      }
    }

    return active;
  }

  // 按用户名删除所有 Session（强制登出）
  async deleteUserSessions(username) {
    let deleted = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.username === username) {
        this.sessions.delete(token);
        deleted++;
      }
    }
    return deleted;
  }
}
