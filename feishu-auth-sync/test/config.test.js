import { test } from "node:test";
import assert from "node:assert/strict";
import { configFromEnv } from "../src/sync.js";

const base = {
  FEISHU_APP_ID: "app",
  FEISHU_APP_SECRET: "secret",
  FEISHU_BITABLE_APP_TOKEN: "token",
  FEISHU_BITABLE_TABLE_ID: "table",
};

test("loads portable API and field configuration", () => {
  const config = configFromEnv({
    ...base,
    FEISHU_API_BASE_URL: "https://example.invalid/",
    FEISHU_REQUEST_TIMEOUT_MS: "30000",
    FEISHU_PAGE_SIZE: "100",
    FEISHU_FIELD_USERNAME: "username",
    FEISHU_FIELD_PASSWORD_HASH: "password_hash",
    FEISHU_FIELD_ENABLED: "active",
  });
  assert.equal(config.apiBaseUrl, "https://example.invalid");
  assert.equal(config.timeoutMs, 30000);
  assert.equal(config.pageSize, 100);
  assert.deepEqual(config.fields, { username: "username", passwordHash: "password_hash", enabled: "active" });
});

test("rejects insecure non-local Feishu API endpoints", () => {
  assert.throws(() => configFromEnv({ ...base, FEISHU_API_BASE_URL: "http://example.invalid" }), /HTTPS/);
});
