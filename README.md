# 多模态 AI 自动化评测网站（公开安全版）

本项目已改成公开可发布版本：

- `index.html`：登录页（访问密钥）
- `app.html`：评测主页面
- `functions/api/validate-key.js`：校验密钥
- `functions/api/eval.js`：服务端代调用模型 API（前端不暴露模型 Key）

## 关键安全设计

- 前端不会保存平台模型 Key
- 模型 Key 仅存储在 Cloudflare 环境变量（`MODEL_API_KEY`）
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

## 评测请求流

1. 用户在 `index.html` 输入访问密钥
2. 前端请求 `/api/validate-key` 验证
3. 登录后前端调用 `/api/eval`
4. Cloudflare Functions 验证密钥 + 用服务端 `MODEL_API_KEY` 调模型
5. 返回 JSON 分数给前端展示

## 本地启动

```bash
npx serve .
```

## 上线

推送到 GitHub 后，Cloudflare Pages 会自动部署并得到 `https://xxx.pages.dev` 永久地址。

