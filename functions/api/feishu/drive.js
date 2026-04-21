import {
  jsonResponse,
  errorResponse,
  readJson,
  requireAccessKey,
  getTenantAccessToken,
  feishuDownloadToDataUrl
} from "./_utils.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireAccessKey(request, env);
  if (!auth.ok) return errorResponse(`访问被拒（${auth.reason}），请先登录`, 401);

  const body = await readJson(request);
  if (!body) return errorResponse("请求体不是合法 JSON");
  const { app_id, app_secret, file_token } = body;
  if (!app_id || !app_secret) return errorResponse("缺少 App ID 或 App Secret");
  if (!file_token) return errorResponse("缺少 file_token");

  try {
    const token = await getTenantAccessToken(app_id, app_secret);
    const info = await feishuDownloadToDataUrl(`/drive/v1/files/${encodeURIComponent(file_token)}/download`, token);
    return jsonResponse({ ok: true, ...info });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}
