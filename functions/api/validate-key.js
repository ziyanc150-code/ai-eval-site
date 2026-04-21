export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const accessKey = String(body?.accessKey || "").trim();
    if (!accessKey) {
      return Response.json({ valid: false }, { status: 400 });
    }
    if (!env.ACCESS_KEYS) {
      return Response.json({ valid: false, error: "ACCESS_KEYS 未绑定" }, { status: 500 });
    }

    const value = await env.ACCESS_KEYS.get(`key:${accessKey}`);
    return Response.json({ valid: Boolean(value) });
  } catch (_err) {
    return Response.json({ valid: false }, { status: 500 });
  }
}
