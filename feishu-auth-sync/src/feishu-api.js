export async function fetchFeishuRecords({ appId, appSecret, appToken, tableId, fields, fetcher = fetch }) {
  const tokenResponse = await requestJson(fetcher, "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const token = tokenResponse.tenant_access_token;
  if (typeof token !== "string" || token === "") throw new Error("Feishu token response missing token");

  const records = [];
  let pageToken;
  for (let page = 0; page < 100; page += 1) {
    const url = new URL(`https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`);
    url.searchParams.set("page_size", "500");
    if (pageToken) url.searchParams.set("page_token", pageToken);
    const response = await requestJson(fetcher, url, {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = response.data ?? {};
    records.push(...(Array.isArray(data.items) ? data.items : []));
    if (!data.has_more) return { records };
    if (typeof data.page_token !== "string" || data.page_token === "") throw new Error("Feishu pagination missing page token");
    pageToken = data.page_token;
  }
  throw new Error("Feishu record pagination exceeded safety limit");
}

async function requestJson(fetcher, url, options) {
  const response = await fetcher(url, options);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Feishu API returned non-JSON response: HTTP ${response.status}`);
  }
  if (!response.ok || body.code !== 0) {
    throw new Error(`Feishu API failed: HTTP ${response.status}, code ${body.code ?? "unknown"}`);
  }
  return body;
}
