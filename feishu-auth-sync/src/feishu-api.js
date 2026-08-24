export async function fetchFeishuRecords({ appId, appSecret, appToken, tableId, apiBaseUrl = "https://open.feishu.cn", timeoutMs = 15000, pageSize = 200, fetcher = fetch }) {
  const tokenResponse = await requestJson(fetcher, `${apiBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  }, timeoutMs);
  const token = tokenResponse.tenant_access_token;
  if (typeof token !== "string" || token === "") throw new Error("Feishu token response missing token");

  const records = [];
  let offset = 0;
  for (let page = 0; page < 100; page += 1) {
    const url = new URL(`${apiBaseUrl}/open-apis/base/v3/bases/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    const response = await requestJson(fetcher, url, {
      headers: { authorization: `Bearer ${token}` },
    }, timeoutMs);
    const data = response.data ?? {};
    if (Array.isArray(data.items)) {
      records.push(...data.items);
    } else {
      records.push(...transposeBaseRecords(data));
    }
    if (!data.has_more) return { records };
    const pageCount = Array.isArray(data.data) ? data.data.length : 0;
    if (pageCount === 0) throw new Error("Feishu pagination returned no records while more pages exist");
    offset += pageCount;
  }
  throw new Error("Feishu record pagination exceeded safety limit");
}

function transposeBaseRecords(data) {
  if (!Array.isArray(data.data) || !Array.isArray(data.fields)) return [];
  if (data.data.length > 0 && data.fields.length === 0) throw new Error("Feishu Base response missing field names");
  const recordIds = Array.isArray(data.record_id_list) ? data.record_id_list : [];
  return data.data.map((row, index) => {
    if (!Array.isArray(row)) throw new Error("Feishu Base response contains a malformed record row");
    return {
    record_id: recordIds[index],
    fields: Object.fromEntries(data.fields.map((field, fieldIndex) => [field, row?.[fieldIndex]])),
    };
  });
}

async function requestJson(fetcher, url, options, timeoutMs) {
  const response = await fetcher(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Feishu API returned non-JSON response: HTTP ${response.status}`);
  }
  if (!response.ok || body.code !== 0) {
    const message = typeof body.msg === "string" && body.msg.length > 0 ? `, message ${body.msg}` : "";
    throw new Error(`Feishu API failed: HTTP ${response.status}, code ${body.code ?? "unknown"}${message}`);
  }
  return body;
}
