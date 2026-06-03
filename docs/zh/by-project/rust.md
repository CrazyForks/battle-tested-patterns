---
description: "Rust 标准库模式：迭代器、写时复制（Cow）、引用计数（Arc）、驻留和 Arena 分配。"
---

# Rust 标准库中的模式

Rust 标准库通过其类型系统实现了零成本抽象。

| 模式 | 位置 | 作用 |
|------|------|------|
| [迭代器](/zh/patterns/iterator/) | [`core/iter/traits/iterator.rs`](https://github.com/rust-lang/rust/blob/main/library/core/src/iter/traits/iterator.rs#L68-L112) | `Iterator` trait — 零成本抽象的可组合序列处理 |
| [写时复制](/zh/patterns/copy-on-write/) | [`alloc/src/borrow.rs`](https://github.com/rust-lang/rust/blob/main/library/alloc/src/borrow.rs#L169-L220) | `Cow<'a, B>` — 写时克隆智能指针 |
| [Arena 分配器](/zh/patterns/arena-allocator/) | [bumpalo `lib.rs`](https://github.com/fitzgen/bumpalo/blob/main/src/lib.rs#L378-L383) | `Bump` — Rust 经典 arena 分配器，被 wasm-bindgen 和 Deno 使用 |
| [工作窃取](/zh/patterns/work-stealing/) | [Tokio `worker.rs`](https://github.com/tokio-rs/tokio/blob/master/tokio/src/runtime/scheduler/multi_thread/worker.rs#L1136-L1175) | `Core::steal_work` — 多线程异步运行时的工作窃取 |
| [依赖图](/zh/patterns/dependency-graph/) | [Cargo `resolver/`](https://github.com/rust-lang/cargo/blob/master/src/cargo/core/resolver/dep_cache.rs#L1-L50) | 基于 DAG 的依赖解析，确定 crate 编译顺序 |
| [引用计数](/zh/patterns/reference-counting/) | [`alloc/src/sync.rs`](https://github.com/rust-lang/rust/blob/main/library/alloc/src/sync.rs) | `Arc<T>` — 跨线程共享所有权的原子引用计数 |
| [驻留](/zh/patterns/interning/) | [rustc `symbol.rs`](https://github.com/rust-lang/rust/blob/master/compiler/rustc_span/src/symbol.rs#L24-L79) | `Symbol` 是全局驻留器中的 `u32` 索引——所有标识符驻留实现 O(1) 比较 |
| [信号量](/zh/patterns/semaphore/) | [Tokio `semaphore.rs`](https://github.com/tokio-rs/tokio/blob/master/tokio/src/sync/semaphore.rs) | `Semaphore` — 异步感知的有界并发控制 |

## 延伸阅读

- [Rust Source Code (GitHub)](https://github.com/rust-lang/rust) · [bumpalo (GitHub)](https://github.com/fitzgen/bumpalo) · [Tokio (GitHub)](https://github.com/tokio-rs/tokio)
