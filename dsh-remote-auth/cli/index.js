#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInterface } from 'readline';
import { UserManager } from '../lib/users.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('dsh-remote-auth')
  .description('DeepSeek Harness 远程认证插件 CLI')
  .version(packageJson.version);

// 用户管理命令
const userCmd = program.command('user').description('用户管理');

// 添加用户
userCmd
  .command('add <username>')
  .description('添加新用户')
  .option('--role <role>', '用户角色 (admin/user)', 'user')
  .option('--password-stdin', '从标准输入读取密码')
  .action(async (username, options) => {
    try {
      const userManager = new UserManager({});

      let password;
      if (options.passwordStdin) {
        // 从标准输入读取密码
        password = await new Promise((resolve) => {
          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          let input = '';
          rl.on('line', (line) => {
            input += line;
            rl.close();
          });
          rl.on('close', () => resolve(input.trim()));
        });
      } else {
        // 交互式输入密码
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        password = await new Promise((resolve) => {
          rl.question('密码: ', (answer) => {
            rl.close();
            resolve(answer);
          });
        });
      }

      if (!password || password.length < 6) {
        console.error('❌ 密码长度至少为 6 个字符');
        process.exit(1);
      }

      await userManager.addUser(username, password, options.role);
      console.log(`✅ 用户 ${username} 添加成功 (角色: ${options.role})`);
    } catch (error) {
      console.error(`❌ 添加用户失败: ${error.message}`);
      process.exit(1);
    }
  });

// 列出用户
userCmd
  .command('list')
  .alias('ls')
  .description('列出所有用户')
  .action(async () => {
    try {
      const userManager = new UserManager({});
      const users = await userManager.listUsers();

      if (users.length === 0) {
        console.log('没有找到用户');
        return;
      }

      console.log('\n用户列表:\n');
      console.log('用户名\t\t角色\t状态\t创建时间');
      console.log('─'.repeat(60));

      users.forEach(user => {
        const status = user.disabled ? '❌ 禁用' : '✅ 启用';
        const createdAt = new Date(user.createdAt).toLocaleString('zh-CN');
        console.log(`${user.username}\t\t${user.role}\t${status}\t${createdAt}`);
      });
      console.log('');
    } catch (error) {
      console.error(`❌ 列出用户失败: ${error.message}`);
      process.exit(1);
    }
  });

// 删除用户
userCmd
  .command('remove <username>')
  .alias('rm')
  .description('删除用户')
  .action(async (username) => {
    try {
      const userManager = new UserManager({});
      await userManager.removeUser(username);
      console.log(`✅ 用户 ${username} 已删除`);
    } catch (error) {
      console.error(`❌ 删除用户失败: ${error.message}`);
      process.exit(1);
    }
  });

// 禁用用户
userCmd
  .command('disable <username>')
  .description('禁用用户账户')
  .action(async (username) => {
    try {
      const userManager = new UserManager({});
      await userManager.disableUser(username);
      console.log(`✅ 用户 ${username} 已禁用`);
    } catch (error) {
      console.error(`❌ 禁用用户失败: ${error.message}`);
      process.exit(1);
    }
  });

// 启用用户
userCmd
  .command('enable <username>')
  .description('启用用户账户')
  .action(async (username) => {
    try {
      const userManager = new UserManager({});
      await userManager.enableUser(username);
      console.log(`✅ 用户 ${username} 已启用`);
    } catch (error) {
      console.error(`❌ 启用用户失败: ${error.message}`);
      process.exit(1);
    }
  });

// 修改密码
userCmd
  .command('passwd <username>')
  .description('修改用户密码')
  .option('--password-stdin', '从标准输入读取密码')
  .action(async (username, options) => {
    try {
      const userManager = new UserManager({});

      let password;
      if (options.passwordStdin) {
        password = await new Promise((resolve) => {
          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          let input = '';
          rl.on('line', (line) => {
            input += line;
            rl.close();
          });
          rl.on('close', () => resolve(input.trim()));
        });
      } else {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        password = await new Promise((resolve) => {
          rl.question('新密码: ', (answer) => {
            rl.close();
            resolve(answer);
          });
        });
      }

      if (!password || password.length < 6) {
        console.error('❌ 密码长度至少为 6 个字符');
        process.exit(1);
      }

      await userManager.changePassword(username, password);
      console.log(`✅ 用户 ${username} 的密码已修改`);
    } catch (error) {
      console.error(`❌ 修改密码失败: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
