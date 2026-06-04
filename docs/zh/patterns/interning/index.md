---
description: "通过规范化查找表去重不可变值——用 O(1) 的指针比较替代 O(n) 的内容比较。"
difficulty: "intermediate"
---

# 模式：驻留 / 符号表 (Interning / Symbol Table)

<DifficultyBadge />

## 一句话

通过规范化查找表去重不可变值——用 O(1) 的指针比较替代 O(n) 的内容比较。

<DemoBadge />

## 现实类比

邮局只存储一份每个邮编的副本，给所有人一个引用。不是每封信都带一份「94105」，它们都指向同一个共享条目。

## 核心思想

驻留将每个唯一值在表中只存储一次，并分发轻量级标识符（符号、ID 或驻留指针）指向规范副本。结构上相等的两个值获得相同的标识符，因此相等性检查变成 O(1) 的指针/整数比较，而不是 O(n) 的内容比较。这用前期去重成本换取重复相等性检查的巨大节省。

```text
  intern("hello") → 0     intern("world") → 1     intern("hello") → 0
                                                     (reuse!)

  ┌───────────────────────┐
  │    Symbol Table       │
  ├────┬──────────────────┤
  │ ID │  Value           │
  ├────┼──────────────────┤
  │  0 │  "hello"         │
  │  1 │  "world"         │
  │  2 │  "foo"           │
  └────┴──────────────────┘

  Equality: symbol_a == symbol_b  (integer compare, O(1))
  Instead:  strcmp(str_a, str_b)   (character scan, O(n))
```

| 属性 | 值 |
|------|------|
| intern() | 首次 O(n)（哈希 + 存储），命中时 O(1) 均摊 |
| 相等性 | O(1) — 整数/指针比较 |
| 内存 | 去重——每个唯一值只存储一次 |
| 权衡 | 驻留表单调增长（值永不释放） |

**动手试试** — 驻留字符串，观察重复值如何解析为同一 ID：

<InterningViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Rust 编译器 (rustc) | [symbol.rs#L24-L79](https://github.com/rust-lang/rust/blob/master/compiler/rustc_span/src/symbol.rs#L24-L79) | `Symbol`（L24）是 `u32` 的 newtype——全局驻留表的索引。`Interner`（L56-L79）在 `Vec` 中存储字符串，通过 `HashMap` 去重。Rust 编译器中的所有标识符都是 `Symbol`——相等性是一次 `u32` 比较。 |
| CPython | [unicodeobject.c#L15575-L15631](https://github.com/python/cpython/blob/main/Objects/unicodeobject.c#L15575-L15631) | `PyUnicode_InternInPlace`（L15575）通过将 Python 字符串存储在全局 dict 中来驻留。如果字符串已存在，返回现有对象并递减新对象的引用计数。所有标识符字符串（变量名、属性名）自动驻留以实现 O(1) 的 dict 查找。 |

## 实现

::: code-group

```typescript [TypeScript]
class StringInterner {
  private strToId = new Map<string, number>();
  private idToStr: string[] = [];

  intern(s: string): number {
    const existing = this.strToId.get(s);
    if (existing !== undefined) return existing;
    const id = this.idToStr.length;
    this.strToId.set(s, id);
    this.idToStr.push(s);
    return id;
  }

  resolve(id: number): string | undefined {
    return this.idToStr[id];
  }

  get size(): number {
    return this.idToStr.length;
  }
}
```

```go [Go]
type Interner struct {
	strToID map[string]int
	idToStr []string
}

func NewInterner() *Interner {
	return &Interner{strToID: make(map[string]int)}
}

func (it *Interner) Intern(s string) int {
	if id, ok := it.strToID[s]; ok {
		return id
	}
	id := len(it.idToStr)
	it.strToID[s] = id
	it.idToStr = append(it.idToStr, s)
	return id
}

func (it *Interner) Resolve(id int) (string, bool) {
	if id < 0 || id >= len(it.idToStr) {
		return "", false
	}
	return it.idToStr[id], true
}
```

```python [Python]
class StringInterner:
    def __init__(self):
        self._str_to_id: dict[str, int] = {}
        self._id_to_str: list[str] = []

    def intern(self, s: str) -> int:
        if s in self._str_to_id:
            return self._str_to_id[s]
        sym_id = len(self._id_to_str)
        self._str_to_id[s] = sym_id
        self._id_to_str.append(s)
        return sym_id

    def resolve(self, sym_id: int) -> str | None:
        if 0 <= sym_id < len(self._id_to_str):
            return self._id_to_str[sym_id]
        return None
```

```rust [Rust]
use std::collections::HashMap;

pub struct Interner {
    str_to_id: HashMap<String, u32>,
    id_to_str: Vec<String>,
}

impl Interner {
    pub fn new() -> Self {
        Interner { str_to_id: HashMap::new(), id_to_str: Vec::new() }
    }

    pub fn intern(&mut self, s: &str) -> u32 {
        if let Some(&id) = self.str_to_id.get(s) {
            return id;
        }
        let id = self.id_to_str.len() as u32;
        self.str_to_id.insert(s.to_string(), id);
        self.id_to_str.push(s.to_string());
        id
    }

    pub fn resolve(&self, id: u32) -> Option<&str> {
        self.id_to_str.get(id as usize).map(|s| s.as_str())
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带 intern/resolve 的字符串驻留器 | `exercises/typescript/interning/01-basic.test.ts` |
| 进阶 | 带结构相等性的类型驻留器 | `exercises/typescript/interning/02-intermediate.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

Exercise files: Rust `exercises/rust/src/interning.rs` · Go `exercises/go/interning_test.go` · Python `exercises/python/test_interning.py`

## 何时使用

- **编译器和解释器** — 驻留标识符、关键字和类型描述符以实现快速相等性检查
- **数据库查询引擎** — 驻留列名、表名以加速查询规划中的比较
- **序列化** — 驻留 JSON/XML 中重复的字段名以减少内存
- **游戏引擎** — 驻留资源名称、材质 ID、动画状态
- **字符串密集型工作负载** — 任何需要比较相同字符串数百万次的系统

## 何时不用

- **短生命周期字符串** — 如果字符串被快速创建和丢弃，驻留开销大于收益
- **大多数字符串唯一** — 如果很少有重复字符串，驻留表浪费内存而不节省比较
- **有清理需求的内存受限场景** — 经典驻留表单调增长；如果需要清理，考虑弱引用

## 更多生产案例

- [Java String.intern()](https://github.com/openjdk/jdk) — JVM 级别的字符串池驻留
- [V8 Internalized Strings](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/objects/string.h) — V8 驻留用作属性名的字符串以实现 O(1) 属性查找
- [Ruby Symbol](https://github.com/ruby/ruby) — `Symbol` 是永不被垃圾回收的驻留字符串
- [LLVM StringPool](https://github.com/llvm/llvm-project) — 编译器管线中标识符的驻留字符串

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [享元 / 驻留 (Flyweight / Interning)](/zh/patterns/flyweight/) | 驻留是享元背后的机制——去重相同的不可变值 |
| [LRU 缓存 (LRU Cache)](/zh/patterns/lru-cache/) | 驻留表可以使用 LRU 淘汰来限制内存使用 |
| [布隆过滤器 (Bloom Filter)](/zh/patterns/bloom-filter/) | 布隆过滤器可以在昂贵的驻留表查找前做预检查 |

## 挑战题

::: details Q1: 你的编译器驻留了 100,000 个标识符。与存储原始字符串相比，驻留如何影响内存？
**答案：** 每个唯一字符串在驻留表中只存储一次。每个引用是一个 `u32`（4 字节），而不是指针 + 长度 + 堆分配（在 64 位系统上通常每个字符串 24+ 字节）。

如果平均标识符是 12 个字符且有 5 倍重复，原始存储成本 100,000 * (24 + 12) = 3.6MB。使用驻留，你存储 20,000 个唯一字符串（720KB）+ 100,000 个 ID 各 4 字节（400KB）= 1.12MB。内存减少约 3 倍，外加 O(1) 的相等性检查。
:::

::: details Q2: Ruby Symbol 被驻留且永不被垃圾回收。有什么安全风险？
**答案：** 攻击者可以通过生成无限的唯一 Symbol（例如通过 `to_sym` 将用户输入转换为 Symbol）来耗尽服务器内存。由于 Symbol 永不被 GC，每个唯一输入都会永久占用内存。

Symbol 表耗尽是 Ruby 中已知的攻击向量（相关漏洞包括 JSON gem 中的 CVE-2013-0269）。修复方法：永远不要驻留用户控制的输入。对外部数据使用字符串，仅对已知常量使用 Symbol。Ruby 2.2+ 引入了"可回收 Symbol"——动态创建的 Symbol（包括通过 `to_sym`）现在可以被垃圾回收。只有源码中直接出现的字面量 Symbol 仍是不可回收的。
:::

::: details Q3: 为什么 Rust 编译器使用 u32 而不是 u64 或 usize 作为 Symbol？
**答案：** u32 将编译器限制在约 40 亿个唯一 Symbol，对任何真实程序都绰绰有余。好处是每个 `Symbol` 只有 4 字节——在 64 位系统上是 `u64` 的一半。

由于 Symbol 出现在编译器数据结构的各处（AST 节点、类型、作用域），将其大小减半能带来有意义的缓存效率提升。这是刻意的空间-时间权衡：编译器性能受内存带宽限制，更小的数据 = 更少的缓存未命中。
:::

::: details Q4: 你的多线程应用使用互斥锁保护的全局字符串驻留器。性能分析显示驻留锁是最大的竞争热点。如何在不放弃驻留的前提下降低竞争？
**答案：** 热路径使用线程局部（thread-local）驻留器，仅在需要跨线程比较时才合并到全局表。

单一全局驻留器在多线程并发驻留时会成为序列化瓶颈。解决方案是分片或线程局部驻留：每个线程维护自己的驻留器，实现快速、无锁的驻留。不同线程局部驻留器的符号不能直接比较，所以跨线程比较需要合并步骤或两级方案（本地 ID + 线程 ID）。Rust 编译器使用每个会话的作用域驻留器，一些 JVM 使用带条带锁的并发哈希表来降低竞争。关键洞察是大多数相等性检查都是线程局部的（在单个编译单元或查询内），因此为每次驻留付出全局同步的代价是浪费的。
:::
