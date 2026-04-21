import {
  jsonResponse,
  errorResponse,
  readJson,
  requireAccessKey,
  getTenantAccessToken,
  feishuFetch,
  getAttachmentTmpUrls,
  fetchUrlToDataUrl,
  flattenBitableFields
} from "./_utils.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireAccessKey(request, env);
  if (!auth.ok) return errorResponse(`访问被拒（${auth.reason}），请先登录`, 401);

  const body = await readJson(request);
  if (!body) return errorResponse("请求体不是合法 JSON");
  const { app_id, app_secret, app_token, table_id, view_id, fetch_attachments = true, max_records = 500 } = body;
  if (!app_id || !app_secret) return errorResponse("缺少 App ID 或 App Secret");
  if (!app_token || !table_id) return errorResponse("缺少 app_token 或 table_id");

  try {
    const token = await getTenantAccessToken(app_id, app_secret);
    const records = [];
    let pageToken = "";
    while (records.length < max_records) {
      const params = new URLSearchParams({ page_size: "500" });
      if (view_id) params.set("view_id", view_id);
      if (pageToken) params.set("page_token", pageToken);
      const data = await feishuFetch(
        `/bitable/v1/apps/${encodeURIComponent(app_token)}/tables/${encodeURIComponent(table_id)}/records?${params.toString()}`,
        token
      );
      const items = data.data?.items || [];
      records.push(...items);
      if (!data.data?.has_more) break;
      pageToken = data.data?.page_token || "";
      if (!pageToken) break;
    }

    const trimmed = records.slice(0, max_records);

    if (fetch_attachments) {
      const tokens = new Set();
      for (const r of trimmed) {
        for (const v of Object.values(r.fields || {})) {
          if (Array.isArray(v)) {
            for (const x of v) {
              if (x && x.file_token) tokens.add(x.file_token);
            }
          }
        }
      }
      if (tokens.size) {
        const tmpMap = await getAttachmentTmpUrls([...tokens], token);
        const downloaded = {};
        for (const ft of Object.keys(tmpMap)) {
          try {
            const info = await fetchUrlToDataUrl(tmpMap[ft]);
            downloaded[ft] = info;
          } catch (err) {
            downloaded[ft] = { error: err.message };
          }
        }
        for (const r of trimmed) {
          for (const v of Object.values(r.fields || {})) {
            if (Array.isArray(v)) {
              for (const x of v) {
                if (x && x.file_token && downloaded[x.file_token]) {
                  const d = downloaded[x.file_token];
                  if (d.data_url) {
                    x.data_url = d.data_url;
                    if (!x.type && d.mime) x.type = d.mime;
                  } else if (d.error) {
                    x.download_error = d.error;
                  }
                }
              }
            }
          }
        }
      }
    }

    const items = trimmed.map((r) => {
      const flat = flattenBitableFields(r.fields || {});
      if (!flat.id) flat.id = r.record_id;
      return flat;
    });

    return jsonResponse({ ok: true, total: items.length, items });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
