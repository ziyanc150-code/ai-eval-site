---
name: cloudflare-pages-eval-secure-deploy
description: Deploys and debugs static AI evaluation sites on Cloudflare Pages with Functions, KV-backed access keys, and encrypted admin secrets. Covers SPA 404 pitfalls, Worker vs Pages bindings, redeploy for env changes, and auth UX. Use when shipping or troubleshooting Pages + Functions + KV on pages.dev, secure eval frontends, or login and /api/* failures.
---

# Cloudflare Pages 評測站：安全部署與排錯

## 何時套用本 skill

- 靜態前端 + `functions/` 後端（驗證、密鑰管理；評測可僅 BYOK 直連）
- 使用 **KV** 存多把「訪問密鑰」、**Secrets** 存 `ADMIN_TOKEN`（若關閉站內模型代理則不需 `MODEL_API_KEY`）
- 使用者回報：`pages.dev` 登入失敗、`/api/*` 回成首頁 HTML、部署卡住、環境變數改了不生效

---

## 核心概念（先對齊名詞）

| 名稱 | 用途 | 儲存位置 | 誰能看見 |
|------|------|------------|----------|
| **訪問密鑰**（access key） | 首頁登入、前端流程內校驗用 | **KV**，鍵名慣例 `key:<accessKey>` | 管理員在密鑰管理頁增刪；使用者只拿到自己那串 |
| **ADMIN_TOKEN** | 僅密鑰管理 API（`/api/keys/*`） | **Pages → Variables and Secrets（Secret）** | 後台加密顯示；**保存後無法再看明文**，需自行記錄或重設 |
| **使用者模型 Key**（BYOK） | 瀏覽器直連使用者 Endpoint | **僅使用者本機／會話**；不入庫 | 站方不代付；需使用者自備 CORS |

**常見錯誤**：把 `ADMIN_TOKEN` 當成首頁「訪問密鑰」→ KV 查無 → 永遠失敗。

---

## 部署前檢查清單（避免返工）

1. **專案類型**：必須是 **Pages**（網域 `*.pages.dev`），不要把 KV / 變數綁到同名 **Worker**（`*.workers.dev`）。
2. **Bindings**：`Settings → Bindings` 新增 **KV namespace**，**Variable name 必須**為 `ACCESS_KEYS`（與程式 `env.ACCESS_KEYS` 一致）。
3. **Secrets / Variables**：至少 `ADMIN_TOKEN`（Secret）。若站內 **不** 代理模型，勿依賴 `MODEL_API_*`；評測改為使用者自填 Endpoint + Key。
4. **靜態站 SPA 陷阱**：若專案**沒有**根目錄 **`404.html`**，Pages 可能把整站當 SPA，**未匹配路徑（含 `/api/health`）回退到 `index.html`**，看起來像「接口壞了」。有 API 路由時應保留 `404.html`。
5. **改 Secret 後**：介面若提示「下次部署生效」→ **必須觸發一次新部署**（Retry / 空 commit `git push`），再測管理頁與登入。
6. **佇列**：多個 **Queued** 時，線上仍是舊版；以 **最新 Success** 為準，必要時取消舊佇列或 Retry。
7. **前端本機**：`file://` 開啟時，舊版 `type="module"` 可能導致腳本未載入；優先用 **`http://127.0.0.1:port`** 或正式網址驗證。
8. **金鑰流程**：密鑰管理頁必須 **「生成並保存」** 寫入 KV；只填在輸入框不保存＝雲端無此 key。
9. **API 回傳與 UX**：後端 `validate-key` 若用 HTTP 500，前端勿一律顯示「輸入錯誤」；應解析 body（`reason` / `message` / `error`）並區分「KV 未綁定」「不存在」「格式錯」。
10. **機密檔**：`config.local.js`、本機 key 檔必須 **`.gitignore`**，避免推上公開倉庫。
11. **僅 BYOK、禁止站內代付**：公開站若不想承擔他人模型費用，應 **強制** 使用者自填 Endpoint + API Key，並 **關閉或 403** `/api/eval` 類代理；BYOK 必提醒 **CORS**（允許當前 `origin`）。

---

## 標準驗證順序（給使用者或自測）

1. `GET /api/health` → 應為 **JSON**（例如 `kv_bound`）；若為整頁登入 HTML → 先查 **404.html / SPA / 部署是否為最新**。
2. `/key-admin.html` → 填 **ADMIN_TOKEN** → **一鍵生成並保存** → 複製提示的 **`ak_...`**。
3. 首頁 → 貼 **訪問密鑰**（`ak_...`），**不要**貼 `ADMIN_TOKEN`。

---

## Cloudflare UI 導航速記

- **建立 KV**：左側 **Storage & databases → KV**，建 namespace 後回到 Pages **Bindings** 綁定為 `ACCESS_KEYS`。
- **建立 Pages 專案**：**Create application** → 若沒看到 Pages，用頁底 **「Looking to deploy Pages? Get started」**。
- **勿混淆**：同一專案名可能同時存在 **Pages** 與 **Worker**；綁定與網址以 **`.pages.dev`** 那條為準。

---

## Agent 執行建議（更高效）

1. 使用者說「登入/API 錯」時，**先區分**：是 **KV / 部署 / SPA**，還是 **填錯鑰匙類型**；不要先假設使用者操作錯。
2. 需要代測線上 API 時，用 **可重現的 HTTP 請求**（含 body），並區分 **HTTP 狀態** 與 **JSON 業務欄位**。
3. 變更 **Secrets** 後，主動提醒 **觸發部署**，並給出 **具體替代步驟**（無 Retry 按鈕時的 `git commit --allow-empty`）。
4. 文件與 UI 文案並行：**ADMIN_TOKEN** 與 **訪問密鑰** 用不同標籤與範例，減少誤解。

---

## 本次對話中實際踩過的坑（濃縮）

- 雙擊 `file://` + `import` 導致按鈕無反應 → 改非 module 或建議本機 HTTP。
- 語系需求變更 → 統一 `lang` 與文案策略並一次改齊。
- 任務類型分模板 → 用 preset 表驅動，避免硬編碼單一模板。
- Vercel 註冊失敗 → 改 **GitHub + Cloudflare Pages** 路線。
- **Pages vs Worker** 雙專案同名 → 綁定與說明必須指名 **`.pages.dev`**。
- **Queued 部署** → 線上非最新；環境變數亦依賴新部署。
- **無 `404.html`** → `/api/*` 被 SPA 回成 `index.html`。
- **`ADMIN_TOKEN` 加密不可見** → 使用者易與訪問密鑰混淆 → 流程與錯誤提示要寫死區分。
- **`ACCESS_KEYS` 未綁** → `validate-key` 500，前端若只顯示「輸入錯誤」會誤導 → 應回傳可解析原因並顯示。
- **站內代理 + 公開站** → 易產生站長代付費用；若產品要求「各用各 Key」，應 **只做 BYOK** 並關閉代理端點。
