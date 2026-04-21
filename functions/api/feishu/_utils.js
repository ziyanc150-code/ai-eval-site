const FEISHU_BASE = "https://open.feishu.cn/open-apis";

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export function errorResponse(message, status = 400, extra = {}) {
  return jsonResponse({ ok: false, error: message, ...extra }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch (_e) {
    return null;
  }
}

export async function requireAccessKey(request, env) {
  const key = request.headers.get("x-access-key") || "";
  if (!key) return { ok: false, reason: "missing_access_key" };
  const kv = env.ACCESS_KEYS;
  if (!kv) return { ok: false, reason: "kv_not_bound" };
  const v = await kv.get(`key:${key}`);
  if (!v) return { ok: false, reason: "key_not_found" };
  return { ok: true };
}

export async function getTenantAccessToken(appId, appSecret) {
  if (!appId || !appSecret) throw new Error("缺少 App ID 或 App Secret");
  const res = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    throw new Error(`飞书鉴权失败：${data.msg || res.status}`);
  }
  return data.tenant_access_token;
}

export async function feishuFetch(path, token, init = {}) {
  const res = await fetch(`${FEISHU_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok || (typeof data.code === "number" && data.code !== 0)) {
    throw new Error(`飞书 API 失败：${data.msg || res.status} (path=${path})`);
  }
  return data;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function feishuDownloadToDataUrl(path, token, fallbackMime = "application/octet-stream") {
  const res = await fetch(`${FEISHU_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`飞书下载失败 ${res.status}: ${text}`);
  }
  const mime = res.headers.get("content-type") || fallbackMime;
  const buf = new Uint8Array(await res.arrayBuffer());
  return { data_url: `data:${mime};base64,${bytesToBase64(buf)}`, mime, size: buf.byteLength };
}

export async function getAttachmentTmpUrls(fileTokens, token) {
  if (!fileTokens.length) return {};
  const qs = fileTokens.map((t) => `file_tokens=${encodeURIComponent(t)}`).join("&");
  const data = await feishuFetch(`/drive/v1/medias/batch_get_tmp_download_url?${qs}`, token);
  const map = {};
  for (const x of data.data?.tmp_download_urls || []) {
    map[x.file_token] = x.tmp_download_url;
  }
  return map;
}

export async function fetchUrlToDataUrl(url, fallbackMime = "application/octet-stream") {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`附件 URL 下载失败 ${res.status}`);
  const mime = res.headers.get("content-type") || fallbackMime;
  const buf = new Uint8Array(await res.arrayBuffer());
  return { data_url: `data:${mime};base64,${bytesToBase64(buf)}`, mime, size: buf.byteLength };
}

/** 把飞书 Bitable 文本段/附件数组扁平化 */
export function flattenBitableValue(v) {
  if (Array.isArray(v)) {
    if (v.length && v[0] && typeof v[0] === "object") {
      if (v[0].text !== undefined || v[0].type === "text") {
        return v.map((s) => s.text || "").join("");
      }
      if (v[0].file_token) {
        return v;
      }
    }
    return v;
  }
  return v;
}

/** 把字段集合扁平化 + 自动把附件映射到 image_url / video_url / frame_urls */
export function flattenBitableFields(fields) {
  const out = {};
  const extraFrames = [];
  for (const [k, rawVal] of Object.entries(fields)) {
    const flat = flattenBitableValue(rawVal);
    if (Array.isArray(flat) && flat[0]?.file_token) {
      out[k] = flat;
      for (const att of flat) {
        const t = (att.type || "").toLowerCase();
        const url = att.data_url || att.url || att.tmp_url || "";
        if (!url) continue;
        if (t.startsWith("image")) {
          if (!out.image_url) out.image_url = url;
          else extraFrames.push(url);
        } else if (t.startsWith("video")) {
          if (!out.video_url) out.video_url = url;
        }
      }
    } else {
      out[k] = flat;
    }
  }
  if (extraFrames.length && !out.frame_urls) out.frame_urls = extraFrames;
  return out;
}
