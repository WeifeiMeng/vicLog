# Vic Log 本地启动指南

本文说明如何在本机启动、预览和修改 Vic Log。

## 1. 环境准备

需要安装：

- Node.js `^22.12.0`、`^24.0.0` 或 `>=26.0.0`
- npm（随 Node.js 一起安装）

检查版本：

```bash
node --version
npm --version
```

## 2. 安装依赖

进入项目根目录后执行：

```bash
npm install
```

如果希望严格按照 `package-lock.json` 重新安装，可执行：

```bash
npm ci
```

## 3. 启动开发服务器

```bash
npm run dev
```

终端会显示实际访问地址，通常是：

```text
http://localhost:3000
```

如果 3000 端口已被占用，Next.js 会自动选择其他端口，请以终端输出为准。开发模式支持热更新，修改组件、样式或 Markdown 后刷新页面即可查看效果。

主要页面：

- `/`：首页
- `/about/`：关于页
- `/archive/`：文章归档
- `/posts/<slug>/`：文章详情
- `/rss.xml`：RSS

## 4. 修改博客资料

编辑 [`content/site.md`](../content/site.md)：

```yaml
---
name: Vic Log
author: Meng Weifei
tagline: ""
avatar: /avatar.jpg
email: ""
github: ""
---

这里填写关于页正文，支持 Markdown。
```

- `name`、`author`、`tagline` 必须保留，`tagline` 可以为空。
- 头像放在 `public/` 中。例如 `public/avatar.jpg` 对应 `/avatar.jpg`。
- 头像文件不存在时，页面自动显示 `MW` 文字占位。
- Frontmatter 后的正文会显示在关于页。

## 5. 新建或修改文章

每篇文章是 `content/posts/` 下的一个 Markdown 文件。可以复制示例：

```bash
cp content/posts/think-further.md content/posts/my-new-post.md
```

文件名会成为 URL，必须使用小写英文字母、数字和连字符，例如：

```text
my-new-post.md
```

文章格式：

```yaml
---
title: 我的新文章
date: 2026-09-24
category: 随笔
excerpt: 一句话介绍文章内容。
published: true
---

这里开始写 Markdown 正文。
```

- `title`、`date`、`excerpt`、`published` 必填。
- `date` 使用有效的 `YYYY-MM-DD` 日期。
- `category` 可选。
- `published: false` 表示草稿，不会出现在首页、归档和 RSS 中。

## 6. 运行检查

```bash
npm test
npx tsc --noEmit --incremental false
```

测试主要覆盖 Markdown 内容校验、排序、草稿过滤和 RSS 生成。

## 7. 构建并预览静态站点

普通本地构建：

```bash
npm run build
```

构建产物位于 `out/`。本地预览构建结果：

```bash
npm start
```

`npm start` 会显示实际预览地址；如果 3000 端口被占用，会自动使用其他端口。

构建线上版本前，必须设置真实站点地址，否则 RSS 会使用本地占位域名：

```bash
NEXT_PUBLIC_SITE_URL=https://blog.your-domain.com npm run build
```

该值必须是完整的 HTTP(S) origin，不能包含路径、查询参数、片段或账号密码。

## 8. 常见问题

### 修改 Markdown 后页面报错

检查 Frontmatter 是否由两行 `---` 包围、必填字段是否齐全、日期是否有效。构建错误会指出对应文件和字段。

### 新文章打不开

检查文件名是否只包含小写 ASCII 字母、数字和连字符，并确认 `published` 为 `true`。

### 头像没有显示

确认 `avatar` 指向 `public/` 中真实存在的站内文件。例如 `/images/me.jpg` 对应 `public/images/me.jpg`。

### RSS 链接仍是 `example.com`

使用 `NEXT_PUBLIC_SITE_URL` 重新执行构建，并部署新生成的 `out/` 目录。

### 端口被占用

开发服务器或静态预览会选择空闲端口。直接使用终端中显示的 URL，不要固定假设为 3000。
