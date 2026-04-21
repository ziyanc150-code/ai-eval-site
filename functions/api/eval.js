async function checkAccess(env, accessKey) {
  if (!accessKey || !env.ACCESS_KEYS) return false;
  const value = await env.ACCESS_KEYS.get(`key:${accessKey}`);
  return Boolean(value);
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const accessKey = request.headers.get("x-access-key") || "";
    const ok = await checkAccess(env, accessKey);
    if (!ok) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = await request.json();
    const endpoint = env.MODEL_API_ENDPOINT;
    const apiKey = env.MODEL_API_KEY;
    const defaultModel = env.MODEL_NAME || "";
    if (!endpoint || !apiKey) {
      return Response.json({ error: "server env not configured" }, { status: 500 });
    }

    const model = payload.model || defaultModel;
    const upstreamPayload = {
      model,
      task_type: payload.task_type,
      prompt: payload.prompt,
      dimensions: payload.dimensions,
      input: payload.input
    };

    const upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(upstreamPayload)
    });

    const text = await upstreamRes.text();
    return new Response(text, {
      status: upstreamRes.status,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (err) {
    return Response.json({ error: err.message || "internal error" }, { status: 500 });
  }
}
