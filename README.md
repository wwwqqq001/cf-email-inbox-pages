# cf-email-inbox-pages

用于发布 `cf-email-inbox` 静态前端到 GitHub Pages。

## 使用方式

1. 打开 GitHub Pages 页面。
2. 页面会自动预填默认 Worker API Base URL：
   - `https://cf-email-inbox.wwwqqq001.workers.dev`
3. 手动输入 Bearer Token（例如你自己的 `API_TOKEN`）。
4. 保存后即可加载邮件列表与详情。

## 安全说明

- 仓库中**不包含** API Token。
- Token 仅由用户在浏览器中手动输入，并保存在本地 `localStorage`。
- 本仓库只包含静态页面文件，不包含 Cloudflare Worker 后端代码。

## 发布

本仓库通过 GitHub Actions 自动发布到 GitHub Pages。
