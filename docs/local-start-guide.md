# Vic Log 本地启动指南

本文说明如何在本机启动、预览和修改 Vic Log，以及如何使用 `/write` 管理 Markdown 文章。

线上文章的标准发布路径、GitHub Actions 自动同步和服务器目录说明，请阅读 [`article-publishing-guide.md`](./article-publishing-guide.md)。

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

首次使用写作后台时，先创建本地环境配置：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，至少替换以下两个值：

```dotenv
WRITE_PASSWORD=你的本地写作密码
SESSION_SECRET=至少32个随机字符
```

`CONTENT_ROOT` 和 `REPO_ROOT` 通常不需要设置，默认指向当前仓库。`.env.local` 已被 Git 忽略，不要把真实密码提交到仓库。

写作后台保存文章时会创建本地 Git 提交，因此还需要配置 Git 作者信息：

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

然后启动开发服务器：

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
- `/write`：写作后台（不会出现在博客导航中）

访问 `/write` 后输入 `WRITE_PASSWORD`。后台支持文章搜索、新建、编辑、Markdown 预览、草稿/发布、slug 重命名和删除。每次保存只提交相关的 `content/posts/*.md`，不会执行 `git push`，也不会把其他已暂存或未暂存文件带进文章提交。

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
author: Vic
date: 2026-09-24
category: 随笔
excerpt: 一句话介绍文章内容。
published: true
---

这里开始写 Markdown 正文。
```

- `title`、`author`、`date`、`excerpt`、`published` 必填。
- `date` 使用有效的 `YYYY-MM-DD` 日期。
- `category` 可选。
- `published: false` 表示草稿，不会出现在首页、归档和 RSS 中。

## 6. 运行检查

```bash
npm test
npx tsc --noEmit --incremental false
```

测试主要覆盖 Markdown 内容校验、排序、草稿过滤和 RSS 生成。

## 7. 构建并启动生产模式

普通本地构建：

```bash
npm run build
```

构建完成后启动 Next.js Node 服务：

```bash
npm start
```

`npm start` 默认监听 3000 端口。生产模式也需要提供 `WRITE_PASSWORD` 和 `SESSION_SECRET`，否则公开博客可以访问，但写作后台无法登录。

构建线上版本前，必须设置真实站点地址，否则 RSS 会使用本地占位域名：

```bash
NEXT_PUBLIC_SITE_URL=https://blog.your-domain.com npm run build
```

该值必须是完整的 HTTP(S) origin，不能包含路径、查询参数、片段或账号密码。项目现在是长期运行的 Node 应用，不再生成 `out/` 静态目录。

当前阶段只完成本地运行：没有 Docker/Nginx 配置，不会连接 `123.56.122.63`，也不会推送远程仓库。

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

开发服务器会选择空闲端口。生产模式可用 `npm start -- -p 3001` 指定其他端口。

### 保存文章时 Git 报错

确认当前目录是 Git 仓库，并已配置 `user.name` 和 `user.email`。保存失败时后台会恢复文章文件；仓库里其他 staged/unstaged 改动不会被清理。
