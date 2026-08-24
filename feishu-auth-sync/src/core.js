import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";

export const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const SCRYPT_RE = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

function textValue(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.length === 1) return textValue(value[0]);
  return "";
}

function enabledValue(value) {
  if (value === undefined || value === null || value === "") throw new Error("missing enabled field");
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "是", "启用"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "否", "禁用"].includes(normalized)) return false;
  throw new Error("invalid enabled field");
}

export function isValidScryptHash(value) {
  const match = SCRYPT_RE.exec(value);
  if (!match) return false;
  const n = Number(match[1]);
  const r = Number(match[2]);
  const p = Number(match[3]);
  if (!(Number.isInteger(n) && n > 1 && n <= 2 ** 17 && (n & (n - 1)) === 0
    && Number.isInteger(r) && r > 0 && r <= 32
    && Number.isInteger(p) && p > 0 && p <= 4)) return false;
  try {
    return Buffer.from(match[4], "base64url").length === 16 && Buffer.from(match[5], "base64url").length === 32;
  } catch {
    return false;
  }
}

export function parseUsersYaml(text, source = "users file") {
  let value;
  try {
    value = parse(text);
  } catch (error) {
    throw new Error(`${source}: invalid YAML`);
  }
  if (!value || value.version !== 1 || !value.users || typeof value.users !== "object" || Array.isArray(value.users)) {
    throw new Error(`${source}: expected version 1 users map`);
  }
  const users = new Map();
  for (const [username, record] of Object.entries(value.users)) {
    if (!USERNAME_RE.test(username)) throw new Error(`${source}: invalid username`);
    if (!record || typeof record.passwordHash !== "string" || !isValidScryptHash(record.passwordHash)) {
      throw new Error(`${source}: invalid password hash`);
    }
    users.set(username, {
      passwordHash: record.passwordHash,
      ...(record.disabled === true ? { disabled: true } : {}),
    });
  }
  return { users };
}

export async function readUsersFile(filePath) {
  try {
    const file = await fs.lstat(filePath);
    if (!file.isFile() || file.isSymbolicLink()) throw new Error(`${filePath}: must be a regular file`);
    if (process.platform !== "win32" && (file.mode & 0o077) !== 0) {
      throw new Error(`${filePath}: permissions must not allow group/other access`);
    }
    return parseUsersYaml(await fs.readFile(filePath, "utf8"), filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return { users: new Map(), missing: true };
    throw error;
  }
}

export function normalizeRecords(records, fields) {
  const users = new Map();
  const recordIds = [];
  for (const record of records) {
    const values = record?.fields ?? {};
    const username = textValue(values[fields.username]);
    const passwordHash = textValue(values[fields.passwordHash]);
    if (!USERNAME_RE.test(username)) throw new Error("invalid username in Feishu record");
    if (!isValidScryptHash(passwordHash)) throw new Error(`invalid password hash for ${username}`);
    if (users.has(username)) throw new Error(`duplicate username in Feishu records: ${username}`);
    const enabled = enabledValue(values[fields.enabled]);
    users.set(username, {
      passwordHash,
      ...(!enabled ? { disabled: true } : {}),
    });
    recordIds.push(`${record?.record_id ?? ""}:${username}:${enabled ? "enabled" : "disabled"}:${passwordHash}`);
  }
  const sourceRevision = createHash("sha256").update(recordIds.sort().join("\n")).digest("hex");
  return { users, sourceRevision };
}

export function mergeSnapshots(remote, local) {
  const users = new Map(remote.users);
  for (const [username, record] of local.users) {
    if (users.has(username)) throw new Error(`local break-glass username collides with Feishu: ${username}`);
    users.set(username, record);
  }
  return { users };
}

export function serializeUsersYaml(snapshot) {
  const users = {};
  for (const username of [...snapshot.users.keys()].sort()) {
    users[username] = snapshot.users.get(username);
  }
  return stringify({ version: 1, users });
}

async function fsyncDirectory(directory) {
  if (process.platform === "win32") return;
  const handle = await fs.open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function atomicWrite(filePath, contents) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryStat = await fs.stat(directory);
  if (!directoryStat.isDirectory() || (process.platform !== "win32" && (directoryStat.mode & 0o077) !== 0)) {
    throw new Error(`${directory}: directory permissions must be 0700 or stricter`);
  }
  try {
    const existing = await fs.lstat(filePath);
    if (!existing.isFile() || existing.isSymbolicLink()) throw new Error(`${filePath}: must be a regular file`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const temporary = `${filePath}.tmp-${process.pid}`;
  const handle = await fs.open(temporary, "w", 0o600);
  try {
    await handle.writeFile(contents, "utf8");
    await handle.chmod(0o600);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, filePath);
  await fsyncDirectory(directory);
}

export async function publishSnapshot(filePath, snapshot) {
  await atomicWrite(filePath, serializeUsersYaml(snapshot));
}

export async function readMetadata(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

export async function publishMetadata(filePath, metadata) {
  await atomicWrite(filePath, `${JSON.stringify(metadata, null, 2)}\n`);
}
