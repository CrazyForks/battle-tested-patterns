---
layout: home

hero:
  name: Battle-Tested Patterns
  text: 生产验证的编程模式
  tagline: 从 React、Linux、Go、Chromium 等顶级项目源码中提炼。精确源码链接、多语言实现、交互式练习。
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/what-is-this
    - theme: alt
      text: 浏览模式
      link: /zh/patterns/bitmask/
    - theme: alt
      text: GitHub
      link: https://github.com/Totoro-jam/battle-tested-patterns

features:
  - icon: 🔗
    title: 生产验证
    details: 每个模式附带精确到行号的 GitHub 源码链接，证明它在真实项目中被使用。
  - icon: 🌍
    title: 多语言实现
    details: TypeScript、Rust、Go、C 的地道实现——不是机械翻译，而是每种语言的原生表达。
  - icon: 🧪
    title: 可运行练习
    details: 渐进式练习（基础 → 进阶 → 高级），配套测试用例，本地或浏览器 Playground 均可运行。
  - icon: 🎮
    title: 交互式 Playground
    details: 基于 Monaco Editor 和 Vitest，直接在浏览器中编辑和运行代码，无需本地环境。
---

## 编程模式

| 模式 | 核心洞察 | 来源项目 |
|------|---------|---------|
| [位掩码 (Bitmask)](/zh/patterns/bitmask/) | 将多个布尔标志压缩到一个整数中 | React, Linux, Chromium |
| [双缓冲 (Double Buffering)](/zh/patterns/double-buffering/) | 在两份副本间切换以实现原子更新 | React Fiber, GPU, PostgreSQL |
| [协作调度 (Cooperative Scheduling)](/zh/patterns/cooperative-scheduling/) | 主动让出控制权以保持响应 | React, Go Runtime |
| [最小堆 (Min Heap)](/zh/patterns/min-heap/) | O(1) 访问最高优先级元素 | React Scheduler, Linux CFS, Node.js |
| [差异/补丁 (Diff/Patch)](/zh/patterns/diff-patch/) | 计算两个状态之间的最小变更 | React Reconciler, Git |
