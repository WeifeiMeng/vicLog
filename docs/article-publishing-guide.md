# Vic Log 文章发布指南

本文说明以后如何新增、修改和发布 Vic Log 文章，以及本地、GitHub、服务器和公网 URL 之间的对应关系。

## 1. 路径关系

一篇文章在各层的位置如下：

| 位置 | 路径 |
| --- | --- |
| 本地仓库 | `/Users/mengweifei/Desktop/code/github/vicLog/content/posts/<slug>.md` |
| GitHub 仓库 | `content/posts/<slug>.md` |
| 服务器宿主机 | `/opt/viclog/content/posts/<slug>.md` |
| Docker 容器 | `/workspace/content/posts/<slug>.md` |
| 公网文章地址 | `https://vicmeng.icu/posts/<slug>/` |

例如文件：

```text
content/posts/cookie-samesite-sop-cors.md
```

对应地址：

```text
https://vicmeng.icu/posts/cookie-samesite-sop-cors/
```

`slug` 就是 Markdown 文件名去掉 `.md` 的部分。它只能包含小写英文字母、数字和短横线：

```text
正确：browser-cookie-guide.md
错误：Browser_Cookie_Guide.md
错误：浏览器跨域.md
```

## 2. 推荐发布方式：本地写作后推送 GitHub

GitHub 是线上内容的主要来源。推荐始终从本地仓库创建或修改文章，再推送到 `main`。

进入仓库并同步最新代码：

```bash
cd /Users/mengweifei/Desktop/code/github/vicLog
git pull --rebase origin main
```

在 `content/posts/` 下创建文章：

```text
content/posts/my-new-post.md
```

使用下面的模板：

```markdown
---
title: 文章标题
author: Vic
date: 2026-10-14
category: 技术
excerpt: 用一句话介绍文章内容，首页和 RSS 会显示它。
published: true
---

这里开始写 Markdown 正文。
```

Frontmatter 字段说明：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 文章标题 |
| `author` | 是 | 常用值为 `Vic` 或 `Vic Agent`，也可以填写其他作者 |
| `date` | 是 | 使用有效的 `YYYY-MM-DD` 日期 |
| `category` | 否 | 例如 `技术`、`工程`、`随笔` |
| `excerpt` | 是 | 首页与 RSS 使用的摘要 |
| `published` | 是 | `true` 表示发布，`false` 表示草稿 |

正文使用标准 Markdown，可以包含标题、列表、表格、引用和代码块。

## 3. 发布前检查

先运行内容和回归测试：

```bash
npm test
```

需要确认完整生产构建时运行：

```bash
NEXT_PUBLIC_SITE_URL=https://vicmeng.icu npm run build
```

如果构建导致 `next-env.d.ts` 出现自动生成的路径变化，不要把无关变化提交进去；先检查 `git diff`。

查看本次准备提交的文件：

```bash
git status --short
git diff --check
```

## 4. 提交并发布

只暂存本次文章：

```bash
git add content/posts/my-new-post.md
git commit -m "content: add my new post"
git push origin main
```

推送后，[`.github/workflows/deploy-content.yml`](../.github/workflows/deploy-content.yml) 会自动运行：

```text
push main
    ↓
检测 content/** 发生变化
    ↓
GitHub Actions 使用受限 SSH 密钥连接服务器
    ↓
服务器 /opt/viclog 执行 git fetch + rebase
    ↓
健康检查 http://127.0.0.1:3001/
    ↓
公网博客直接读取更新后的 Markdown
```

这条流程只同步内容：

- 不构建 Docker 镜像；
- 不重启 Docker 容器；
- 不影响股票服务；
- 服务器存在未提交文件或 Git 冲突时会停止，不会强制覆盖。

可以查看最近一次运行：

```bash
gh run list --workflow deploy-content.yml --limit 1
```

## 5. 发布后验证

先检查文章页面：

```bash
curl -I https://vicmeng.icu/posts/my-new-post/
```

应返回 `HTTP/2 200`。

然后在浏览器确认：

- 首页出现文章卡片：`https://vicmeng.icu/`
- 文章正文正常：`https://vicmeng.icu/posts/my-new-post/`
- 归档包含文章：`https://vicmeng.icu/archive/`
- RSS 包含文章：`https://vicmeng.icu/rss.xml`

如果使用 `published: false`，文章不会出现在这些公开入口中，这是正常的草稿行为。

## 6. 修改已有文章

直接修改对应 Markdown 文件，然后执行同样的检查、提交和推送流程：

```bash
git add content/posts/existing-post.md
git commit -m "content: update existing post"
git push origin main
```

不要修改文件名来修正标题。标题改 Frontmatter 中的 `title`；只有确实要更换公网 URL 时才重命名文件。

## 7. 使用 `/write` 写作后台时要注意什么？

线上后台地址：

```text
https://vicmeng.icu/write/
```

后台保存文章时会：

1. 修改服务器 `/opt/viclog/content/posts/` 中的 Markdown；
2. 在服务器 Git 仓库创建本地提交；
3. 立即反映到博客页面。

但是后台当前**不会把提交推送回 GitHub**。因此：

- 推荐把“本地写作 → GitHub → 自动同步服务器”作为正式发布主路径；
- `/write` 适合临时修改或应急发布，但不能把服务器当成唯一备份；
- 使用 `/write` 后，应尽快把服务器产生的提交同步回 GitHub，再继续从本地发布；
- 不要在 GitHub 和 `/write` 中同时修改同一篇文章，否则自动同步可能因 rebase 冲突而停止。

## 8. 图片发布限制

Markdown 中的站内图片使用根路径：

```markdown
![说明文字](/img/example.png)
```

源文件应放在：

```text
public/img/example.png
```

当前自动工作流只同步 `content/**`，而新的 `public/` 静态资源需要进入运行镜像。因此：

- 只修改 Markdown：直接推送即可，不需要构建镜像；
- 引用镜像中已经存在的图片：直接推送即可；
- 新增图片文件：需要额外执行一次 Docker 镜像构建与部署。

不要把本地磁盘路径写进 Markdown，也不要使用 `content/img/...`。页面能访问的站内图片必须来自 `public/`。

## 9. 常见故障

### GitHub Actions 没有启动

确认提交是否真的修改了 `content/**`，以及提交是否推送到了 `main`。仅修改 `docs/`、代码或 Dockerfile 不会触发内容同步。

### GitHub Actions 提示服务器有未提交改动

自动化会主动停止以保护服务器文件。先登录服务器检查：

```bash
runuser -u viclog -- git -C /opt/viclog status --short --branch
```

不要使用 `git reset --hard` 清理未知改动。先确认文件属于谁、是否需要提交或备份。

### 文章返回 404

依次检查：

1. 文件名是否为小写 kebab-case；
2. Frontmatter 是否完整；
3. `published` 是否为 `true`；
4. GitHub Actions 是否成功；
5. URL 是否带正确的 slug 和结尾 `/`。

### 页面仍显示旧内容

确认服务器已经同步到远端提交，并直接刷新文章页面。当前公开博客根据 Markdown 文件的修改时间和大小自动刷新内容缓存，不需要重启容器。

## 10. 最短发布清单

```text
[ ] 在 content/posts/<slug>.md 写文章
[ ] 补齐 title / author / date / excerpt / published
[ ] npm test
[ ] git diff --check
[ ] git add 指定文章文件
[ ] git commit
[ ] git push origin main
[ ] 确认 GitHub Actions 成功
[ ] 打开公网文章 URL 验证
```
