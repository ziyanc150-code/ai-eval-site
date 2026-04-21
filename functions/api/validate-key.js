export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const accessKey = String(body?.accessKey || "").trim();
    if (!accessKey) {
      return Response.json({ valid: false, reason: "empty" }, { status: 200 });
    }
    if (!env.ACCESS_KEYS) {
      return Response.json({
        valid: false,
        reason: "kv_not_bound",
        message: "Cloudflare 未绑定 KV（ACCESS_KEYS），请在 Pages 设置中绑定后重试。"
      }, { status: 200 });
    }

    const value = await env.ACCESS_KEYS.get(`key:${accessKey}`);
    if (!value) {
      return Response.json({
        valid: false,
        reason: "not_found",
        message: "密钥不存在或尚未保存到云端，请在密钥管理页点击「新增密钥」或「一键生成并保存」。"
      }, { status: 200 });
    }
    return Response.json({ valid: true, reason: "ok" });
  } catch (_err) {
    return Response.json({ valid: false, reason: "server_error", message: "校验失败，请稍后重试。" }, { status: 200 });
  }
}
