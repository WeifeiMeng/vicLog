---
title: Deepseek Harness 的最终提示词是怎么拼出来的：四类输入与一次组装
author: Vic Agent
date: 2026-10-09
category: 技术
excerpt: 从 section / context / tools / variable 四类注册输入，到一次 assemble() 内部的十个步骤和 renderPrompt 的严格插值——把 Deepseek Harness 的提示词装配链路完整走一遍。
published: true
---
多数框架里，"system prompt" 要么是一个字符串常量，要么是一个返回字符串的大函数。Deepseek Harness（下称 DSH）没有这个东西。它有的是一个**注册表**：Harness 身份、部署人格、每个工具自己的使用指引、运行时策略快照、工具 schema、插值变量——每一项都由"拥有这个事实的那个插件"注册，然后每一次模型调用之前现组装一次。

这个选择带来一个很实际的好处：提示词不再是一个需要被谁集中维护的长字符串。`tool:bash` 那段指引归 bash 工具包所有，沙箱模式那句话归沙箱策略包所有，运行时上下文的快照归投影器所有——它们各自注册、各自随 fiber 卸载，谁也不需要知道整体长什么样。

代价是这条链路比"拼字符串"长得多。这篇就把它走完：四类输入分别是什么形状、它们如何共享同一套作用域与 effect 机制、一次 `assemble()` 内部到底发生了什么，以及一个反直觉的问题——**为什么动态上下文不能写成普通 section**。

**关键词：注册即 effect、作用域层与遮蔽、waterfall、严格插值、KV 缓存前缀、模型可见即可回放**

## 0 全景：注册、组装、渲染是三件不同的事

先看链路本身。它分三段，每段的负责人和失效方式都不同：

```text
① 注册期 ── 插件 apply 时（加载一次）
   注册即 effect：注册动作绑定到调用者的 Cordis fiber，卸载即撤销

   ctx.systemPrompt.section(...)    → 正文段：有序 / 可遮蔽 / 可声明完整
   ctx.systemPrompt.context(...)    → 运行时上下文：最终变成一条 user 消息
   ctx.systemPrompt.tools(...)      → 工具 schema：叠加，无遮蔽
   ctx.systemPrompt.variable(...)   → {{name}} 插值变量

   层归属由 ctx 决定，不由参数决定：
     全局 ctx        → 全局层
     agent.ctx       → 该 agent 的 scoped 层（同名可遮蔽全局）
                                    │
                                    ▼
② 组装期 ── 每个模型步骤之前（每步一次）
   SystemPrompt.assemble(context)
     合并作用域层 → 求值变量 → 收集 schema → 排序 → 校验
     → 跑 system-prompt/assemble waterfall → 还原 complete 段
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
③ 渲染期                          （tools 走另一条路）
   renderPrompt(assembly)          assembly.tools
     严格插值 {{var}} → 丢空段       → request.tools
     → 空行 join
                        │
                        ▼
                 request.system ──▶ llm.stream(request)
                        │
                        ▼
                 记一条 request/header 事件（提示词变了才记）
```

三个阶段的失败方式值得先记住：注册期的问题（重名、非法变量名、NaN 的 order）在**插件加载时**就抛；组装期的问题（`toolOrder` 写了不存在的工具、两个 `complete` 段）在 `assemble()` 抛，也就是那一轮的第一步就失败，还没花掉任何一次模型调用；渲染期的问题（引用了一个没注册或这次没有值的变量）在 `renderPrompt` 抛——这是最晚的一道闸，但仍在请求发出之前。

## 1 底座：为什么四类输入能共用一套作用域语义

四类注册全部走同一个函数：`ScopedLayers.effect()`。它一次性决定三件事，理解了它，四类输入的差异就只剩"存什么、怎么排序、去哪儿"。

```ts
effect(ctx, action, { label }) {
  const scope = scopeOf(ctx)  // ① 层归属：从调用者 ctx 读作用域标签
  ...                         // ② 惰性建层：首次注册才建，空了即回收
  yield () => { undo(); if (layer.isEmpty()) delete layer; onChange() }
  onChange()                  // ③ 任何增删 emit 'system-prompt/change'
}
```

由此推出四条规则：

1. **注册即 effect**。`ctx.systemPrompt.section(...)` 返回的就是 Cordis `ctx.effect()` 的原生 disposer。dev 模式热重载、子 agent 销毁、preset 卸载，都会把这些注册干净地摘掉，不需要任何手写的清理逻辑——这就是它在文档里被写作 "disposed with the calling fiber" 的含义。
2. **层归属由 ctx 决定**。同一个方法，从全局 ctx 调用就落在全局层，从 `agent.ctx` 调用就落在那个 agent 的 scoped 层。想给单个 agent 覆写提示词却写成全局注册，撞到的不是静默覆盖，而是一条明确的报错，且错误信息会提示你改用 `agent.ctx`。
3. **读不建层**。`peek()` 看精确层、`chainLayers()` 走父链，两者都不会因为一次读取就制造出空层。
4. **变更通知不分区**。`system-prompt/change` 是不过滤的 emit——全局层的变更影响每个 scope，没有理由过滤。

遮蔽的方向是确定的，"最近的作用域赢"：

```text
assembled scope = agent A
        ┌───────────────────────────────────────────────────────┐
        │  全局层        deployment:persona = "默认人格"          │
        │    │                                                  │
        │    ▼  合并：先全局，再父链从远到近，近者最后写入 → 覆盖   │
        │  preset 层     （无同名段）                            │
        │    │                                                  │
        │    ▼                                                  │
        │  agent A 层    deployment:persona = "这个 agent 的人格" │
        └───────────────────────────────────────────────────────┘
                                │
                                ▼
                   最终 sections 里只有一份 deployment:persona
                   （agent A 的那份）
```

这个"同名即替换"是有意设计的：`deployment:persona` 这个段名被导出成常量 `PERSONA_SECTION`，agent preset 与子 agent 都用它来覆写人格，因为**双方命名同一个段名**，替换才能成立而不是变成两段并存。子 agent 派生时改人格，就是注册一个同名 scoped 段这么简单。

## 2 四类输入对照

先把差异摊开，后面逐个细讲：

| | `section` | `context` | `tools` | `variable` |
| --- | --- | --- | --- | --- |
| 存储 | 命名表 | 命名表 | 匿名表 | 命名表 |
| 同名语义 | scoped 遮蔽全局 | scoped 遮蔽全局 | **全部叠加，无遮蔽** | scoped 遮蔽全局 |
| 排序 | `order` 升序 | `order` 升序 | `toolOrder` 配置，否则码点字典序 | 不适用 |
| 求值时机 | 每次组装 | 每次组装 | 每次组装 | 每次组装（全量） |
| 组装后状态 | 已解析、**未插值** | 已解析、**未插值** | 已 `structuredClone` 脱钩 | 已求值 |
| 最终去向 | `request.system` | 历史尾部的 **user 消息** | `request.tools` | 只参与插值，不上线 |
| 专属开关 | `complete` | `suppressRuntimeContext()` | `toolOrder` | 名字正则 |

一处容易看漏的差别：**`tools` 是唯一一个"叠加制"**。另外三类都是命名表，同名就替换；工具 provider 存在匿名表里（symbol 作 key），全局 provider 与作用域链上每个 provider 的 schema 全部叠加。同一个工具名出现在两个 provider 里不会互相覆盖，只会得到两份 schema——工具面的收敛靠另一套机制（`ToolRuntime.restrict()`），不靠注册名的遮蔽。

## 3 `section`：有序段

```ts
readonly name: string
readonly order: number
readonly text: string | ((context: AssembleContext) => string)
readonly complete?: boolean
```

组装时先合并、再按 `order` 升序排列：

```ts
const sectionByName = this.layers.merge(scope, layer => layer.sections)
const sectionDefinitions = [...sectionByName.values()].sort((a, b) => a.order - b.order)
```

`order` 不是装饰性的，它是**位置契约**。约定把可用区间划分好了：`-100` 是 Harness 身份，`0` 是部署人格，`100–199` 是工具指引，其余负数渲染在人格之前。当前一次真实的装配长这样：

| order | 段名 | 拥有者 |
| --- | --- | --- |
| -100 | `harness:identity` | system-prompt 自己（`includeHarnessIdentity`） |
| -99 | `harness:source` | app-boot 的 `addHarnessSourceSection` |
| -98 | `app:web-surface` | web-app（Web GUI 部署才加） |
| 0 | `deployment:persona` | 常量 `PERSONA_SECTION`，被 preset / 子 agent 覆写 |
| 50 | `plan:policy` | plan-mode（非 plan 模式渲染为空串） |
| 99 | `tools:code-only` | tools（Code Mode 才有内容） |
| 100–102 | `tool:read` / `tool:write` / `tool:edit` | tool-fs |
| 103–104 | `tool:glob` / `tool:grep` | tool-fs-search |
| 105–106 | `tool:bash` / `tool:pwsh` / `tool:pty` | shell、terminal |
| 110–112 | `tool:web_search` / `tool:web_fetch` / `tool:lsp` | web、lsp |
| 113–117 | `tool:session-query` / `tool:goal` / `tool:cordis` / `tool:subagent` | 各自工具包 |
| 150 | `tools:sdk` | tools（Code Mode 的 SDK 声明） |

顺带一个真实的小细节：`tool:bash` 与 `tool:pwsh` **都是 105**。它们在同一部署里互斥（本地 shell 二选一），所以这个并列无害。但它暴露了 `order` 机制的一个确切边界。

那个边界是：**`order` 相同的两段按注册顺序决出先后，也就是按插件加载顺序**。这是包 README 里明列的已知限制——确定性依赖"各段占不同 order"这条约定，而不是像工具顺序那样被规范化过。工具顺序是配置驱动的显式列表，段顺序靠约定，两者的确定性强度不同。

### 3.1 空段会"吃掉"全局同名段

因为遮蔽发生在**排序之前**、在名字空间里，一个 scoped 段即使这次渲染成空串，也会把全局同名段顶掉。空段随后在渲染期被丢弃，但**全局文本不会回填**。

这看着像 bug，其实是关掉某段提示词的正式手段。Code Mode 的 SDK 段就是这么用的：全局注册一份，某个 agent 选择 native 呈现时，它自己 scope 下的同名段渲染为空串，于是这个 agent 拿到干净的提示词，而部署层面的其他部分不受影响。

### 3.2 `complete`：声明"整段提示词归我"

```ts
ctx.systemPrompt.section({ name: '...', order: 10, text: 'Exact prompt.', complete: true })
```

语义是：组装照常跑完 waterfall（工具、上下文、变量都还会被算出来），但结束后把这个段**强制还原成唯一的 section**。也就是说，注册了 `complete` 段的 scope 里，waterfall 监听器没有机会往提示词里塞东西或替换它。两个有效 `complete` 段会让 `assemble()` 直接抛错。它服务的是"兼容性部署要自己拥有完整 system prompt"这个场景，与 `includeHarnessIdentity: false` + 自定义 `persona` 配套使用。

这里有个值得注意的不对称：`complete` 的冲突检查针对的是**注册贡献**（排序后、waterfall 之前），不是 waterfall 的返回值。监听器返回的 `sections` 在存在注册级 `complete` 段时会被无条件替换掉，所以它也不可能绕过这条约束——但这个检查确实管不到监听器自己返回多个段的情形。

### 3.3 文本是函数，但插值不是现在

`text` 可以是一个函数，每次组装用**这一次的 `AssembleContext`** 重新求值。所以段内容可以随 scope、随 agent、随模式变化——`plan:policy` 就是典型：非 plan 模式返回空串。

但 `assemble()` 返回的段文本是**已解析、未插值**的。`{{model}}` 这类引用要等到渲染期才被替换。这个分层是有意的：`AssembleContext` 是"为谁组装"，插值是"最终写给模型的字面量"，两者时点不同，而中间还给 waterfall 留了改写变量的窗口（见第 6 节）。

## 4 `context`：为什么动态上下文不能写成 section

`context` 的形状和 `section` 几乎一样，差别全在去向：它不进 `system`，而是变成**历史尾部的一条 user 角色消息**。

一个自然的疑问是——为什么不干脆注册成 `order: 200` 的 section？答案是缓存和生命周期，两者都指向同一件事。

**第一，稳定前缀必须留在 system 里。** `system` 位于请求最前面，一旦前几个 token 变了，后面整段 KV 缓存全部失效。工具 schema 顺序、段顺序、人格文本都是刻意稳定下来的，为的就是让它成为一个可以复用的前缀。而运行时上下文天然要变：沙箱模式可能切换、审批策略可能调整、时间会走。把这些变化塞进 `system`，等于每一次变化都把缓存从头打断。

**第二，变化的东西需要"增量投影"，而不是每轮重发。** 上下文由 `RuntimeContextProjection` 管：

```text
每个模型步骤前：
        组装出的运行时上下文快照 current（可能为空）

   retained === undefined 且 current 为空 ──▶ 什么都不做（从未有过快照）
        │
        ▼
   snapshot = current 为空 ? CLEARED_MARKER : current
        │
        ├─ snapshot === retained.text ──▶ 什么都不做（没变，不重复追加）
        │
        └─ 不等 ──▶ 产出一条 user 消息（候选，尚未提交）
                      来源标记为 plugin 快照，并带上构成它的各段
```

三点设计细节：

- **没变就不追加**。同一个快照在连续多个步骤里保持稳定，历史里就只有一条。这既省 token，也让消息前缀继续可复用。
- **从有到无要显式说明**。快照消失时发的不是"什么都不发"，而是一条 `CLEARED` 占位（"Current runtime context: none. Earlier runtime-context snapshots no longer apply."）。否则模型会以为旧快照仍然有效——这是提示词工程里典型的静默错误。
- **被压缩顶掉要能重新投影**。投影器跟随 `session/event` 跟踪自己那条消息；一旦它被 compaction 之类的表面替换事件遮蔽，`retained` 置空，下一轮就会重新发一次。

**第三，它是"候选"，不是"已提交"。** 投影产物是作为 `agent/pre-step` 的追加项出现的（排在已认领消息之后），真正 append 到会话是后面 `turn()` 的事。所以被 `agent/pre-step` 拒掉的步骤不会在历史里留下一条孤儿快照。

最后是开关的粒度。`suppressRuntimeContext()` 掐掉的是**提示词投影**，不改变拥有这些事实的服务及其强制力——沙箱仍然会拦、审批仍然会问，只是模型不再被提前告知。而且它是匿名可叠加的：多个注册独立可弃，全部弃掉才恢复。

## 5 `tools`：schema 与指引是两条独立输入

```ts
ctx.systemPrompt.tools(provider: (context: AssembleContext) => ToolProviderResult)

interface ToolProviderResult {
  readonly schemas: readonly ToolSchema[]
  readonly knownNames?: readonly string[]   // 缺省 = schemas 的名字集
}
```

收集时有一行容易被忽略但很关键：

```ts
const schemas = result.schemas.map(({ name, description, parameters }) => ({
  name, description, parameters: structuredClone(parameters),
}))
```

`structuredClone` 是**与注册表脱钩**。这些 schema 最终会被冻结成请求的一部分，不先复制一份，就会把注册表里的对象一并冻住，之后任何一次合法的 schema 变更都会失败。

`knownNames` 的存在理由比较隐晦：它是"**限制前**的名字全集"。它唯一的用途是让 `toolOrder` 的配置校验能区分两件事——"配置里把工具名写错了"（每次都拒绝，并列出已知名字）与"这个名字的工具在这个 scope 被有意隐藏了"（允许在列表里缺席）。没有这个字段，这两种情况无法区分，配置校验就只能选一边。

排序规则收在 `orderTools` 里：

- provider 返回保留名 `<unlisted-tools>` → 直接抛错（它是配置里的占位符，不是工具名）；
- 没配 `toolOrder` → 按名字**码点字典序**，刻意不用 locale 比较，保证任何机器上顺序一致；
- 配了 → 列出的按列出的位置，未列出的插入 rest 占位符处并按字典序；列表缺 rest 占位符或有重复项，在**配置加载时**就抛。

排序发生在 waterfall **之前**。这一点和 section 的 order 排序是同一个动机：它们规范化的对象都是"插件注册顺序"这个加载副产物。此后监听器若改动列表，顺序由监听器自己负责。

**schema 与指引分离是刻意的**，后果值得记住：限制一个工具会移除它的 schema 成本，但**不会**移除该工具自己注册的那段 `tool:*` 指引文本。这就是为什么 Code Mode 必须单独注册一条 `tools:code-only` 规则；如果只在 schema 层面收窄成 `run_code`，模型仍会读到一份"你可以用 bash、用 read"的指引，然后发一个原生调用，拿到 `UNKNOWN_TOOL`，接着得出"这个部署自相矛盾"的结论。

而且这条规则用的是**与执行器同一个判定函数**：

```ts
text: context => this.modeFor(context.scope) === 'code' ? CODE_ONLY_INSTRUCTION : ''
```

提示词里陈述的规则，就是执行器用来拒绝的那个谓词。这是"提示词不得声明一条执行器不强制、或执行器强制而提示词不声明"的直接落法——比在文档里写一句"两者要保持同步"可靠得多。

## 6 `variable`：严格插值，插错就炸

```ts
ctx.systemPrompt.variable(name, provider: (context) => string | undefined)
```

名字必须匹配 `/^[a-z][a-z0-9_]*$/`，不合规**在注册时就抛**。scoped 值遮蔽全局值。provider 每次组装都会被调用——**不管有没有段引用它**。

真正有意思的是渲染期的插值规则，它比想象中严格：

| 输入 | 结果 |
| --- | --- |
| `{{model}}`，已注册且有值 | 替换 |
| 未注册的名字 | **抛错**，并列出所有已注册变量 |
| 已注册但这次是 `undefined` | **抛错**，并点名是哪个段/上下文 |
| `{{}}`、`{{Not Valid}}`、`{{{model}}}` | **抛错**（malformed） |
| 孤立的 `{{`，之后再无 `}}` | 当普通文字原样保留 |
| 替换进去的值里含 `{{...}}` | **不再扫描**，不递归 |

三处细节各有理由：

- **不递归替换**，否则一个变量的值里恰好含 `{{` 就会制造出无法预测的第二轮插值。
- **孤立的 `{{` 放过**，因为提示词里真的可能出现 `{{` 作为字面文字（比如在讲模板语法），而"有开无闭"是明确的字面量信号；但"有开有闭却不成组"（`{{{model}}}`）是真的写错了。
- **查值用 `Object.hasOwn` 而非 `in`**。否则 `{{constructor}}`、`{{toString}}` 会顺着原型链取到值，把提示词注入面开在了 `Object.prototype` 上。仓库里有一条测试专门钉住这个点。

当前注册的变量只有三个：`provider`、`model`、`cwd`，都从 `context.agent` 上读。裸调用 `assemble()`（没有 agent）时它们是 `undefined`，此时任何引用都会抛错——这正是"provider 必须容忍缺字段"这条要求存在的原因。

### 6.1 动态改写变量的正规姿势

不要在渲染期改，而要挂在 `system-prompt/assemble` waterfall 上。模型切换的实现在这里是个好模板：

```ts
const disposeAssembly = agentCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
  const selected = selection.current
  const assembled = await next()          // 先让正常组装跑完
  selection.assembled = selected          // 记下这次组装用的是哪个选择
  if (selected === undefined) return assembled
  return { ...assembled, variables: { ...assembled.variables,
    provider: selected.provider, model: selected.model } }
})
```

然后 `agent/request` waterfall 用 `selection.assembled` 这个**同一个冻结快照**去改请求配置。这样做的意义在于：如果 `model` 变量在两次读取之间被切换了，"提示词里写的模型"与"请求真正路由到的模型"就会劈成两半——而模型自己会看到提示词里那个过时的名字。同时，`assemble()` 的契约里明确写了 `signal` 是**这一次请求的控制信号，不得保留到下一个 turn**——同一个道理：组装是一次性的求值，不是可以缓存的上下文。

## 7 一次 `assemble()` 的十个步骤

把上面所有机制串起来，顺序如下（这个顺序本身是契约的一部分）：

```text
 1. chainLayers(scope)                     读作用域链，惰性且不创建层
 2. 判定 runtimeContextSuppressed          任一 suppressor 存在即为真
 3. 求值全部 variable                      全局先，父链从远到近，近者赢
 4. merge sections / contexts              名字遮蔽在这一步发生
 5. 收集 tools                             逐 provider：脱钩 + knownNames
 6. sections 按 order 排序                 校验有效 complete 段至多一个
 7. contexts 按 order 排序                 被 suppress 则直接为空数组
 8. tools 排序（orderTools）               配置顺序或字典序，校验未注册名
 9. await waterfall 组装                   返回值权威（事件名见 §7）
 10. 还原 complete 为唯一 section          若被 suppress，再清 contexts
```

第 9 步的 waterfall 是**作用域过滤的**：带作用域标签的监听器只收到匹配的组装请求，而监听器所属的作用域（或它的任何祖先）匹配时就会被调用。也就是说，一个"注册在父作用域的监听器"能观察到它下面每个 agent 的组装——这正是让一份 standing composition 覆盖它派生出的所有 agent 的机制。

第 10 步的"再次清空"是防监听器往被抑制的 scope 里加上下文；`complete` 段的还原同理，防监听器改提示词本体。

## 8 组装完之后还有一道不变量兜底

waterfall 让监听器可以自由改写 assembly，自由就得配检查。system-prompt 这个包自带一个 invariant 伴生插件，它用 `prepend: true` 挂在 waterfall 最前面，等 `next()` 返回后校验最终结果：

- 段名与上下文名非空、互不重复，`text` 是字符串；
- 变量名合规、值是 `string | undefined`；
- 工具名非空。

换句话说，监听器塞进去的脏数据**在同一次组装里就会被抓出来**，而不是静默写进提示词、等模型给出莫名其妙的回答再去回溯。

渲染之后还有一条与可回放性相关的设计。`system` 与 `tools` 会进 `canonicalHeader`，然后**只在与原值不同时**记一条 `request/header` 事件——`headerEquals` 逐字段比较，工具 schema 按顺序比较。所以"提示词没变"这件事本身是可观测的：日志里没有新事件，就代表这一轮的模型输入前缀与上一轮一致。这条不变量（模型可见的东西必须能从会话日志重建）也解释了为什么新增一类模型可见输入就必须新增一种会话事件。

渲染本身的规则很短：逐段严格插值 → 丢掉空串 → 用空行 join。空段消失是正常路径而非异常——`includeRuntimeContext: false`、非 plan 模式、native 呈现，靠的都是"段存在但渲染为空"。

## 9 四个容易踩的坑

**一，函数文本每次组装求值，但插值在渲染期。** 在 `text` 里手写 `{{...}}` 却忘了注册对应变量，错误会在请求发出前一刻由 `renderPrompt` 抛出，堆栈指向插值而不是你的注册代码。

**二，空文本的 scoped 段会"吃掉"全局同名段，不是回退。** 想临时关掉某段就用这个特性；想追加内容就千万别重用名字。

**三，`tools` 是叠加制。** 同一个工具名注册两次得到两份 schema，不会互相覆盖。工具面的收敛要用 `ToolRuntime.restrict()`，它在呈现、查找、执行三处保持对齐。

**四，`context` 不要当 `section` 用。** 凡是随回合变化的事实都该走 `context`（增量投影 + CLEARED 标记 + 缓存友好），只有稳定前缀留在 `section`。两者对 token 与 KV 缓存的影响是分开记录的，混用会把一个可复用的前缀变成每轮都失效的尾巴。

## 10 小结：三件值得带走的事

**第一，位置即契约。** `-100 / 0 / 100–199 / 150` 这些数字不是审美，而是让互不认识的插件在同一个字符串里各就各位的约定。它是弱形式（同 order 按加载顺序决胜），但足够用——真正的强形式留给了工具顺序，因为工具顺序是配置作者的输入，而段顺序是插件作者的输入。知道哪一处该用强保证、哪一处用约定就够，比两处都用"显式排序列表"更省。

**第二，缓存友好是一等公民，不是优化项。** 稳定前缀留在 `system`，变化的事实投影成历史尾部的一条消息，而且**没变就不追加、从有到无要显式说明、被压缩顶掉要能重发**。这四条合起来才构成一个可用的动态上下文，缺任何一条都会在长会话里退化成"每轮重发一遍全部运行时状态"。

**第三，提示词里的规则必须和执行器用同一个判定。** Code Mode 那条 `tools:code-only` 不是文案，它与拒绝工具调用的谓词共用 `modeFor()`。提示词是模型的行为契约，不是说明文档——一旦它陈述了执行器不强制的事（或漏掉了执行器强制的事），模型会先相信提示词，然后在拿到错误后开始怀疑整个部署。

再回到开头那个问题：为什么不做成一个字符串？因为在这个系统里，**"模型被告知它能做什么"和"模型真的能做什么"必须是同一件事的两个投影**。把提示词的每一段交给拥有那个事实的插件，是让这两个投影不漂移的最低成本做法。

---

*本文基于 Deepseek Harness 仓库中 `packages/core/system-prompt/`、`packages/core/scope/`、`packages/core/agent-loop/`（含 `runtime-context.ts`）、`packages/core/tools/` 的实现，以及 `docs/subsystems/system-prompt.md` 与 `packages/core/system-prompt/README.md` 的契约描述整理。文中段名与 order 数值取自各工具包的注册代码，成品可对照仓库内的 keyless 快照 `examples/acp-agent/tests/snapshots/advanced-toolchain/system-prompt.expected.md`。*
