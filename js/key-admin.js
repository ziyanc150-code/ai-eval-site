const adminTokenEl = document.getElementById("adminToken");
const newKeyEl = document.getElementById("newKey");
const loadKeysBtn = document.getElementById("loadKeysBtn");
const addKeyBtn = document.getElementById("addKeyBtn");
const genKeyBtn = document.getElementById("genKeyBtn");
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

genKeyBtn.addEventListener("click", () => {
  newKeyEl.value = generateAccessKey();
  setStatus("已生成新密钥，请点击“新增密钥”保存。");
});

addKeyBtn.addEventListener("click", async () => {
  const token = getAdminToken();
  const key = newKeyEl.value.trim();
  if (!token) {
    setStatus("请先填写管理员令牌。");
    return;
  }
  if (!key || key.length < 8 || !/^[A-Za-z0-9_-]+$/.test(key)) {
    setStatus("密钥格式不正确。");
    return;
  }
  const res = await fetch("/api/keys/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token
    },
    body: JSON.stringify({ key })
  });
  if (!res.ok) {
    setStatus("新增失败，请检查管理员令牌。");
    return;
  }
  newKeyEl.value = "";
  setStatus("新增成功。");
  await loadKeys();
});

