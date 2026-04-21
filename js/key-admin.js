const adminTokenEl = document.getElementById("adminToken");
const newKeyEl = document.getElementById("newKey");
const loadKeysBtn = document.getElementById("loadKeysBtn");
const addKeyBtn = document.getElementById("addKeyBtn");
const genKeyBtn = document.getElementById("genKeyBtn");
const genSaveBtn = document.getElementById("genSaveBtn");
const keysListEl = document.getElementById("keysList");
const statusText = document.getElementById("statusText");

function setStatus(msg) {
  statusText.textContent = msg;
}

function getAdminToken() {
  return adminTokenEl.value.trim();
}

function generateAccessKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let suffix = "";
  for (let i = 0; i < 24; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ak_${suffix}`;
}

function renderKeys(keys) {
  keysListEl.innerHTML = "";
  if (!keys.length) {
    keysListEl.textContent = "暂无密钥。";
    return;
  }

  const ul = document.createElement("ul");
  keys.forEach((key) => {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = key;
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "删除";
    delBtn.style.width = "auto";
    delBtn.style.marginLeft = "8px";
    delBtn.addEventListener("click", async () => {
      const token = getAdminToken();
      if (!token) {
        setStatus("请先填写管理员令牌。");
        return;
      }
      const res = await fetch("/api/keys/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token
        },
        body: JSON.stringify({ key })
      });
      if (!res.ok) {
        setStatus("删除失败，请检查管理员令牌。");
        return;
      }
      setStatus("删除成功。");
      await loadKeys();
    });
    li.appendChild(text);
    li.appendChild(delBtn);
    ul.appendChild(li);
  });
  keysListEl.appendChild(ul);
}

async function loadKeys() {
  const token = getAdminToken();
  if (!token) {
    setStatus("请先填写管理员令牌。");
    return;
  }
  const res = await fetch("/api/keys/list", {
    method: "GET",
    headers: { "x-admin-token": token }
  });
  if (!res.ok) {
    setStatus("加载失败，请检查管理员令牌。");
    return;
  }
  const data = await res.json();
  renderKeys(data.keys || []);
  setStatus("加载成功。");
}

loadKeysBtn.addEventListener("click", async () => {
  await loadKeys();
});

if (genKeyBtn) {
  genKeyBtn.addEventListener("click", () => {
    newKeyEl.value = generateAccessKey();
    setStatus("已生成到输入框，尚未写入云端。请点击「保存当前密钥」或「一键生成并保存」。");
  });
}

async function saveKeyToCloud(key) {
  const token = getAdminToken();
  if (!token) {
    setStatus("请先填写管理员令牌。");
    return false;
  }
  if (!key || key.length < 8 || !/^[A-Za-z0-9_-]+$/.test(key)) {
    setStatus("密钥格式不正确。");
    return false;
  }
  const res = await fetch("/api/keys/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token
    },
    body: JSON.stringify({ key })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    setStatus(body.error ? `保存失败：${body.error}` : "保存失败，请检查管理员令牌与 Cloudflare KV 绑定。");
    return false;
  }
  return true;
}

if (genSaveBtn) {
  genSaveBtn.addEventListener("click", async () => {
    const key = generateAccessKey();
    newKeyEl.value = key;
    const ok = await saveKeyToCloud(key);
    if (!ok) return;
    setStatus(`已保存到云端。请复制以下密钥到首页登录：${key}`);
    await loadKeys();
  });
}

addKeyBtn.addEventListener("click", async () => {
  const key = newKeyEl.value.trim();
  const ok = await saveKeyToCloud(key);
  if (!ok) return;
  setStatus(`保存成功。请复制以下密钥到首页登录：${key}`);
  newKeyEl.value = "";
  await loadKeys();
});

