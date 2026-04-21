import { badAuth, isAdmin } from "./_shared.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!isAdmin(request, env)) return badAuth();
  if (!env.ACCESS_KEYS) {
    return Response.json({ error: "ACCESS_KEYS 未绑定" }, { status: 500 });
  }

  const list = await env.ACCESS_KEYS.list({ prefix: "key:" });
  const keys = (list.keys || []).map((x) => x.name.replace(/^key:/, ""));
  return Response.json({ keys });
}
