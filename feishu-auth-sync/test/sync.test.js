import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseUsersYaml, serializeUsersYaml, readMetadata, readUsersFile } from "../src/core.js";
import { syncOnce } from "../src/sync.js";

const validHash = "scrypt$65536$8$1$enp6enp6enp6enp6eg$qhquFN2piwx7cxC6jYN4yREJCPln_GQTzBbLmm4bj1k";

function config(root) {
  return {
    appId: "cli_test",
    appSecret: "secret-not-logged",
    appToken: "basc_test",
    tableId: "tbl_test",
    usersFile: path.join(root, "users.yaml"),
    localUsersFile: path.join(root, "users.local.yaml"),
    metadataFile: path.join(root, "users.yaml.meta.json"),
    maxStaleMs: 600000,
    allowEmptyRemote: false,
    fields: { username: "账号", passwordHash: "密码哈希", enabled: "启用" },
  };
}

function fetchSequence(records) {
  let call = 0;
  return async () => {
    call += 1;
    if (call === 1) return { ok: true, status: 200, json: async () => ({ code: 0, tenant_access_token: "token-not-logged" }) };
    return { ok: true, status: 200, json: async () => ({ code: 0, data: { items: records, has_more: false } }) };
  };
}

test("publishes a valid Feishu snapshot and metadata", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dsh-feishu-sync-"));
  try {
    const result = await syncOnce({
      config: config(root),
      fetcher: fetchSequence([{ record_id: "rec-a", fields: { 账号: "alice", 密码哈希: validHash, 启用: true } }]),
      now: 1000,
      logger: { error() {} },
    });
    assert.equal(result.status, "VALID");
    const users = await readUsersFile(path.join(root, "users.yaml"));
    assert.deepEqual([...users.users.keys()], ["alice"]);
    assert.equal((await readMetadata(path.join(root, "users.yaml.meta.json"))).status, "VALID");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps the last known good file for a fresh failed sync", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dsh-feishu-sync-"));
  try {
    const cfg = config(root);
    await syncOnce({
      config: cfg,
      fetcher: fetchSequence([{ record_id: "rec-a", fields: { 账号: "alice", 密码哈希: validHash, 启用: true } }]),
      now: 1000,
      logger: { error() {} },
    });
    const failed = await syncOnce({
      config: cfg,
      fetcher: async () => { throw new Error("network down"); },
      now: 2000,
      logger: { error() {} },
    });
    assert.equal(failed.status, "STALE");
    assert.match(await readFile(cfg.usersFile, "utf8"), /alice/);
    assert.equal((await readMetadata(cfg.metadataFile)).status, "STALE");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("switches to local break-glass users after stale threshold", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "dsh-feishu-sync-"));
  try {
    const cfg = config(root);
    await writeFile(cfg.localUsersFile, serializeUsersYaml({ users: new Map([["admin-emergency", { passwordHash: validHash }]]) }), { mode: 0o600 });
    await writeFile(cfg.metadataFile, JSON.stringify({ version: 1, status: "VALID", generated_at: new Date(0).toISOString() }));
    const failed = await syncOnce({
      config: cfg,
      fetcher: async () => { throw new Error("network down"); },
      now: cfg.maxStaleMs + 1,
      logger: { error() {} },
    });
    assert.equal(failed.status, "LOCKED_LOCAL_ONLY");
    const users = parseUsersYaml(await readFile(cfg.usersFile, "utf8"));
    assert.deepEqual([...users.users.keys()], ["admin-emergency"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
