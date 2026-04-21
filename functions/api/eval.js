/**
 * 站內模型代理已永久關閉：避免使用站長的 MODEL_API_KEY 產生費用。
 * 評測請在 app.html 填寫自有 Endpoint + API Key，由瀏覽器直連。
 */
export async function onRequestPost() {
  return Response.json(
    {
      error: "server_proxy_disabled",
      message: "本站不提供代付模型调用。请在评测页填写「评测 API Endpoint」和「API Key」，由浏览器直连你的网关。"
    },
    { status: 403 }
  );
}
