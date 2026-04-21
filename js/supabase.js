function getSupabaseConfig() {
  return {
    url: localStorage.getItem("supabase_url") || "",
    anonKey: localStorage.getItem("supabase_anon_key") || "",
    tableName: localStorage.getItem("supabase_table") || "eval_results"
  };
}

async function saveToSupabase(record) {
  const { url, anonKey, tableName } = getSupabaseConfig();
  if (!url || !anonKey) {
    return { skipped: true, reason: "未设置 Supabase URL 或 Key，已跳过云端存储。" };
  }

  const endpoint = `${url}/rest/v1/${tableName}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Prefer: "return=representation"
    },
    body: JSON.stringify(record)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase 写入失败 ${res.status}: ${text}`);
  }
  const data = await res.json();
  return { skipped: false, data };
}

window.SupabaseUtils = {
  getSupabaseConfig,
  saveToSupabase
};
