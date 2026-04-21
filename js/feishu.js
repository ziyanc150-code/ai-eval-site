(function () {
  const LS = {
    appId: "feishu_app_id",
    appSecret: "feishu_app_secret",
    lastUrl: "feishu_last_url"
  };

  function $(id) { return document.getElementById(id); }

  function parseFeishuUrl(url) {
    const u = String(url || "").trim();
    if (!u) return null;
    const out = { type: null, app_token: null, table_id: null, view_id: null, spreadsheet_token: null, file_token: null };
    const mBase = u.match(/\/base\/([A-Za-z0-9]+)/);
    if (mBase) {
      out.type = "bitable";
      out.app_token = mBase[1];
      const q = new URL(u, "https://dummy.local");
      out.table_id = q.searchParams.get("table") || q.searchParams.get("tbl") || null;
      out.view_id = q.searchParams.get("view") || null;
      return out;
    }
    const mSheet = u.match(/\/sheets\/([A-Za-z0-9]+)/);
    if (mSheet) {
      out.type = "sheet";
      out.spreadsheet_token = mSheet[1];
      return out;
    }
    const mFile = u.match(/\/file\/([A-Za-z0-9]+)/);
    if (mFile) {
      out.type = "drive";
      out.file_token = mFile[1];
      return out;
    }
    return null;
  }

  async function callApi(path, body) {
    const accessKey = (window.Auth && window.Auth.getAccessKey && window.Auth.getAccessKey()) || "";
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-access-key": accessKey
      },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { ok: false, error: text || `HTTP ${res.status}` }; }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  async function importFromFeishu({ setStatus, onItems }) {
    const appId = $("feishuAppId").value.trim();
    const appSecret = $("feishuAppSecret").value.trim();
    const urlOrToken = $("feishuUrl").value.trim();
    const tableIdManual = $("feishuTableId").value.trim();
    const rangeInput = $("feishuRange").value.trim();
    const fetchAttachments = $("feishuFetchAttachments").checked;
    const maxRecords = Math.max(1, Math.min(5000, Number($("feishuMaxRecords").value) || 500));

    if (!appId || !appSecret) throw new Error("请填写 App ID 与 App Secret");
    if (!urlOrToken) throw new Error("请粘贴飞书文档链接");

    localStorage.setItem(LS.appId, appId);
    localStorage.setItem(LS.appSecret, appSecret);
    localStorage.setItem(LS.lastUrl, urlOrToken);

    const parsed = parseFeishuUrl(urlOrToken);
    if (!parsed) throw new Error("无法解析链接，请确认是 /base/、/sheets/ 或 /file/ 开头的飞书 URL");

    if (parsed.type === "bitable") {
      if (!parsed.table_id && !tableIdManual) throw new Error("Bitable 链接缺少 table=... 参数，请在右侧 table_id 手动填入");
      setStatus("正在从飞书多维表格拉取数据（含附件下载，可能较慢）...");
      const data = await callApi("/api/feishu/bitable", {
        app_id: appId,
        app_secret: appSecret,
        app_token: parsed.app_token,
        table_id: parsed.table_id || tableIdManual,
        view_id: parsed.view_id || undefined,
        fetch_attachments: fetchAttachments,
        max_records: maxRecords
      });
      setStatus(`飞书多维表格导入成功：${data.total} 条记录。`);
      onItems(data.items, { source: "bitable", total: data.total });
      return;
    }

    if (parsed.type === "sheet") {
      if (!rangeInput) throw new Error("读取电子表格需要填写范围（如 Sheet1!A1:E200）");
      setStatus("正在从飞书电子表格读取范围...");
      const data = await callApi("/api/feishu/sheet", {
        app_id: appId,
        app_secret: appSecret,
        spreadsheet_token: parsed.spreadsheet_token,
        range: rangeInput
      });
      setStatus(`飞书电子表格导入成功：${data.total} 条记录。`);
      onItems(data.items, { source: "sheet", total: data.total });
      return;
    }

    if (parsed.type === "drive") {
      setStatus("正在下载飞书云空间文件（xlsx/图/视频）...");
      const data = await callApi("/api/feishu/drive", {
        app_id: appId,
        app_secret: appSecret,
        file_token: parsed.file_token
      });
      onItems(null, { source: "drive", data_url: data.data_url, mime: data.mime, size: data.size });
      setStatus(`飞书云空间文件已下载（${(data.size / 1024 / 1024).toFixed(2)} MB），类型：${data.mime}`);
      return;
    }
  }

  function initFeishuUI() {
    const idEl = $("feishuAppId");
    const secretEl = $("feishuAppSecret");
    const urlEl = $("feishuUrl");
    if (idEl) idEl.value = localStorage.getItem(LS.appId) || "";
    if (secretEl) secretEl.value = localStorage.getItem(LS.appSecret) || "";
    if (urlEl) urlEl.value = localStorage.getItem(LS.lastUrl) || "";
  }

  window.Feishu = { importFromFeishu, initFeishuUI, parseFeishuUrl };
})();
