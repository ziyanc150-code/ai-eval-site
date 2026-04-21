const accessKeyEl = document.getElementById("accessKey");
const loginBtn = document.getElementById("loginBtn");
const statusText = document.getElementById("statusText");

function setStatus(text) {
  statusText.textContent = text;
}

function updateButtonState() {
  const value = accessKeyEl.value.trim();
  if (!value) {
    loginBtn.disabled = true;
    loginBtn.textContent = "请填写密钥";
    setStatus("请填写密钥");
    return;
  }
  loginBtn.disabled = false;
  loginBtn.textContent = "登录";
  setStatus("");
}

accessKeyEl.addEventListener("input", updateButtonState);

function normalizeKey(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

loginBtn.addEventListener("click", async () => {
  const key = normalizeKey(accessKeyEl.value);
  if (!key) {
    loginBtn.disabled = true;
    loginBtn.textContent = "请填写密钥";
    setStatus("请填写密钥");
    return;
  }

  if (key.length < 8 || !/^[A-Za-z0-9_-]+$/.test(key)) {
    setStatus("密钥格式不正确（仅允许字母数字下划线与中划线，长度≥8）。");
    return;
  }

  try {
    const res = await fetch("/api/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey: key })
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (data.valid === true) {
      localStorage.setItem("access_key", key);
      window.location.href = "/app.html";
      return;
    }

    const errStr = String(data.error || "");

    if (data.reason === "kv_not_bound" || errStr.includes("ACCESS_KEYS")) {
      setStatus(
        "服务器未绑定 KV：请到 Cloudflare Pages → ai-eval-site → Settings → Bindings → 添加 KV namespace，Variable name 必须填 ACCESS_KEYS。可先打开 /api/health 查看 kv_bound 是否为 true。"
      );
      return;
    }

    if (data.reason === "not_found" || data.reason === "empty") {
      setStatus(
        data.message ||
          "密钥不存在或未写入云端。请打开 /key-admin.html，填写 ADMIN_TOKEN，点击「一键生成并保存」，再用页面提示的那串密钥登录（不要只点生成不保存）。"
      );
      return;
    }

    if (!res.ok) {
      setStatus(`服务器返回 ${res.status}。请确认已重新部署 Pages，并检查 Functions 日志。响应片段：${text.slice(0, 120)}`);
      return;
    }

    setStatus(
      data.message ||
        "密钥校验未通过。请核对与管理页「现有密钥」列表完全一致；若刚保存，请等待 1 分钟后重试或 Ctrl+F5 强刷。"
    );
  } catch (_err) {
    setStatus("网络异常，请重试");
  }
});

updateButtonState();
