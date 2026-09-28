# Vic Log `/write` 文章管理后台设计

## 目标

在现有 Vic Log Next.js 项目中加入一个不出现在公开导航里的 `/write` 管理后台，让站点作者可以在浏览器中登录、查看、新建、编辑、预览、发布、转为草稿和删除 Markdown 文章。每次成功变更都只针对相关的文章文件创建一次本地 Git 提交。

本阶段只完成本地可用版本，不配置 Docker、Nginx、服务器部署、远程仓库推送或图片上传。

## 已确认的范围

- 管理对象仅为 `content/posts/*.md`，不在首版中编辑 `content/site.md`。
- 后台路径固定为 `/write`，不在公开站点导航、站点地图或 RSS 中暴露。
- 使用一个共享密码登录；登录后使用带签名、限时的 HttpOnly Cookie 维持会话。
- 支持文章列表、搜索、草稿/已发布筛选、新建、编辑、Markdown 预览、状态切换和删除。
- 文章继续使用当前 frontmatter：`title`、`date`、可选 `category`、`excerpt`、`published`，文件名即 slug。
- 每次创建、修改、重命名或删除都生成本地 Git 提交；不执行 `git push`。

## 架构

### Next.js 运行模式

项目从纯静态导出改为长期运行的 Next.js Node 应用：移除 `output: "export"`，将 `npm start` 改为 `next start`。公开博客页面仍然由 App Router 渲染，但文章详情页不再依赖构建时生成的 slug 列表。文章写入完成后，服务端主动使首页、归档页、文章详情和 RSS 的缓存失效，确保本地浏览器刷新后立即看到最新内容。

未来 Docker 部署可以在此架构上增加 `output: "standalone"` 和宿主机仓库挂载，但本阶段不加入部署文件。

### 模块边界

- `lib/write/auth.ts`：密码校验、会话签名与验证，不读取或写入文章。
- `lib/write/posts.ts`：读取全部文章（含草稿）、校验输入、序列化 Markdown、原子写入和冲突检测，不处理 HTTP。
- `lib/write/git.ts`：以参数数组调用 Git，只提交指定文章路径，不使用 shell 字符串拼接。
- `lib/write/service.ts`：串行协调文件写入、Git 提交、失败回滚和缓存刷新。
- `app/api/write/**`：认证、Origin 校验、请求解析及错误到 HTTP 状态的映射。
- `app/write/**`：登录页、文章列表和编辑器界面。

公开内容加载器保持面向已发布文章；后台使用独立读取接口，避免草稿意外进入首页、归档或 RSS。

## 配置与认证

本地 `.env.local` 使用：

```dotenv
WRITE_PASSWORD=请替换为你的密码
SESSION_SECRET=请替换为至少32个随机字符
CONTENT_ROOT=/Users/mengweifei/Desktop/code/github/vicLog/content
REPO_ROOT=/Users/mengweifei/Desktop/code/github/vicLog
```

同时提供不含真实秘密的 `.env.example`。`CONTENT_ROOT` 和 `REPO_ROOT` 可省略，默认分别为当前项目下的 `content` 和项目根目录。

登录接口用定时安全比较校验密码。成功后写入一个 HMAC-SHA256 签名、有效期 8 小时的会话 Cookie；Cookie 设置 `HttpOnly`、`SameSite=Strict`、`Path=/`，生产环境增加 `Secure`。服务端日志不记录密码、Cookie 或 Session Secret。

所有 `/write` 页面和 `/api/write` 文章接口都在服务端验证会话。登录接口使用进程内的轻量限速：同一来源连续失败后短暂拒绝请求。所有写接口还检查 `Origin` 是否与请求 Host 一致；缺失或不一致时拒绝请求。由于当前阶段只面向单进程本地运行，限速状态无需持久化。

## 文章数据与文件安全

### 编辑器数据

后台向浏览器返回结构化对象，不返回绝对文件路径：

```ts
interface EditablePost {
  slug: string;
  title: string;
  date: string;
  category: string;
  excerpt: string;
  published: boolean;
  body: string;
  version: string;
}
```

`version` 是完整原始文件字节的 SHA-256。更新、重命名和删除必须携带当前版本；若文件已被其他进程或手工编辑，接口返回 `409 Conflict`，不覆盖磁盘内容。

### 校验规则

- slug 只允许小写 ASCII kebab-case：`^[a-z0-9]+(?:-[a-z0-9]+)*$`。
- slug 最长 100 个字符，且创建或重命名后不得与现有文件冲突。
- 标题和摘要去除首尾空白后不能为空；日期必须是真实的 `YYYY-MM-DD` 日历日期。
- 分类可为空；正文允许为空，以便保存初始草稿。
- 所有目标路径通过可信根目录加上经过校验的 slug 构造，禁止客户端传入任意路径或扩展名。
- 序列化统一生成有效 YAML frontmatter，并以单个换行结束文件。

## 操作流程

### 读取与预览

`GET /api/write/posts` 返回包含草稿的摘要列表，按日期降序排列。`GET /api/write/posts/[slug]` 返回完整编辑对象。Markdown 预览直接复用公开文章的 `MarkdownContent` 渲染组件，使编辑预览和最终文章表现一致；预览只渲染当前浏览器中的内容，不先写入磁盘。

### 创建和保存

创建使用 `POST /api/write/posts`，更新或重命名使用 `PUT /api/write/posts/[slug]`。服务层以进程内互斥队列串行执行变更：

1. 验证会话、Origin、请求字段和版本。
2. 读取并保存目标文件变更前的精确字节。
3. 写入同目录临时文件并原子重命名到目标路径；重命名时同时处理旧路径。
4. 重新读取并验证生成的 Markdown。
5. 仅对目标路径创建 Git 提交。
6. 使相关公开路由缓存失效并返回新的 `version`。

提交消息分别为 `content: create <slug>`、`content: update <slug>`、`content: rename <old> to <new>` 和 `content: delete <slug>`。

Git 必须通过 `spawn`/`execFile` 参数数组执行。提交必须显式限定旧、新目标路径，不能使用 `git add .`、`git commit -a` 或其他会包含无关改动的命令。实现需要在存在无关 staged 和 unstaged 变更的仓库中验证这一行为。若仓库没有可用的 Git 作者信息，保存失败并显示可操作的错误提示。

### 删除

删除使用 `DELETE /api/write/posts/[slug]`，必须携带版本并在界面中二次确认。文件删除会进入一次路径限定的 Git 提交，因此仍可从 Git 历史恢复。

### 失败与回滚

文件解析或字段错误返回 `400`，未登录返回 `401`，Origin 不合法返回 `403`，目标不存在返回 `404`，版本或 slug 冲突返回 `409`。服务端异常和 Git 错误返回 `500`，界面展示简洁、可操作的信息。

只要 Git 提交未成功，服务层就把本次涉及的文章文件恢复为操作前的精确状态，并只清理本次目标路径可能造成的索引变化；任何无关的 staged/unstaged 文件都必须保持不变。如果回滚本身失败，接口返回包含目标 slug 的明确错误，但不泄露秘密。

## 页面设计

### `/write/login`

简洁的密码输入页，沿用博客的纸张色、深色文字和砖红色强调色。提交成功返回原先请求的 `/write` 页面；失败时显示错误，密码字段清空。

### `/write`

桌面端采用已确认的管理台布局：左侧文章列表与搜索/状态筛选，右侧编辑区域。编辑区域包含 slug、标题、日期、分类、摘要、发布状态和正文；正文区域可在“编辑”“预览”之间切换，宽屏可以并排显示。新建文章使用 `/write/new`，已有文章使用 `/write/[slug]`。

移动端改为单列：先显示文章列表，进入编辑页后只显示编辑器。保存期间禁用重复提交；保存成功显示本地 Git 提交成功状态。存在未保存改动时，站内跳转和关闭页面前提示用户。删除按钮与保存按钮视觉分离，并要求二次确认。

后台页面设置 `robots: noindex, nofollow`。隐藏路径只减少偶然发现，不作为安全机制；密码会话才是访问控制。

## API

- `POST /api/write/login`：登录并设置会话 Cookie。
- `POST /api/write/logout`：清除会话 Cookie。
- `GET /api/write/posts`：列出全部文章摘要。
- `POST /api/write/posts`：创建文章并提交 Git。
- `GET /api/write/posts/[slug]`：读取一篇文章。
- `PUT /api/write/posts/[slug]`：保存或重命名文章并提交 Git。
- `DELETE /api/write/posts/[slug]`：删除文章并提交 Git。

所有响应使用统一 JSON 形状：成功时 `{ data: ... }`，失败时 `{ error: { code, message } }`。

## 测试策略

测试保持与项目规模相称，重点覆盖会造成内容丢失或误提交的边界：

- 单元测试：slug/日期/字段校验、Markdown 序列化与解析、会话签名/过期、Origin 校验。
- 临时仓库集成测试：创建、更新、重命名、删除、版本冲突、Git 失败回滚，以及无关 staged/unstaged 文件不会进入文章提交。
- 轻量组件测试：登录错误、编辑/预览切换、未保存提示和删除确认。
- 最终验证：`npm test`、`npm run build`，再用本地开发服务器手工跑通登录、新建草稿、发布、修改和删除流程。

## 验收标准

1. 未登录访问 `/write` 或文章 API 时无法读取和修改草稿。
2. 正确密码可以建立 8 小时会话，登出后会话失效。
3. 可以从浏览器完成文章列表、搜索、新建、编辑、预览、草稿/发布、重命名和删除。
4. 发布文章保存后，首页、归档、详情和 RSS 刷新即可看到变化；草稿不会出现在公开页面或 RSS。
5. 并发或手工文件修改会触发版本冲突，不会静默覆盖。
6. 每次内容变更生成一次仅包含目标文章路径的本地 Git 提交，不会混入仓库内其他改动。
7. Git 或校验失败时文章文件回到操作前状态。
8. 桌面与移动宽度下均可完成核心操作，并具有清晰的加载、错误和成功反馈。

## 明确不做

- 本阶段不部署到 `123.56.122.63`，不改服务器 Nginx，也不提供 Docker 文件。
- 不推送远程 Git 仓库。
- 不支持多用户、角色权限、OAuth、评论管理、站点资料编辑、图片/附件上传或可视化 Git 历史。
- 不依赖“路径隐秘”提供安全性。
