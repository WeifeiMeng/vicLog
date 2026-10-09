---
title: Deepseek Harness 的上下文压缩：策略与插件化装配
author: Vic
date: 2026-09-28
excerpt: 从四条压缩策略、日志记录的压缩事务，到它如何作为一个可插拔组件接入系统——以及"可插拔"究竟是 Cordis 的还是 Harness 自己的。
published: true
category: 技术
---

# Deepseek Harness 的上下文压缩：策略与插件化装配

长会话最终都会撞上上下文窗口。多数框架的处理方式是在 Agent Loop 里塞一段"超限就总结"的逻辑；Deepseek Harness（下称 DSH）的选择是把压缩做成一个**独立的能力接缝（capability seam）**——契约、实现、人机入口分属不同的包，通过 Cordis 的服务与事件接入，挂在哪里由 composition 文件决定。

这篇记录两件事：DSH 的上下文压缩具体有哪几条策略，以及它如何以插件的方式加入系统。顺带回答一个我读完代码后问自己的问题：这个可插拔，是 Cordis 自带的吗？

**关键词：capability seam、会话表面、日志记录的锁、隔离 realm、能力与策略分离**

## 0 前提：压缩改的是"会话表面"，不是追加消息

理解 DSH 压缩的钥匙在会话层。会话是 append-only 的事件日志，日志之上有一层**表面（surface）**：一个有序投影，也是模型真正看到的历史。表面支持一种操作：

```ts
{ op: 'replace', start, end }  // 遮蔽表面上的 start..end，并在原位置插入一条新节点
```

压缩就是一次 `replace`：一段旧历史被替换成一条摘要节点。原始事件永久留在日志里，回放是确定性的；被遮蔽的内容仍然能通过原始日志、轨迹视图和审计查到。

这个设计决定了后面所有细节。压缩不是"往上下文里再补一条总结"，而是**让一段历史不再出现在模型可见的历史里**。

值得注意的是，能带 `replace` 的事件类型是封闭的——只有 `user/message`、`assistant/message`、`tool/result` 这类"产生消息"的事件可以带 `surfaceOp`。所以压缩的记录类事件（`compaction/start`、`compaction/summary`、`compaction/end`）全部是**仅记日志**的，摘要本身必须搭在一条独立的 `user/message` 上。这不是随手的选择，而是类型系统逼出来的正确形状。

## 1 四条压缩策略

| 策略 | 是否调用模型 | 何时触发 | 粒度 |
| --- | --- | --- | --- |
| 工具结果裁剪 | 否 | 压力/溢出确认后，选区之前 | 单个 `tool/result` |
| LLM 摘要压缩 | 是，一次 | 裁剪后仍超阈值 | 一段连续历史 |
| 触发策略 | — | 每步之后、请求失败、人工命令 | — |
| 保留与边界策略 | — | 摘要压缩内部的选区与切点规则 | — |

前两条是"怎么缩"，后两条是"什么时候缩、缩哪里"。

### 1.1 工具结果裁剪：先跑最便宜的那一层

`packages/compaction/compaction-tool-result-pruner` 是一个**无模型调用**的服务。它对当前表面上超预算的 `tool/result`，保留"头部 + 固定省略标记 + 尾部"，删掉中间：

```text
保留头 4096 字符 + "\n\n[... tool result middle pruned ...]\n\n" + 保留尾 1024 字符
（超过 thresholdChars = 8192 才处理）
```

几个值得记的工程细节：

- 切片按 **Unicode 码点**而非 UTF-16 码元，所以不会切断代理对（字素簇仍可能被切断，这点被明确写在文档里）。
- 替换时保留原数据的全部字段（`turn`、`step`、`callId`、错误信息、`meta`），只改 `content`。
- 每次替换前紧跟一条 `compaction/prune` 事件，把被遮蔽节点的价格记在日志里，使纯消费者无需保留 per-node 状态就能做减法。
- 最关键的一条：**它可能让摘要完全不必发生**。裁剪完成后会重新测量，如果压力已经回到阈值以内就直接结束——省掉一次模型调用。

字符预算不等于 token 预算，所以裁剪永远不自己判断"够不够"，判断权留给计量服务。

### 1.2 LLM 摘要压缩：复用 KV cache 的一次性调用

真正的压缩在 `packages/compaction/compaction-basic`。它调用一次 `ctx.llm.stream()`，但做法有讲究：

- **回放对话自己的 system prompt、工具 schema 和被打包区间的消息**，逐字节一致，然后把压缩指令作为**最后一条 user 消息**追加。这样这次辅助调用是上一次真实请求的真前缀，provider 的热前缀缓存得以复用——只有尾部指令和摘要输出是未命中的。
- 指令要求输出固定的八段结构：Primary Request and Intent / Key Technical Concepts / Files and Code / Errors and Fixes / Pending Jobs / Current Work / Next Step / Critical Context。空段写 `(none)`，不允许省略段落。
- 如果对话里已经存在 `<compacted-summary>`，指令要求**合并而不是原样搬运**：保留仍成立的事实，丢掉过时的，把新信息并进同一份摘要。
- 只把**文本**投影进 checkpoint。模型的推理过程和工具调用不会泄漏进来（工具调用会成为孤儿调用）；出现图片输出直接以 `UNSUPPORTED_CONTENT` 失败，而不是悄悄丢弃。
- 调用带 `purpose: 'compaction'`，DeepSeek adapter 会转发成 `x-deepseek-harness-compact: 1`，用于请求归因，但不动模型可见的请求体。
- 落地成一条 `user/message`，来源标记为 `compactCheckpointSource(compactionId)`，正文用 `<compacted-summary>` 包裹，前面加一段声明这是自动生成的背景，让后续模型直接接着做、不要复述。

### 1.3 触发策略：三条入口

| 触发 | 挂载点 | 行为 |
| --- | --- | --- |
| 压力 | 串行 `agent/pre-step`，在请求派生之前 | 每个**成功的步骤**之后都检查，不是每轮一次 |
| 溢出 | `agent/request-error` | provider 确认上下文超限时，绕过阈值与保留策略，强制做一次最大化的头部缩减 |
| 手动 | `/compact` 命令 | 空闲会话维护，即使没到阈值也能减一次 |

"每步之后"这一点是刻意的，也是整个设计里最容易忽略的部分：一个工具密集的 ReAct 轮**在轮内**表面就在持续增长。如果只在轮边界检查，跑飞的长轮可能来不及压缩就撑爆窗口。检查放宽到步边界后，轮内已经闭合的工具对可以被提前打包。

溢出路径独立且更激进：它不需要模型的容量元数据（provider 已经用失败证明了必须要压缩），裁剪后做一次最大化的平衡缩减，并且只在表面替换代数真正前进时才返回重试——否则保留原始的 provider 错误，不掩盖真实失败原因。

### 1.4 保留与边界策略

压缩的"选区"规则决定了压缩质量：

- **尾部保留**：从尾向头累加，把最近一段（默认 `retainRatio = 0.16` 的窗口容量）原样保留，只压更早的部分。近期上下文最可能被继续引用，全压会失忆。
- **头部锚定**：自动压缩**永远从表面头部开始**。因此上一个 checkpoint 会被合并进这次摘要——自动路径上**永远只有一个 checkpoint**（手动的中途压缩可能留下多个）。这也是为什么 `shadowedRange` 是"位置跨度"而不是"序号区间"：新摘要的事件序号更高，却占据了旧位置，`start` 可能大于 `end`。
- **工具配对平衡**：切点不允许把一个步骤的 tool-call 和 tool-result 拆开。平衡按表面顺序而非日志序号计算，并且带 per-session 缓存，只在表面重写时才重建。
- **轮边界不保护旧步骤**：一个失控的长轮，它早期**已闭合**的步骤和普通历史一样会被打包，只有最近的步骤保持原文。这正是它能救回长轮的原因。若只剩一个尚未闭合的、不可分割的尾步，就返回"无事可做"，等它闭合。
- **收敛不变量**：每个落地的摘要必须**严格小于它所遮蔽的内容**（比较框架化之后的 token 数与被遮蔽内容的估算量），否则拒绝提交。实现里那句"摘要不能比原文更大"不是注释而是断言。

## 2 事务与锁：怎么保证不把会话写坏

压缩要调用模型（可能几秒到几十秒），期间会话可能被其他来源追加内容。DSH 用一个**记录在日志里的锁**把整段操作框起来，共五步：

```text
compaction/start    → 仅记日志。同步 append，取得锁
[调用模型产出摘要]
compaction/summary  → 仅记日志。摘要、区间、被遮蔽序号、token 数、provider/model 调用信封
user/message        → 唯一的表面变更：source = checkpoint 标记 + surfaceOp { op: 'replace' }
compaction/end      → 仅记日志。释放锁
```

几个细节值得单独说：

- **锁最后释放**。如果进程在中间崩溃，留下的是一条"有 start 没有 end"的可检测孤儿锁，而不是一条谎称"压完了"的 end。下次进入压缩时会报 busy，而不是带着半个表面继续跑。
- **稳定性检查分两档**。自动路径要求整个表面不变；手动路径只要求**被选中的区间**不变——因为人工压缩进行中完全可能有无关上下文被注入，这部分不应让摘要作废。注入的内容会出现在新 checkpoint 之后，继续可见。
- **失败分类是封闭的**：`busy | cancelled | changed | summary | commit | persistence`。其中 `changed` 和 `summary` 明确意味着会话内容没被改动，但失败的尝试仍然记在日志里——这是一条很干净的可观测性边界。
- **锁不是 `WeakSet`、不是包装互斥量、不是客户端锚点**，而是一条持久化事件。所以它跨进程重启依然有效，也天然免除了"内存锁在崩溃后失效"这一类 bug。

## 3 插件化装配：压缩如何接入系统

### 3.1 四个包，两种插件形态

| 包 | 角色 | 形态与关键声明 |
| --- | --- | --- |
| `compaction` | 服务契约 | 抽象类 + `export default`，`super(ctx, 'compaction')` |
| `compaction-basic` | 服务实现 | 类 + `static inject = ['llm','tokenMeter','sessions']` + `static Config` |
| `compaction-tool-result-pruner` | 可选伴生服务 | 类，注册 `ctx.toolResultPruner`，`static inject = ['tokenMeter']` |
| `command-compact` | 人类入口 | **函数式插件**：`name` / `inject` / `apply`，没有 default export |

最后一条是硬约束：函数式插件若同时有 default export，Loader 会丢掉它的 namespace，导致 `inject` 静默失效（仓库里为此专门留了一篇事故复盘）。

契约包把三个方法全部声明为 `abstract`：何时压缩、保留多少、怎么总结，全部留给实现。"换一个模板摘要器或远程摘要服务"因此不需要改调用方一行代码。

### 3.2 Cordis 在中间做的四件事

1. **解析模块**：composition 里的包名按 Node 解析规则找到入口，再由 `Config` schema 校验 `config:` 块。
2. **依赖门控激活**：`static inject` 声明这个插件在哪些服务就位后才启动。所以 `compaction-basic` 会自动等到 `llm`、`tokenMeter`、`sessions` 全部存在——**不依赖 composition 里的行顺序**。这也是 base patch 文件头部那句"行顺序不承载加载语义"的由来。
3. **注册服务**：`super(ctx, 'compaction')` 内部就是 `ctx.provide`，服务随所属 fiber 自动注销。
4. **注册即 effect**：构造函数里挂的 `agent/pre-step`、`agent/request-error`、`agent/status`、`session/event` 监听全部随卸载撤销。

可选依赖刻意用 `ctx.get('toolResultPruner')` 而不是 `ctx.toolResultPruner`——属性代理对拓扑敏感，严格读取才不会在不同装配下悄悄变成 undefined。因此 `compaction-basic` 单独挂也能跑，只是失去无模型裁剪那一层。这个可选性在包清单里也有对应声明（可选 peer dependency）。

### 3.3 同一份代码，三条装配路径

**路径 A：独立应用/示例**——直接在 composition 里列名，交给默认配置：

```yaml
- id: token-meter
  name: '@deepseek-ai/dsh-token-meter'

- id: compaction-basic
  name: '@deepseek-ai/dsh-compaction-basic'
  config:
    thresholdRatio: 0.8
    retainRatio: 0.16
    maxTokens: 8192
    compactionRetries: 1
```

**路径 B：base bundle**——所有 profile 共享的宿主行。bundle 通过在清单里声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 变成 `dsh --profile` 的补丁层，然后把压缩、计量、裁剪、`/compact` 一起插入。

**路径 C：Web profile**——先按 id 关掉 base 的行，再改由每个 **agent preset** 在隔离 realm 里重新挂载：

```yaml
- id: compaction-basic
  disabled: true   # 关掉宿主平面那一行

- id: compaction
  name: cordis:group
  group: true
  isolate:
    compaction: true
    toolResultPruner: true
  config:
    - id: compaction-basic
      name: '@deepseek-ai/dsh-compaction-basic'
    - id: command-compact
      name: '@deepseek-ai/dsh-command-compact'
    - id: tool-result-pruner
      name: '@deepseek-ai/dsh-compaction-tool-result-pruner'
```

### 3.4 为什么 Web profile 必须放进隔离 realm

这段装配里有三条互相咬合的理由，全部写在 preset 文件的注释里：

- **preset 的挂载是"每进程一次、按 scope 父链共享"**。如果服务行不在隔离 realm 里，`ctx.compaction` 就发布到 root realm，成为进程全局——第二个 preset 注册同名服务直接冲突，宿主读取方会为每个会话解析到某一个 preset 的实例。roster 在挂载时就会拒绝这种行。
- **`tokenMeter` 故意不在这个 realm 里**。它无配置、按会话 keyed，并且拥有浏览器读取的上下文占用投影单元——那张表是进程级的。放进 realm 会让"计量服务"变成"当前挂了哪些 preset"的函数。所以它留在宿主平面，preset 里的行只是解析那一个实例。**preset 真正能选的，是这个 agent 到底压不压缩。**
- **裁剪服务必须和压缩实现同 realm**，因为后者是通过 `ctx.get` 读它的，跨 realm 就看不见。

## 4 那么，"可插拔"是 Cordis 的特性吗

是，但要分两层看。

**Cordis 直接提供**：插件注册表与 fiber 树、`Service` 基类与服务注册、`inject` 依赖门控、`Config` schema 校验、`effect`/`on` 的撤销语义、事件派发模式（`emit` / `serial` / `waterfall` / `parallel`）、scope 与**隔离 realm**、`group` 插件、Loader/Include 的补丁层组合与热重载。压缩用到的每一件"插件感"都出自这里——包括那条 `isolate`，它是 Cordis `isolate()` 的用法（同一个 label 会让两个 realm 合并，但 label **合并的是 realm 而不是实例**，所以同一个 realm 里同名服务二次注册仍然会抛错）。

**DSH 在 Cordis 之上自己加的**：

1. **capability seam 约定**。Cordis 只提供"一个类能注册一个命名服务"；把一份能力拆成契约包 / 实现包 / 消费者包三个独立发布的包、接口全 `abstract`，是 DSH 的约定。压缩、bash、subagent、web 都遵循同一个形状。
2. **profile bundle 补丁层**与 `dsh --profile` 契约。
3. **agent preset roster**：standing scope、scope 父链，以及"服务行必须包在隔离 realm 中，否则挂载即拒绝"这条策略——都是 DSH 的判断，不是框架强制的。
4. **解析清单门禁**：composition 里的裸包名必须出现在对应清单的依赖里，由仓库脚本强制，Cordis 没有这个概念。
5. **每个包自带 invariant 伴生插件**：压缩契约包的伴生会真的校验日志流关系（checkpoint 的 id 必须匹配一个仍打开的 `compaction/start`、活锁不得跨回合边界、seed 边界之后的旧锁判为过期）。实现包的伴生则是**显式空实现加一句理由**——"没有超出所属接缝契约的独立事件序列"。空实现也要写明为什么空，这件事本身就挺有说服力。
6. **"模型可见即必须可回放"**：为什么压缩必须是插件而不能改 loop——因为压缩新增了模型可见输入，它必须能被会话日志完整重建。于是有：所有 `compaction/*` 事件、那条带 `surfaceOp` 的 `user/message`、以及 `compaction/summary` 里记录的 provider / model / maxTokens / usage。这条不变量出自仓库的工程约定，不是框架能力。

还有一个容易被忽略的限定：**这里的 Cordis 是 vendored 且被本地修改过的版本**。框架源码以 pinned 副本形式纳入仓库，并维护一份差异清单（当前 18 条），其中数条改的正是"插件如何被加载与装配"的语义——包括 fiber 生命周期加固、Loader/Include 的事务化配置对账，以及让"先插入的行能被后续补丁按 id 关闭"这件事实成立。

后者尤其说明问题：上游实现只在补丁循环前建一次 id 索引，导致被插入的行**静默地无法被后续补丁修改**。而 DSH 要求多个 bundle 补丁作为同级补丁列表应用、并能靠 id 关掉 base 插入的行——也就是说，第 3.3 节那条"base 插行 → web 补丁关行 → preset 在 realm 里重挂"的装配链条，**依赖的正是这些本地修改**。所以更准确的说法是：可插拔的机制来自 Cordis，但本仓库里实际生效的那套装配语义，是 DSH 自己维护的框架层。

## 5 小结：这套设计里值得带走的三件事

**第一，能力与策略分离。** 契约包只回答"压缩做什么"（考虑一次触发、显式压一次、强压一个区间），实现包回答"怎么做"（阈值、保留、摘要调用、事件时序）。结果是同一套调用方可以换模板摘要器或远程摘要服务，而计量、记账、锁这些不变量不会被绕过——因为它们是单独的服务和单独的事务，不属于任何一个实现。

**第二，分层触发，先便宜后昂贵。** 无模型的字符裁剪先跑，跑完重新测量；不够才调用模型；模型的输出必须比被遮蔽内容更小才允许落地；落地后重新测量，必要时重试；重试仍不够就明确报错而不是假装成功。整个过程没有任何一步会"顺手多花一次调用"。

**第三，把并发与崩溃当成一等公民。** 压缩的锁不是内存对象，而是一对持久化事件，且**释放动作放在最后**——这让崩溃的语义变成"留下可检测的孤儿锁"，而不是"谎称成功"。这类选择读代码时很不起眼，但它决定了长会话系统在真实环境下的可运维性。

---

*本文基于 Deepseek Harness 仓库中 `packages/compaction/` 的四个包、`vendor/cordis` 的插件解析实现，以及三个 profile 的 composition 与 agent preset 文件整理。*
