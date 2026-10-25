<p align="center">
  <img src="assets/logo.png" alt="EndlessPixel" width="360">
</p>

<h1 align="center">无尽像素服务器 Bug 追踪器</h1>

> 一个轻量、美观、全端自适应的公开漏洞看板，由 GitHub Issues 驱动，无需后端服务器。

在线地址：<https://bugs.endlesspixel.cn>

---

## 简介

**EndlessPixel Bug Tracker** 是 [EndlessPixel（无尽像素）](https://github.com/EndlessPixel-Studio) 游戏服务器的官方 Bug 追踪面板。
它将 GitHub 仓库的 Issues 直接渲染为一个干净、可读的 Web 界面，玩家和开发者可以在这里浏览、检索与查看每一个漏洞的详情、状态与讨论记录。

整个项目是一个纯静态网站（HTML + CSS + JS），不依赖任何自建后端 —— 数据全部来自公开的 GitHub Issues API，并通过 `sessionStorage` 做短时缓存以降低请求频率。

## 功能特性

- **全端自适应**：桌面端左右分栏，平板与手机自动切换为抽屉式侧边栏，操作顺手。
- **深色 / 浅色主题**：内置主题切换，并会记忆你的偏好，首次访问自动跟随系统设置。
- **实时状态标签**：以彩色徽章直观区分「已修复 / 未修复 / 待确认 / 不予修复 / 无法修复 / 特意设计为之 / 重复」。
- **当页搜索**：在侧边栏快速过滤当前页的漏洞标题与编号。
- **Markdown 渲染**：问题描述与评论完整支持 GitHub 风格 Markdown（代码块、表格、列表、图片等），并经过 DOMPurify 净化，安全可信。
- **骨架屏加载**：数据加载时展示占位动画，体验更流畅。
- **分享直达**：URL 中携带 `?page=` 与 `?bug=` 参数，可直接分享某个漏洞或某一页。

## 工作原理

```
GitHub Issues (EndlessPixel-Studio/EndlessPixel-Bug-Tracker)
        │  公开的 REST API
        ▼
   script.js  ──►  拉取 issue 列表 / 评论
        │
        ├─►  解析 labels 得到「状态 / 类型」
        ├─►  marked 渲染 Markdown + DOMPurify 净化
        └─►  sessionStorage 缓存（5 分钟）
        ▼
   index.html + style.css  ──►  渲染看板界面
```

- 列表接口：`GET /repos/{repo}/issues?state=all`
- 评论接口：`GET /repos/{repo}/issues/{number}/comments`
- 每页展示 20 条，按创建时间倒序排列；通过响应头 `Link` 判断是否还有下一页。

## 标签约定

看板通过 Issue 的 **Labels** 自动识别分类，请在提交时正确添加：

| 标签 | 含义 |
| --- | --- |
| `status:已修复` | 漏洞已修复 |
| `status:未修复` | 尚未修复（默认） |
| `status:待确认` | 等待复现 / 核实 |
| `status:不予修复` | 官方决定不修复 |
| `status:无法修复` | 受引擎 / 环境限制无法修复 |
| `status:特意设计为之` | 属于预期设计而非 Bug |
| `status:重复` | 与已有 Issue 重复 |
| `type:xxx` | 漏洞类型（如 `type:崩溃`、`type:平衡` 等），前缀 `type:` 之后的内容会显示在「类型」一栏 |

未命中任何 `status:*` 标签的 Issue 默认归为 **待确认**；未命中 `type:*` 的归为 **未分类**。

## 如何报告 Bug

点击界面右上角的 **报告 Bug**，或在 GitHub 仓库中新建 Issue 并选择对应模板：

<https://github.com/EndlessPixel-Studio/EndlessPixel-Bug-Tracker/issues/new/choose>

建议包含：复现步骤、预期与实际表现、发生时间、客户端版本，以及必要的截图。

## 技术栈

- 原生 HTML / CSS / JavaScript（无构建步骤、无框架）
- [marked](https://github.com/markedjs/marked) —— Markdown 解析
- [DOMPurify](https://github.com/cure53/DOMPurify) —— HTML 净化，防止 XSS
- GitHub REST API v3 —— 数据源

## 本地运行

无需安装依赖，直接以静态文件方式打开即可：

```bash
# 方式一：直接用浏览器打开
open index.html

# 方式二：起一个本地静态服务器（推荐，避免某些浏览器的本地文件限制）
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

> 由于调用的是 GitHub 公开 API，无需任何 Token 即可读取公开仓库数据；
> 但在高频访问时可能触发 GitHub 的速率限制（约每小时 60 次未鉴权请求），界面会给出友好提示。

## 部署

项目为纯静态站点，可托管于任意静态托管服务（GitHub Pages、Cloudflare Pages、Netlify 等）。
当前线上版本部署在 Cloudflare Pages，自定义域名为 `bugs.endlesspixel.cn`（见 `CNAME`）。

## 许可证

- **网站代码与脚本**（`index.html`、`style.css`、`script.js` 等）采用
  [GNU Affero General Public License v3.0（AGPL-3.0）](./LICENSE)。
- **Bug 数据与网站内容**（Issues、描述、评论、文案等）采用
  [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International（CC BY-NC-SA 4.0）](./LICENSE-CC%20BY-NC-SA%204.0)。

---

© EndlessPixel Studio
