# DSH Large Tool Result Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish and verify a blog-style Chinese engineering walkthrough of DSH's oversized tool-result handling path.

**Architecture:** Add one Markdown post to the existing content system and leave application code, static assets, and deployment infrastructure unchanged. Preserve the supplied implementation facts while restructuring the prose around the lifecycle of one oversized result; publishing continues through the existing content-only GitHub Actions workflow.

**Tech Stack:** Markdown with YAML frontmatter, Mermaid, Next.js content validation and build, Vitest, GitHub Actions, Docker-hosted Vic Log runtime.

---

## File Map

- Create `content/posts/dsh-large-tool-result-handling.md`: the complete public article, including frontmatter, diagrams, examples, limitations, invariants, and source index.
- Retain `docs/superpowers/specs/2026-11-16-dsh-large-tool-result-blog-design.md`: the approved editorial and release contract.
- Create and retain `docs/superpowers/plans/2026-11-16-dsh-large-tool-result-blog.md`: this execution checklist.
- Do not modify application code, tests, workflow files, images, or Docker configuration.

### Task 1: Write the article

**Files:**
- Create: `content/posts/dsh-large-tool-result-handling.md`
- Reference: `/Users/mengweifei/.codex/attachments/f290c91e-cde1-47bc-b2c0-936cb08d19fe/已粘贴的文本.txt`
- Reference: `content/posts/dsh-system-prompt-assembly.md`
- Reference: `content/posts/deepseek-harness-context-compress.md`

- [ ] **Step 1: Add valid publication metadata**

Use exactly this frontmatter:

```yaml
---
title: "DSH 如何处理超大工具结果：从 Spill 到上下文溢出恢复"
author: Vic Agent
date: 2026-11-16
category: 技术
excerpt: 当一次工具调用大到无法直接放进模型上下文时，DSH 如何通过 spill、有界预览、tool-result pruning、历史压缩与 provider 溢出恢复，让完整结果仍然可追溯、下一步请求仍然可执行。
published: true
---
```

- [ ] **Step 2: Rewrite the opening as a blog introduction**

Open with the practical failure mode and state the central design principle: full output belongs in durable external storage, while the model-visible session surface contains a bounded representation plus a retrieval path. Preview the five layers in execution order without presenting the article as an internal requirements document.

- [ ] **Step 3: Preserve the complete sequence diagram**

Keep the supplied Mermaid participants and branches for spill, pre-step pruning/compaction, `deriveMessages()`, provider overflow recovery, and retry. Introduce the diagram with a short reading guide and explain afterward that spill and compaction solve different stages of the problem.

- [ ] **Step 4: Explain the five layers in runtime order**

Include all supplied facts under these sections:

1. Spill eligibility and the default `maxInlineBytes: 50000` configuration.
2. Session `tool/result` append behavior and the distinction between spill storage, append-only log, and current surface.
3. Pre-step pressure measurement with `thresholdRatio: 0.8`, `retainRatio: 0.16`, `compactionRetries: 1`, `maxOverflowRetries: 1`, and the 16k-to-12.8k calculation.
4. Tool-result pruning with `thresholdChars: 8192`, `headChars: 4096`, `tailChars: 1024`, plus appended replacement semantics.
5. Checkpoint compaction only after remeasurement remains above threshold, preserving indivisible assistant tool-call/result pairs.

- [ ] **Step 5: Explain continued access and recovery**

Describe how `Session.deriveMessages()` projects only the current surface, how `read(path, offset, limit)` and `grep(pattern, path)` create new tool interactions rather than expanding the original result, and how normalized `CONTEXT_WINDOW_EXCEEDED` triggers forced recovery. Preserve every stated no-retry condition.

- [ ] **Step 6: Retain the worked example, limitations, and invariants**

Keep the 16k-window/20k-token example as the article's concrete payoff. Preserve all six limitations and all eight invariants, adding operational explanations where useful but introducing no new implementation claims.

- [ ] **Step 7: Render source references safely**

List the supplied DSH repository paths as inline code rather than Vic Log-relative links. End with a concise conclusion connecting durable evidence, bounded context, and append-only replayability.

- [ ] **Step 8: Inspect the article diff**

Run:

```bash
git diff -- content/posts/dsh-large-tool-result-handling.md
```

Expected: one new published article with the approved metadata and all required sections; no unrelated file changes.

### Task 2: Validate the content and production rendering

**Files:**
- Test: `content/posts/dsh-large-tool-result-handling.md`

- [ ] **Step 1: Run focused content validation**

Run:

```bash
npm run validate:content
```

Expected: exit code 0 and no invalid frontmatter, slug, date, or Markdown errors.

- [ ] **Step 2: Run the repository test suite**

Run:

```bash
npm test
```

Expected: all Vitest test files and tests pass.

- [ ] **Step 3: Run the production build with the public origin**

Run:

```bash
NEXT_PUBLIC_SITE_URL=https://vicmeng.icu npm run build
```

Expected: exit code 0; static generation includes `/posts/dsh-large-tool-result-handling/`, `/archive/`, and `/rss.xml`.

- [ ] **Step 4: Review generated side effects and whitespace**

Run:

```bash
git status --short
git diff --check
```

Expected: only the planned article and plan document are uncommitted, and `git diff --check` prints nothing. If the build changes `next-env.d.ts`, restore only that generated change after confirming it is unrelated.

### Task 3: Commit and push the publication

**Files:**
- Add: `content/posts/dsh-large-tool-result-handling.md`
- Add: `docs/superpowers/plans/2026-11-16-dsh-large-tool-result-blog.md`

- [ ] **Step 1: Stage only the planned files**

Run:

```bash
git add content/posts/dsh-large-tool-result-handling.md docs/superpowers/plans/2026-11-16-dsh-large-tool-result-blog.md
git diff --cached --stat
```

Expected: the article and implementation plan are staged; no application or unrelated user files are included.

- [ ] **Step 2: Commit the article**

Run:

```bash
git commit -m "content: publish DSH large tool result guide"
```

Expected: one new commit on `main` containing the article and plan.

- [ ] **Step 3: Push `main`**

Run:

```bash
git push origin main
```

Expected: `origin/main` advances to the new commit. Because the commit changes `content/**`, the `Deploy blog content` workflow starts automatically.

### Task 4: Wait for deployment and verify production

**Files:**
- Verify: `.github/workflows/deploy-content.yml`

- [ ] **Step 1: Locate the workflow run for the pushed commit**

Run:

```bash
gh run list --workflow deploy-content.yml --limit 3
```

Expected: a run for the publication commit appears with workflow name `Deploy blog content`.

- [ ] **Step 2: Wait for the workflow to finish**

Run:

```bash
gh run watch "$(gh run list --workflow deploy-content.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: the `sync-content` job completes successfully, including content validation and the restricted server sync command.

- [ ] **Step 3: Verify the public article and discovery surfaces**

Run:

```bash
curl -fsS https://vicmeng.icu/posts/dsh-large-tool-result-handling/
curl -fsS https://vicmeng.icu/
curl -fsS https://vicmeng.icu/archive/
curl -fsS https://vicmeng.icu/rss.xml
```

Expected: all four requests return successfully; the article response contains the title, and the homepage, archive, and RSS responses contain either the title or the slug.

- [ ] **Step 4: Confirm repository state**

Run:

```bash
git status --short --branch
git log -2 --oneline --decorate
```

Expected: the working tree is clean and local `main` matches `origin/main` at the publication commit.
