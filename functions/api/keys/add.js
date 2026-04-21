import { badAuth, isAdmin } from "./_shared.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(request, env)) return badAuth();
  if (!env.ACCESS_KEYS) {
    return Response.json({ error: "ACCESS_KEYS 未绑定" }, { status: 500 });
  }

  const body = await request.json();
  const key = String(body?.key || "").trim();
  if (!key || key.length < 8 || !/^[A-Za-z0-9_-]+$/.test(key)) {
    return Response.json({ error: "invalid key format" }, { status: 400 });
  }

  await env.ACCESS_KEYS.put(`key:${key}`, "1");
  return Response.json({ ok: true });
}
