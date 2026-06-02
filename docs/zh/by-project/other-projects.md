# 其他项目中的模式

除 React、Linux、Go 外，这些模式广泛出现在各类生产系统中。

## Git

| 模式 | 位置 | 作用 |
|------|------|------|
| [写时复制](/zh/patterns/copy-on-write/) | `object-file.c` | 内容寻址不可变对象；分支共享对象，新 commit 只为变更文件创建新对象 |
| [差异/补丁](/zh/patterns/diff-patch/) | `diff.c`, `xdiff/` | Myers 差异算法计算文件版本间的最小编辑距离 |

## Node.js

| 模式 | 位置 | 作用 |
|------|------|------|
| [观察者](/zh/patterns/observer/) | `lib/events.js` | `EventEmitter` — Node 事件驱动架构的基础 |

## Redux

| 模式 | 位置 | 作用 |
|------|------|------|
| [观察者](/zh/patterns/observer/) | `createStore.ts` | `subscribe()` + `dispatch()` — 每次状态变化后通知监听器 |

## Rust 标准库

| 模式 | 位置 | 作用 |
|------|------|------|
| [写时复制](/zh/patterns/copy-on-write/) | `alloc/src/borrow.rs` | `Cow<'a, B>` — 写时克隆智能指针，用于零拷贝解析 |

## XState · LMAX Disruptor · Godot · SDL

| 模式 | 项目 | 作用 |
|------|------|------|
| [状态机](/zh/patterns/state-machine/) | XState | 工业级有限状态机库 |
| [环形缓冲区](/zh/patterns/ring-buffer/) | LMAX Disruptor | 每秒 600 万笔订单的核心数据结构 |
| [对象池](/zh/patterns/object-pool/) | Godot Engine | 基于 freelist 的游戏对象池 |
| [双缓冲](/zh/patterns/double-buffering/) | SDL | 前后 buffer 交换实现无撕裂帧呈现 |
