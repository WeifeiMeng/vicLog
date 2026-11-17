# 波浪理论博客实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布一篇按宏观到微观组织的波浪理论词典式博客，并用六张标准 SVG 图解释浪级、推动浪、调整浪、铁律与自上而下数浪流程。

**Architecture:** 文章保持为一个独立 Markdown 内容文件，六张图各自作为 `public/img/elliott-wave/` 下的无脚本 SVG 资源。实现不修改渲染器或应用代码；验证依赖现有内容检查、测试和 Next.js 生产构建，再通过本地浏览器检查桌面与窄屏显示。

**Tech Stack:** Markdown frontmatter、SVG 1.1、React Markdown、Next.js 16、Vitest、现有内容校验脚本。

---

## 文件结构

- `content/posts/elliott-wave-theory-guide.md`：文章元数据、理论词典正文、图片引用、风险提示。
- `public/img/elliott-wave/wave-degrees.svg`：分形浪级示意。
- `public/img/elliott-wave/motive-and-correction.svg`：标准五浪与 A-B-C 调整。
- `public/img/elliott-wave/three-rules.svg`：三条铁律的正反例。
- `public/img/elliott-wave/motive-variations.svg`：延伸浪、失败浪、对角线。
- `public/img/elliott-wave/corrective-patterns.svg`：四类调整浪。
- `public/img/elliott-wave/top-down-counting.svg`：月线、周线、日线定位流程。

每个 SVG 只负责一个理论主题，共享相同配色和画布规范，但不引入公共运行时代码或生成器，避免为六张静态教学图增加构建复杂度。

### Task 1: 绘制六张标准浪型图

**Files:**
- Create: `public/img/elliott-wave/wave-degrees.svg`
- Create: `public/img/elliott-wave/motive-and-correction.svg`
- Create: `public/img/elliott-wave/three-rules.svg`
- Create: `public/img/elliott-wave/motive-variations.svg`
- Create: `public/img/elliott-wave/corrective-patterns.svg`
- Create: `public/img/elliott-wave/top-down-counting.svg`

- [ ] **Step 1: 建立统一 SVG 画布规范**

六张图都使用 `viewBox="0 0 1200 680"`、暖白背景 `#fbfaf6`、网格 `#dedbd2`、推动浪 `#176b87`、调整浪 `#c75038`、正文 `#17252b`、边界与辅助线 `#8a8178`。每张图包含中文 `<title>` 和 `<desc>`，线条使用圆角连接，正文最小字号不低于 20 px。

- [ ] **Step 2: 绘制浪级与标准循环图**

`wave-degrees.svg` 用三层嵌套折线标出大浪 `(1)—(5)`、中浪 `1—5` 和小浪 `i—v`，并以括号说明“结构相似、尺度不同”。

`motive-and-correction.svg` 画出蓝色 `0—1—2—3—4—5` 和红色 `5—A—B—C`，在图下标注 `推动：5 浪`、`调整：3 浪`，并用浅色区域区分两个阶段。

- [ ] **Step 3: 绘制铁律正反例**

`three-rules.svg` 分成三个横向面板。每个面板左侧是带绿色勾的有效计数，右侧是带红色叉的无效计数：第 2 浪越过起点、第 3 浪成为最短、第 4 浪进入第 1 浪区域。第三条旁注明“对角线结构例外”。

- [ ] **Step 4: 绘制推动浪变体**

`motive-variations.svg` 使用四宫格：第 3 浪延伸、第 5 浪延伸、第五浪失败、终结对角线。延伸浪在对应主浪内部画五个较小子浪；失败浪的 5 低于 3；对角线用两条收敛虚线包络并允许 1、4 区域重叠。

- [ ] **Step 5: 绘制调整浪词典**

`corrective-patterns.svg` 使用四宫格：锯齿 `5-3-5`、平台 `3-3-5`、三角形 `3-3-3-3-3`、双重三浪 `W-X-Y`。每格只表现结构特征和浪标，不伪造行情 K 线。

- [ ] **Step 6: 绘制自上而下定位图**

`top-down-counting.svg` 以三个上下排列的窗口表示月线、周线、日线：月线圈出长期极端点和趋势阶段，周线标记候选 `1—5 / A—B—C`，日线放大当前子浪。右侧以箭头列出“定浪级 → 列候选 → 铁律过滤 → 写失效位”。

- [ ] **Step 7: 解析并检查六张 SVG**

Run:

```bash
python3 -c 'from pathlib import Path; import xml.etree.ElementTree as ET; files=sorted(Path("public/img/elliott-wave").glob("*.svg")); assert len(files)==6; [ET.parse(path) for path in files]; print("6 SVG files parsed")'
```

Expected: `6 SVG files parsed`

### Task 2: 编写理论词典式正文

**Files:**
- Create: `content/posts/elliott-wave-theory-guide.md`

- [ ] **Step 1: 写入发布元数据和导语**

使用设计文档确定的标题、slug、作者、日期、分类和 `published: true`。导语先说明波浪理论是管理候选场景的概率框架，再解释文章采用“先定浪级、再看结构、最后用规则排除”的顺序。

- [ ] **Step 2: 完成宏观部分**

依次写“适用边界”“浪级词典”“初步大浪型”三节。必须说明宽基指数适用条件、上证指数的优势与局限、月线/周线/日线职责、主选与备选计数、失效位，以及浪级不能只按固定时间长度机械决定。

- [ ] **Step 3: 完成推动浪与铁律部分**

逐浪解释第 1 至第 5 浪的结构和常见心理，引用 `motive-and-correction.svg` 与 `motive-variations.svg`。随后单列三条铁律并引用 `three-rules.svg`。明确：第 5 浪可以创新高但动能可能背离；第 3 浪只要求不是最短，不要求一定最长；对角线允许第 1、4 浪区域重叠。

- [ ] **Step 4: 完成调整浪词典**

引用 `corrective-patterns.svg`，用表格列出锯齿、普通/扩散/运行平台、三角形、双重/三重三浪的内部结构、常见位置和识别重点。不得写成“所有调整都是简单三浪”，也不得笼统禁止 B 浪越过前高。

- [ ] **Step 5: 完成指引、验证与工作流**

把交替、通道和斐波那契放在“指引”而不是“铁律”中；将量能、MACD/RSI 背离、均线和时间关系写为验证证据。引用 `top-down-counting.svg`，给出一份按顺序执行的数浪检查表和常见误区。

- [ ] **Step 6: 完成结论与风险提示**

结论回到“计数不是答案，失效条件才使计数可用”。声明本文仅作理论学习，不构成投资建议；不对当前市场给出浪型或点位判断。

- [ ] **Step 7: 运行内容校验**

Run:

```bash
npm run validate:content
```

Expected: command exits `0` and the new post has no frontmatter, slug, image-reference, or Markdown validation error.

### Task 3: 全量验证与视觉验收

**Files:**
- Verify: `content/posts/elliott-wave-theory-guide.md`
- Verify: `public/img/elliott-wave/*.svg`

- [ ] **Step 1: 运行仓库测试**

Run:

```bash
npm test
```

Expected: all Vitest files and tests pass.

- [ ] **Step 2: 运行生产构建**

Run:

```bash
NEXT_PUBLIC_SITE_URL=https://vicmeng.icu npm run build
```

Expected: Next.js build exits `0`, the post route is generated, and no missing image warning appears.

- [ ] **Step 3: 检查构建副作用与差异**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Expected: only the article and six SVG files are uncommitted; `git diff --check` prints nothing. If `next-env.d.ts` contains build-generated noise, restore only that file.

- [ ] **Step 4: 启动本地站点并检查文章页**

Run:

```bash
npm run dev
```

Open: `http://localhost:3000/posts/elliott-wave-theory-guide/`

Expected: title, metadata, tables and all six SVGs render; desktop width has no unexpected horizontal overflow; a narrow viewport keeps labels legible and does not crop diagrams.

- [ ] **Step 5: 检查内容完整性**

确认文章中出现六个站内图片路径、三条铁律、至少一个主选/备选计数说明、一个失效位说明、调整浪结构表和非投资建议声明。确认没有当前上证指数点位、实时浪型结论或确定性收益表达。

### Task 4: 提交实现

**Files:**
- Add: `content/posts/elliott-wave-theory-guide.md`
- Add: `public/img/elliott-wave/*.svg`

- [ ] **Step 1: 暂存且仅暂存实现文件**

Run:

```bash
git add content/posts/elliott-wave-theory-guide.md public/img/elliott-wave/*.svg
git status --short
```

Expected: one article and six SVG files are staged; no unrelated file is staged.

- [ ] **Step 2: 创建提交**

Run:

```bash
git commit -m "content: add Elliott Wave theory guide"
```

Expected: commit succeeds and reports seven created files.

- [ ] **Step 3: 复核最终状态**

Run:

```bash
git status --short --branch
git log -3 --oneline
```

Expected: worktree is clean; latest commit is the article implementation and the preceding commits include the plan and design.
