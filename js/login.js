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

loginBtn.addEventListener("click", async () => {
  const key = accessKeyEl.value.trim();
  if (!key) {
    loginBtn.disabled = true;
    loginBtn.textContent = "请填写密钥";
    setStatus("请填写密钥");
    return;
  }

  // 本地格式拦截，格式明显不对时不发请求。
  if (key.length < 8 || !/^[A-Za-z0-9_-]+$/.test(key)) {
    setStatus("输入错误");
    return;
  }

  try {
    const res = await fetch("/api/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey: key })
    });
    if (!res.ok) {
      setStatus("输入错误");
      return;
    }
    const data = await res.json();
    if (!data.valid) {
      setStatus("输入错误");
      return;
    }

    localStorage.setItem("access_key", key);
    window.location.href = "/app.html";
  } catch (_err) {
    setStatus("网络异常，请重试");
  }
});

updateButtonState();
