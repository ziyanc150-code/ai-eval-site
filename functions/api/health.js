export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  return Response.json(
    {
      ok: true,
      kv_bound: Boolean(env.ACCESS_KEYS),
      model_endpoint_set: Boolean(env.MODEL_API_ENDPOINT),
      model_key_set: Boolean(env.MODEL_API_KEY)
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
