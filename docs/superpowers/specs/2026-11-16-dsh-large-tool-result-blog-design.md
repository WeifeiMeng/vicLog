# DSH Large Tool Result Blog Design

## Goal

Publish a Chinese engineering article that explains how Deepseek Harness (DSH) handles a tool result that is too large for the model context window. The article should preserve the supplied implementation facts while reading like a blog post rather than an internal specification.

## Publication Metadata

- Title: `DSH 如何处理超大工具结果：从 Spill 到上下文溢出恢复`
- Slug: `dsh-large-tool-result-handling`
- Author: `Vic Agent`
- Date: `2026-11-16`
- Category: `技术`
- Published: `true`

The excerpt will summarize the layered path from spill storage and bounded previews through tool-result pruning, history compaction, and provider overflow recovery.

## Editorial Approach

Use an engineering walkthrough organized around the lifecycle of one oversized tool result. This matches the existing DSH articles, which open with the motivating problem, show the full path, then explain implementation details and invariants.

The article will:

1. Open with the failure mode: a tool can return more text than the model can accept.
2. Introduce the governing principle: preserve the full result outside the prompt and expose only bounded, recoverable representations to the model.
3. Show the complete sequence before examining each layer.
4. Explain spill, session recording, pre-step pressure checks, tool-result pruning, history compaction, and provider-error recovery in execution order.
5. Use the 16k-window and 20k-token example to connect configuration values to runtime behavior.
6. Close with current limitations, invariants, and relevant source files.

## Editing Boundaries

The supplied technical claims are the source of truth for this article. Editing may improve the title hierarchy, introduction, transitions, repetition, examples, and conclusion, but must not change:

- configuration values and thresholds;
- spill eligibility rules;
- event and surface replacement semantics;
- retry authorization conditions;
- stated limitations;
- implementation file references.

Relative links to DSH source files will be rendered as inline code paths because those files are not part of the Vic Log repository and relative Markdown links would resolve against the blog domain.

## Article Structure

1. Why large tool results need a separate handling path
2. The full layered flow
3. Layer one: spill the complete text and return a bounded preview
4. Layer two: append the bounded result to the session log and surface
5. Layer three: measure pressure before the next model step
6. Layer four: prune oversized tool-result text without rewriting history
7. Layer five: compact older history only when pruning is insufficient
8. How the next step and next turn see the result
9. Provider context-window overflow recovery
10. A 16k-window, 20k-token worked example
11. Current limitations and operational consequences
12. Design invariants and source index

The existing Mermaid sequence diagram, YAML and TypeScript examples, and text diagrams will be retained where they materially clarify the behavior.

## Verification and Release

Before publication:

1. Run content validation and the repository test suite.
2. Run a production build with `NEXT_PUBLIC_SITE_URL=https://vicmeng.icu`.
3. Check the diff and whitespace errors.
4. Commit only the design and article changes, then push `main` to `origin`.
5. Wait for the `Deploy blog content` GitHub Actions workflow to complete.
6. Verify the public article URL, homepage, archive, and RSS feed.

The expected article URL is:

`https://vicmeng.icu/posts/dsh-large-tool-result-handling/`

The content deployment updates `/opt/viclog` through the existing restricted SSH workflow. It does not rebuild or restart the Docker container.
