import {
  jsonResponse,
  errorResponse,
  readJson,
  requireAccessKey,
  getTenantAccessToken,
  feishuFetch
} from "./_utils.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireAccessKey(request, env);
  if (!auth.ok) return errorResponse(`访问被拒（${auth.reason}），请先登录`, 401);

  const body = await readJson(request);
  if (!body) return errorResponse("请求体不是合法 JSON");
  const { app_id, app_secret, spreadsheet_token, range } = body;
  if (!app_id || !app_secret) return errorResponse("缺少 App ID 或 App Secret");
  if (!spreadsheet_token || !range) return errorResponse("缺少 spreadsheet_token 或 range");

  try {
    const token = await getTenantAccessToken(app_id, app_secret);
    const data = await feishuFetch(
      `/sheets/v2/spreadsheets/${encodeURIComponent(spreadsheet_token)}/values/${encodeURIComponent(range)}?valueRenderOption=ToString&dateTimeRenderOption=FormattedString`,
      token
    );
    const values = data.data?.valueRange?.values || [];
    if (!values.length) return jsonResponse({ ok: true, total: 0, items: [] });
    const headers = values[0].map((h) => String(h ?? "").trim() || `col_${Math.random().toString(36).slice(2, 6)}`);
    const items = values.slice(1).map((row, idx) => {
      const obj = { id: `row_${idx + 1}` };
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? "";
      });
      if (obj.id === `row_${idx + 1}` && obj.ID) obj.id = obj.ID;
      return obj;
    });
    return jsonResponse({ ok: true, total: items.length, items });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
