import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUsersYaml, normalizeRecords, mergeSnapshots, serializeUsersYaml } from "../src/core.js";

const validHash = "scrypt$65536$8$1$enp6enp6enp6enp6enp6eg$qhquFN2piwx7cxC6jYN4yREJCPln_GQTzBbLmm4bj1k";
const fields = { username: "账号", passwordHash: "密码哈希", enabled: "启用" };

test("normalizes enabled and disabled Feishu records", () => {
  const snapshot = normalizeRecords([
    { record_id: "rec-a", fields: { 账号: "alice", 密码哈希: validHash, 启用: true } },
    { record_id: "rec-b", fields: { 账号: "bob", 密码哈希: validHash, 启用: "否" } },
  ], fields);
  assert.equal(snapshot.users.get("alice").disabled, undefined);
  assert.equal(snapshot.users.get("bob").disabled, true);
});

test("rejects empty, duplicate, malformed, and unsafe records", () => {
  assert.equal(normalizeRecords([], fields).users.size, 0);
  assert.throws(() => normalizeRecords([
    { record_id: "a", fields: { 账号: "alice", 密码哈希: validHash, 启用: true } },
    { record_id: "b", fields: { 账号: "alice", 密码哈希: validHash, 启用: true } },
  ], fields), /duplicate username/);
  assert.throws(() => normalizeRecords([
    { record_id: "a", fields: { 账号: "bad name", 密码哈希: validHash, 启用: true } },
  ], fields), /invalid username/);
  assert.throws(() => normalizeRecords([
    { record_id: "a", fields: { 账号: "alice", 密码哈希: "plaintext", 启用: true } },
  ], fields), /invalid password hash/);
  assert.throws(() => normalizeRecords([
    { record_id: "a", fields: { 账号: "alice", 密码哈希: validHash } },
  ], fields), /missing enabled field/);
  assert.equal(normalizeRecords([
    { record_id: "a", fields: { 账号: "alice", 密码哈希: validHash, 启用: false } },
  ], fields).users.get("alice").disabled, true);
});

test("rejects non-power-of-two scrypt cost parameters", () => {
  assert.throws(() => parseUsersYaml(`version: 1\nusers:\n  alice:\n    passwordHash: scrypt$3$8$1$enp6enp6enp6enp6enp6eg$qhquFN2piwx7cxC6jYN4yREJCPln_GQTzBbLmm4bj1k\n`), /invalid password hash/);
});

test("preserves local break-glass users and rejects collisions", () => {
  const remote = { users: new Map([["alice", { passwordHash: validHash }]]) };
  const local = { users: new Map([["admin-emergency", { passwordHash: validHash }]]) };
  const merged = mergeSnapshots(remote, local);
  assert.deepEqual([...merged.users.keys()], ["alice", "admin-emergency"]);
  assert.throws(() => mergeSnapshots(remote, { users: new Map([["alice", { passwordHash: validHash }]]) }), /collides/);
});

test("round-trips native auth-gate users YAML", () => {
  const parsed = parseUsersYaml(serializeUsersYaml({
    users: new Map([
      ["bob", { passwordHash: validHash, disabled: true }],
      ["alice", { passwordHash: validHash }],
    ]),
  }));
  assert.equal(parsed.users.get("alice").disabled, undefined);
  assert.equal(parsed.users.get("bob").disabled, true);
});
