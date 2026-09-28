# Vic Log

Vic Log 是一个以 Markdown 管理内容的轻量个人博客。它使用 Next.js 静态导出，首页、文章、归档、关于页和 RSS 都会在构建时生成，无需数据库或后台管理系统。

## 环境要求

- Node.js `^22.12.0`、`^24.0.0` 或 `>=26.0.0`
- npm（随 Node.js 安装）

## 本地运行

```bash
npm install
npm run dev
```

开发服务器启动后，按终端提示访问本地地址。常用命令：

```bash
npm test                 # 运行测试
npm run build            # 构建静态站点
npm start                # 在本地预览已构建的 out/
```

`npm run build` 会把可部署的静态文件写入 `out/`。`npm start` 不会重新构建；运行前请先执行 `npm run build`。

## 修改站点信息

编辑 `content/site.md`：

```yaml
---
name: Vic's Log
author: Meng Weifei
tagline: 关于工程、产品与思考
avatar: /avatar.jpg
email: hello@example.com
github: https://github.com/example
---

这里的 Markdown 正文会显示在“关于”页面。
```

字段说明：

- `name`、`author`、`tagline` 必填；`tagline` 可以是空字符串。
- `avatar`、`email`、`github` 可选，也可以留空；当前页面会使用 `avatar`，`email` 和 `github` 作为预留资料字段暂不渲染。
- Frontmatter 后的 Markdown 正文是关于页内容。

头像必须是 `public/` 中已经存在的站内文件。默认配置为 `/avatar.jpg`：可将图片放到 `public/avatar.jpg`，也可把 `avatar` 改成其他已存在文件对应的路径，例如 `public/images/me.png` 对应 `/images/me.png`。文件不存在时，页面会显示文字占位头像。

## 新建文章

复制一篇示例文章，再修改内容：

```bash
cp content/posts/think-further.md content/posts/my-new-post.md
```

文件名会成为文章 URL 的 slug，只能使用小写 ASCII 字母、数字和连字符，例如 `my-new-post.md`；不能使用中文、空格、下划线或大写字母。

每篇文章的 Frontmatter 格式如下：

```yaml
---
title: 我的新文章
date: 2026-09-24
excerpt: 一句话介绍文章内容。
published: true
category: 随笔
---
```

- `title`、`date`、`excerpt`、`published` 必填。
- `date` 必须使用有效的 `YYYY-MM-DD` 日期。
- `category` 可选。
- 将 `published` 设为 `false` 可保存草稿；草稿不会出现在页面或 RSS 中。

Frontmatter 之后可使用 Markdown 和 GFM（GitHub Flavored Markdown），例如：

````markdown
## 小标题

正文支持 **粗体**、[链接](https://example.com) 和删除线：~~旧内容~~。

- [x] 已完成
- [ ] 待处理

| 项目 | 状态 |
| --- | --- |
| 静态构建 | 完成 |

> 这是一段引用。

```ts
const message = "Hello, Vic Log";
```
````

## 部署前构建

部署前必须把 `NEXT_PUBLIC_SITE_URL` 设置为站点真实的绝对源地址（仅包含协议、域名和可选端口，不能包含路径、查询参数、片段或账号密码），否则 RSS 中的链接会错误。

将下面的域名替换为你的真实域名后执行：

```bash
NEXT_PUBLIC_SITE_URL=https://blog.your-domain.com npm run build
```

未设置该变量时会使用 `https://example.com`，这只用于本地构建和质量检查，不应将这种产物部署到线上。构建完成后，部署 `out/` 目录中的静态文件即可；具体发布方式由你的托管平台决定。

## 目录结构

```text
.
├── app/                  # Next.js 页面、布局与 RSS 路由
├── components/           # 页面组件与样式
├── content/
│   ├── site.md           # 站点资料和关于页正文
│   └── posts/            # Markdown 文章
├── lib/                  # 内容读取、校验、站点 URL 与 RSS 生成
├── public/               # 头像、图标等静态资源
├── next.config.ts        # 静态导出配置
└── package.json          # 依赖与 npm 命令
```
