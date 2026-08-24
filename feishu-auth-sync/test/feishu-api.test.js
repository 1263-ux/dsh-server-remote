import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchFeishuRecords } from "../src/feishu-api.js";

test("fetches and paginates Base v3 tabular records", async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return { ok: true, status: 200, json: async () => ({ code: 0, tenant_access_token: "token-not-logged" }) };
    const offset = new URL(url).searchParams.get("offset");
    if (offset === "0") {
      return { ok: true, status: 200, json: async () => ({
        code: 0,
        data: {
          data: [["alice", true]],
          fields: ["账号", "启用"],
          record_id_list: ["rec-a"],
          has_more: true,
        },
      }) };
    }
    return { ok: true, status: 200, json: async () => ({
      code: 0,
      data: {
        data: [["bob", false]],
        fields: ["账号", "启用"],
        record_id_list: ["rec-b"],
        has_more: false,
      },
    }) };
  };

  const result = await fetchFeishuRecords({
    appId: "cli_test",
    appSecret: "secret-not-logged",
    appToken: "basc_test",
    tableId: "tbl_test",
    pageSize: 1,
    fetcher,
  });

  assert.deepEqual(result.records, [
    { record_id: "rec-a", fields: { 账号: "alice", 启用: true } },
    { record_id: "rec-b", fields: { 账号: "bob", 启用: false } },
  ]);
  assert.match(calls[1], /\/open-apis\/base\/v3\/bases\/basc_test\/tables\/tbl_test\/records\?limit=1&offset=0/);
  assert.match(calls[2], /\/open-apis\/base\/v3\/bases\/basc_test\/tables\/tbl_test\/records\?limit=1&offset=1/);
});
