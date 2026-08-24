import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { hash as argon2Hash } from 'argon2';

export class UserManager {
  constructor(config) {
    this.config = config;
    this.usersFile = config.usersFile || join(homedir(), '.dsh', 'auth', 'users.json');
    this.users = null; // 缓存
  }

  // 确保用户文件目录存在
  async ensureDir() {
    const dir = join(this.usersFile, '..');
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  // 加载用户数据
  async loadUsers() {
    if (this.users) return this.users;

    await this.ensureDir();

    if (!existsSync(this.usersFile)) {
      // 文件不存在，创建空用户列表
      this.users = [];
      await this.saveUsers();
      return this.users;
    }

    const content = await readFile(this.usersFile, 'utf-8');
    this.users = JSON.parse(content);
    return this.users;
  }

  // 保存用户数据
  async saveUsers() {
    await this.ensureDir();
    await writeFile(this.usersFile, JSON.stringify(this.users, null, 2), 'utf-8');
  }

  // 获取用户
  async getUser(username) {
    const users = await this.loadUsers();
    return users.find(u => u.username === username);
  }

  // 添加用户
  async addUser(username, password, role = 'user') {
    const users = await this.loadUsers();

    // 检查用户是否已存在
    if (users.find(u => u.username === username)) {
      throw new Error(`User ${username} already exists`);
    }

    // 哈希密码
    const passwordHash = await argon2Hash(password, {
      type: 2, // Argon2id
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // 添加用户
    users.push({
      username,
      passwordHash,
      role,
      disabled: false,
      createdAt: new Date().toISOString(),
    });

    await this.saveUsers();
  }

  // 删除用户
  async removeUser(username) {
    const users = await this.loadUsers();
    const index = users.findIndex(u => u.username === username);

    if (index === -1) {
      throw new Error(`User ${username} not found`);
    }

    users.splice(index, 1);
    await this.saveUsers();
  }

  // 列出所有用户
  async listUsers() {
    const users = await this.loadUsers();
    return users.map(u => ({
      username: u.username,
      role: u.role,
      disabled: u.disabled,
      createdAt: u.createdAt,
    }));
  }

  // 禁用用户
  async disableUser(username) {
    const users = await this.loadUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
      throw new Error(`User ${username} not found`);
    }

    user.disabled = true;
    await this.saveUsers();
  }

  // 启用用户
  async enableUser(username) {
    const users = await this.loadUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
      throw new Error(`User ${username} not found`);
    }

    user.disabled = false;
    await this.saveUsers();
  }

  // 修改密码
  async changePassword(username, newPassword) {
    const users = await this.loadUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
      throw new Error(`User ${username} not found`);
    }

    // 哈希新密码
    const passwordHash = await argon2Hash(newPassword, {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    user.passwordHash = passwordHash;
    user.passwordChangedAt = new Date().toISOString();

    await this.saveUsers();
  }
}
