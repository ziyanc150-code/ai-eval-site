# 多模态 AI 自动化评测网站（公开安全版）

本项目已改成公开可发布版本：

- `index.html`：登录页（访问密钥）
- `app.html`：评测主页面
- `functions/api/validate-key.js`：校验密钥
- `functions/api/eval.js`：服务端代调用模型 API（前端不暴露模型 Key）
- `functions/api/health.js`：自检接口 `GET /api/health`（查看 `kv_bound` 等）
- `key-admin.html`：网页密钥管理页（增删 key）

## 评测 API 两种用法（`app.html`）

1. **自有 API（BYOK）**：填写「评测 API Endpoint」与「API Key」，请求由**浏览器直连**你的网关；需自行处理 **CORS** 允许当前站点 origin。适合公开站点、每人自带密钥。
2. **本站代理**：将 Endpoint **留空**，请求走 `POST /api/eval`，由 Cloudflare 使用环境变量 `MODEL_API_ENDPOINT` / `MODEL_API_KEY`（不在页面展示）。

## 关键安全设计

- 平台托管模式：模型 Key 仅存储在 Cloudflare 环境变量（`MODEL_API_KEY`）
- BYOK 模式：用户密钥仅在浏览器会话中使用，**勿**把他人密钥写入仓库
- 登录密钥存储在 Cloudflare KV（`ACCESS_KEYS`）
- 删除 KV 中某个密钥后，该密钥立即失效
- 同一密钥支持多设备登录（无设备绑定）

## 登录规则（已实现）

- 不填密钥：按钮灰色不可点击，显示“请填写密钥”
- 填对密钥：可登录并进入 `app.html`
- 填错密钥：拦截评测功能，显示“输入错误”

## Cloudflare Pages 必配项

### 1) 绑定 KV（多密钥管理）

在 Pages 项目设置中添加 KV 绑定：

- 变量名：`ACCESS_KEYS`
- 指向你的 KV namespace

KV 的 key/value 建议：

- Key：`key:你的密钥`（例如 `key:teamA_2026_001`）
- Value：`1`

你可添加多个 key；删除某个 key 即失效。

### 2) 设置环境变量（服务端）

在 Pages 项目设置中添加：

- `MODEL_API_ENDPOINT`：你的模型评测 API 地址
- `MODEL_API_KEY`：你的平台模型 Key（Secret）
- `MODEL_NAME`：默认模型名（可选）
- `ADMIN_TOKEN`：密钥管理页使用的管理员令牌（必填，建议高强度随机串）

## 网页管理密钥（已实现）

访问 `https://你的域名/key-admin.html`：

1. 输入管理员令牌（`ADMIN_TOKEN`）
2. 点击“加载密钥列表”
3. 可新增/删除登录密钥

对应后端接口：

- `GET /api/keys/list`
- `POST /api/keys/add`
- `POST /api/keys/delete`

## 评测请求流

1. 用户在 `index.html` 输入访问密钥
2. 前端请求 `/api/validate-key` 验证
3. 登录后在 `app.html`：
   - **填了 Endpoint**：浏览器 `POST` 到用户 Endpoint（可选 `Authorization: Bearer`）
   - **未填 Endpoint**：浏览器 `POST` 到 `/api/eval`，Functions 校验 `x-access-key` 后用 `MODEL_API_*` 代调
4. 返回 JSON 分数并生成报告

## 本地启动

```bash
npx serve .
```

## 上线

推送到 GitHub 后，Cloudflare Pages 会自动部署并得到 `https://xxx.pages.dev` 永久地址。

## 重要：为什么必须有 `404.html`

Cloudflare Pages 在**没有**顶层 `404.html` 时，会把站点当成 **SPA**：大量未匹配路径会被回退到根目录的 `index.html`。  
这会导致你访问 `/api/health` 也看到登录页（误以为接口坏了）。

本项目已包含 `404.html` 来关闭该行为，让 `/api/*` 能正常命中 Pages Functions。

