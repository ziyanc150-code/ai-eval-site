# 多模態 AI 自動化評測網站

此專案提供一個可直接部署的前端評測工具，支援：

- 文本評測
- 文生圖評測
- 文生視頻評測
- 圖生視頻評測

核心流程：

1. 使用者上傳 JSON/JSONL 資料檔
2. 前端組裝提示詞與評分維度
3. 呼叫你的多模態 API 取得 JSON 分數
4. 可選寫入 Supabase
5. 產出報告 JSON（`report.html`）

## 專案結構

```text
.
├── index.html
├── report.html
├── history.html
├── js/
│   ├── upload.js
│   ├── eval.js
│   └── supabase.js
└── css/
    └── style.css
```

## API 契約（你要提供的評測服務）

前端會 `POST` 到你填入的 API Endpoint，payload 形如：

```json
{
  "model": "your-model-name",
  "task_type": "text | text_to_image | text_to_video | image_to_video",
  "prompt": "完整評測提示詞",
  "dimensions": [{ "name": "相關性", "criteria": "..." }],
  "input": { "id": "sample-1", "input_text": "...", "output_text": "..." }
}
```

API 回應需為 JSON，至少包含：

```json
{
  "scores": {
    "相關性": 8,
    "正確性": 7
  },
  "comment": "簡短評語"
}
```

## Supabase 設定（可選）

前端目前從 `localStorage` 讀取：

- `supabase_url`
- `supabase_anon_key`
- `supabase_table`（預設 `eval_results`）

你可在瀏覽器 Console 先設定：

```js
localStorage.setItem("supabase_url", "https://YOUR_PROJECT.supabase.co");
localStorage.setItem("supabase_anon_key", "YOUR_ANON_KEY");
localStorage.setItem("supabase_table", "eval_results");
```

建議資料表欄位：

- `id` (uuid, pk)
- `task_type` (text)
- `model_name` (text)
- `prompt_template` (text)
- `dimensions` (jsonb)
- `raw_results` (jsonb)
- `avg_score` (numeric)
- `created_at` (timestamptz)

## 本機啟動

可用任意靜態伺服器，例如：

```bash
npx serve .
```

## 雲端部署

- Vercel / Netlify / Cloudflare Pages：直接部署靜態站點
- API 服務可獨立部署在雲端函式或後端服務
- Supabase 作為結果儲存層

