export function isAdmin(request, env) {
  const headerToken = request.headers.get("x-admin-token") || "";
  return Boolean(env.ADMIN_TOKEN) && headerToken === env.ADMIN_TOKEN;
}

export function badAuth() {
  return Response.json({ error: "forbidden" }, { status: 403 });
}
