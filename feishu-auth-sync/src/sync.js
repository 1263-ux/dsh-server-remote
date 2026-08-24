import path from "node:path";
import { fetchFeishuRecords } from "./feishu-api.js";
import {
  mergeSnapshots,
  normalizeRecords,
  publishMetadata,
  publishSnapshot,
  readMetadata,
  readUsersFile,
} from "./core.js";

const REQUIRED = ["FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_BITABLE_APP_TOKEN", "FEISHU_BITABLE_TABLE_ID"];

export function configFromEnv(env = process.env) {
  for (const name of REQUIRED) {
    if (!env[name]) throw new Error(`missing required environment variable: ${name}`);
  }
  const maxStaleSeconds = Number(env.DSH_MAX_STALE_SECONDS || 600);
  if (!Number.isFinite(maxStaleSeconds) || maxStaleSeconds <= 0) {
    throw new Error("DSH_MAX_STALE_SECONDS must be a positive number");
  }
  return {
    appId: env.FEISHU_APP_ID,
    appSecret: env.FEISHU_APP_SECRET,
    appToken: env.FEISHU_BITABLE_APP_TOKEN,
    tableId: env.FEISHU_BITABLE_TABLE_ID,
    usersFile: env.DSH_USERS_FILE || "/root/.dsh/auth/users.yaml",
    localUsersFile: env.DSH_LOCAL_USERS_FILE || "/etc/dsh-auth/users.local.yaml",
    metadataFile: env.DSH_USERS_METADATA_FILE || `${env.DSH_USERS_FILE || "/root/.dsh/auth/users.yaml"}.meta.json`,
    maxStaleMs: maxStaleSeconds * 1000,
    allowEmptyRemote: env.DSH_ALLOW_EMPTY_REMOTE === "true",
    fields: {
      username: env.FEISHU_FIELD_USERNAME || "账号",
      passwordHash: env.FEISHU_FIELD_PASSWORD_HASH || "密码哈希",
      enabled: env.FEISHU_FIELD_ENABLED || "启用",
    },
  };
}

export async function syncOnce({ config, fetcher = fetch, now = Date.now(), logger = console }) {
  const local = await readUsersFile(config.localUsersFile);
  try {
    const result = await fetchFeishuRecords({ ...config, fetcher });
    const remote = normalizeRecords(result.records, config.fields);
    if (remote.users.size === 0 && !config.allowEmptyRemote) {
      throw new Error("Feishu returned zero users; refusing to replace last known good cache");
    }
    const merged = mergeSnapshots(remote, local);
    if (merged.users.size === 0) throw new Error("merged user set is empty");
    await publishSnapshot(config.usersFile, merged);
    await publishMetadata(config.metadataFile, {
      version: 1,
      status: "VALID",
      generated_at: new Date(now).toISOString(),
      source_revision: remote.sourceRevision,
      remote_user_count: remote.users.size,
      local_user_count: local.users.size,
      user_count: merged.users.size,
    });
    return { status: "VALID", userCount: merged.users.size };
  } catch (error) {
    const previous = await readMetadata(config.metadataFile);
    const lastSuccess = previous?.generated_at ? Date.parse(previous.generated_at) : NaN;
    const staleMs = Number.isFinite(lastSuccess) ? Math.max(0, now - lastSuccess) : Infinity;
    logger.error?.(`Feishu auth sync failed: ${error instanceof Error ? error.message : String(error)}`);
    if (staleMs <= config.maxStaleMs) {
      await publishMetadata(config.metadataFile, {
        ...(previous || { version: 1 }),
        status: "STALE",
        last_error_at: new Date(now).toISOString(),
      });
      return { status: "STALE", staleMs };
    }
    if (local.users.size > 0) {
      await publishSnapshot(config.usersFile, local);
      await publishMetadata(config.metadataFile, {
        version: 1,
        status: "LOCKED_LOCAL_ONLY",
        generated_at: previous?.generated_at,
        last_error_at: new Date(now).toISOString(),
        remote_user_count: 0,
        local_user_count: local.users.size,
        user_count: local.users.size,
      });
      return { status: "LOCKED_LOCAL_ONLY", staleMs, userCount: local.users.size };
    }
    await publishMetadata(config.metadataFile, {
      version: 1,
      status: "LOCKED_NO_LOCAL",
      last_error_at: new Date(now).toISOString(),
      remote_user_count: 0,
      local_user_count: 0,
      user_count: 0,
    });
    return { status: "LOCKED_NO_LOCAL", staleMs, userCount: 0 };
  }
}

export function defaultPaths(root = "/root/.dsh/auth") {
  return {
    usersFile: path.join(root, "users.yaml"),
    metadataFile: path.join(root, "users.yaml.meta.json"),
  };
}
