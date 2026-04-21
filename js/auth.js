const ACCESS_KEY_STORAGE = "access_key";

function getAccessKey() {
  return localStorage.getItem(ACCESS_KEY_STORAGE) || "";
}

function setAccessKey(key) {
  localStorage.setItem(ACCESS_KEY_STORAGE, key);
}

function clearAccessKey() {
  localStorage.removeItem(ACCESS_KEY_STORAGE);
}

async function verifyAccessKey(key) {
  const res = await fetch("/api/validate-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessKey: key })
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.valid);
}

async function requireAuth(redirectTo = "/index.html") {
  const key = getAccessKey();
  if (!key) {
    window.location.href = redirectTo;
    return false;
  }
  const valid = await verifyAccessKey(key);
  if (!valid) {
    clearAccessKey();
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

window.Auth = {
  ACCESS_KEY_STORAGE,
  getAccessKey,
  setAccessKey,
  clearAccessKey,
  verifyAccessKey,
  requireAuth
};
