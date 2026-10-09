---
title: Cordis —— Deepseek Harness 的幕后
author: Vic
date: 2026-09-28
category: 技术
excerpt: Cordis为什么会成为Deepseek Harness的核心技术框架？优势在哪里
published: true
---

# Cordis：面向时空可组合性的编程范式

> 论文：*A Programming Paradigm for Spatiotemporal Composability*  
> 核心问题：如何让一个长期运行的软件系统，在**不整体重启**的情况下，安全地动态加载、卸载、替换组件。

![Cordis 整体设计思想](/img/cordis_design_overview.png)

## 一句话总结

**Cordis = 可撤销的副作用 + 动态响应的依赖 + 统一 Context。**

它希望把 Tool、Memory、Sandbox、插件、服务等都视为可动态变化的组件，由 Runtime 统一管理它们的依赖、生命周期和资源回收。

---

## 1. Revertible Effects：副作用必须可撤销

组件启动时通常会：

- 注册工具或服务
- 注册事件监听器
- 启动后台任务
- 创建路由或连接
- 修改运行时状态

Cordis 要求这些操作在执行时，同时产生对应的 `undo`：

```text
effect() → undo
```

组件卸载时，Runtime 按逆序自动执行这些撤销操作：

```text
E1 → E2 → E3

卸载：
E3⁻¹ → E2⁻¹ → E1⁻¹
```

这样资源清理不再依赖开发者手写一个庞大的 `deactivate()`。

---

## 2. Reactive Coeffects：依赖关系必须是动态的

传统依赖注入通常只在启动时解析一次依赖。

Cordis 中，组件会声明：

```text
requires:
- Memory
- ToolRegistry
- Sandbox
```

Runtime 持续观察这些依赖：

```text
依赖满足 → 启动组件
依赖消失 → 卸载组件
依赖替换 → 重载组件
```

因此组件生命周期会随着运行环境变化自动调整。

---

## 3. 统一 Context：所有组件通过 Context 交互

组件不应该直接互相持有和操作，而是统一通过 Context：

```text
Component A
     ↓
   Context
     ↑
Component B
```

Context 负责：

- 依赖解析
- 能力注册
- 副作用追踪
- 生命周期管理
- 资源隔离
- 组件变化通知

这样 Runtime 才能知道“谁依赖谁、谁修改了什么、卸载时该撤销什么”。

---

## 4. Component 的基本模型

一个组件可以简单理解成三部分：

```text
Component
├── requires：我需要什么
├── provides：我提供什么
└── effects：我启动后要做什么
```

例如：

```text
SearchTool
├── requires
│   ├── HTTPClient
│   └── Auth
├── provides
│   └── SearchCapability
└── effects
    ├── registerTool()
    └── startWorker()
```

组件只描述自身需求和行为，Runtime 负责什么时候加载、卸载和重载。

---

## 5. 什么是“时空可组合性”

### Temporal Composability

强调**时间维度**：

组件可以随时加入、移除、替换，而且卸载后能够把产生的副作用干净地撤销。

### Spatial Composability

强调**依赖拓扑维度**：

系统中的依赖关系可以动态发生变化，Runtime 会自动协调相关组件。

因此：

```text
动态组件变化
      ↓
Context 感知
      ↓
重新解析依赖
      ↓
启动 / 卸载 / 重载
      ↓
自动回滚副作用
```

---

## 6. 对 Agent Harness 的意义

这套模型尤其适合 Agent Runtime / Harness。

可以把下面这些能力统一看成 Component：

```text
Agent Harness
├── Tool
├── Skill
├── Memory
├── Sandbox
├── MCP
├── Permission
└── SubAgent
```

例如 Memory 被替换：

```text
Memory v1
   ↓
Agent Component ACTIVE

Memory v1 被移除
   ↓
自动卸载相关组件
   ↓
撤销旧副作用

Memory v2 加入
   ↓
重新解析依赖
   ↓
重新加载组件
```

这让 Agent Harness 更适合做动态扩展、热插拔，甚至进一步支持 self-evolving runtime。

---

## 最核心的结论

如果只记住这篇论文的三个概念：

1. **Effects are revertible**：所有副作用都应该能够撤销。
2. **Coeffects are reactive**：依赖必须随着环境变化动态响应。
3. **Everything goes through Context**：组件交互统一经过 Context。

最终目标是让长期运行系统里的组件能够安全地：

```text
出现 → 运行 → 被替换 → 消失
```

而不需要依赖整体重启来维持系统一致性。
