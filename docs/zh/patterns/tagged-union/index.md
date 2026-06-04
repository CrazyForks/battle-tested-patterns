---
description: "将类型标签与值联合体配对存储，使一个变量安全地持有不同类型，通过标签分发行为。"
difficulty: "beginner"
---

# 模式：标签联合体 (Tagged Union / Variant)

<DifficultyBadge />

## 一句话

将类型标签与值联合体配对存储，使一个变量安全地持有不同类型，通过标签分发行为。

<DemoBadge />

## 现实类比

快递包裹上的标签。标签写着「易碎」「生鲜」或「普通」，仓库根据不同标签采取不同处理方式。标签（tag）决定处理流程（dispatch）——一套系统，多种行为。

## 核心思想

标签联合体（也称 Variant、可辨识联合体或和类型）将类型判别器与值载荷配对。运行时代码检查标签来确定值的实际类型，然后分发到正确的处理器。这是 TypeScript 可辨识联合体、Rust enum 和代数数据类型背后的手动基础。

```text
  TaggedValue
  ┌────────┬───────────────────┐
  │  tag   │      value        │
  ├────────┼───────────────────┤
  │ NUMBER │  42               │
  │ STRING │  "hello"          │
  │ ARRAY  │  [val, val, ...]  │
  │ OBJECT │  {key: val, ...}  │
  └────────┴───────────────────┘

  Dispatch:
  switch (v.tag) {
    NUMBER → handle as number
    STRING → handle as string
    ARRAY  → recurse into children
    OBJECT → iterate key-value pairs
  }
```

| 属性 | 值 |
|------|------|
| 内存 | tag 大小 + 最大变体的大小 |
| 类型安全 | 穷举 switch 确保所有情况被处理 |
| 扩展性 | 添加新 tag + 处理器（对扩展开放） |
| 零开销? | C/Rust 中：是（enum tag + union）。JS/Python 中：对象开销 |

**动手试试** — 切换不同的变体类型，观察基于标签的分发：

<TaggedUnionViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Godot Engine | [variant.h#L78-L120](https://github.com/godotengine/godot/blob/master/core/variant/variant.h#L78-L120) | `Variant::Type` 枚举（L78-L108）列出 38 种类型（NIL、BOOL、INT、FLOAT、STRING、VECTOR2 等）。`Variant` 类存储 `Type` 标签和所有可能值的 union。每个 GDScript 值都是 `Variant`——引擎通过标签分发操作。 |
| PyTorch | [ivalue.h#L51-L96](https://github.com/pytorch/pytorch/blob/main/aten/src/ATen/core/ivalue.h#L51-L96) | `IValue`（解释器值）持有标签（`Tag` 枚举：Tensor、Int、Double、Bool、String、List、Dict 等）和 `Payload` union。TorchScript 解释器对异构值的所有操作使用基于标签的分发。 |

## 实现

::: code-group

```typescript [TypeScript]
type Tag = 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object';

interface TaggedValue {
  tag: Tag;
  value: null | boolean | number | string | TaggedValue[] | Record<string, TaggedValue>;
}

function stringify(tv: TaggedValue): string {
  switch (tv.tag) {
    case 'null': return 'null';
    case 'boolean': return String(tv.value);
    case 'number': return String(tv.value);
    case 'string': return `"${tv.value}"`;
    case 'array': {
      const items = (tv.value as TaggedValue[]).map(stringify);
      return `[${items.join(',')}]`;
    }
    case 'object': {
      const obj = tv.value as Record<string, TaggedValue>;
      const pairs = Object.keys(obj).map(k => `"${k}":${stringify(obj[k])}`);
      return `{${pairs.join(',')}}`;
    }
  }
}
```

```go [Go]
type Tag int

const (
	TagNull Tag = iota
	TagBool
	TagNumber
	TagString
)

type TaggedValue struct {
	Tag    Tag
	Bool   bool
	Number float64
	Str    string
}

func Display(tv TaggedValue) string {
	switch tv.Tag {
	case TagNull:
		return "null"
	case TagBool:
		if tv.Bool {
			return "true"
		}
		return "false"
	case TagNumber:
		return fmt.Sprintf("%g", tv.Number)
	case TagString:
		return fmt.Sprintf("%q", tv.Str)
	default:
		return "unknown"
	}
}
```

```python [Python]
from dataclasses import dataclass
from typing import Union

@dataclass
class TaggedValue:
    tag: str  # "null", "bool", "number", "string"
    value: Union[None, bool, int, float, str]

def display(tv: TaggedValue) -> str:
    if tv.tag == "null":
        return "null"
    elif tv.tag == "bool":
        return str(tv.value).lower()
    elif tv.tag == "number":
        return str(tv.value)
    elif tv.tag == "string":
        return f'"{tv.value}"'
    raise ValueError(f"Unknown tag: {tv.tag}")

def try_add(a: TaggedValue, b: TaggedValue) -> TaggedValue | None:
    if a.tag != "number" or b.tag != "number":
        return None
    return TaggedValue("number", a.value + b.value)
```

```rust [Rust]
enum Value {
    Null,
    Bool(bool),
    Number(f64),
    Str(String),
}

impl Value {
    fn display(&self) -> String {
        match self {
            Value::Null => "null".to_string(),
            Value::Bool(b) => b.to_string(),
            Value::Number(n) => n.to_string(),
            Value::Str(s) => format!("\"{}\"", s),
        }
    }

    fn try_add(&self, other: &Value) -> Option<Value> {
        match (self, other) {
            (Value::Number(a), Value::Number(b)) => Some(Value::Number(a + b)),
            _ => None,
        }
    }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带类型分发的标签值容器 | `exercises/typescript/tagged-union/01-basic.test.ts` |
| 进阶 | 支持嵌套数组/对象的 JSON 值类型 | `exercises/typescript/tagged-union/02-intermediate.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

Exercise files: Rust `exercises/rust/src/tagged_union.rs` · Go `exercises/go/tagged_union_test.go` · Python `exercises/python/test_tagged_union.py`

## 何时使用

- **脚本语言值** — 单一 Value 类型持有数字、字符串、数组等（Godot Variant、Lua TValue）
- **序列化格式** — JSON、MessagePack、Protocol Buffers oneof 字段
- **编译器 IR** — AST 节点、指令操作数、解释器值
- **配置系统** — 设置可以是字符串、数字、布尔值或列表
- **数据库驱动** — 不同 SQL 类型的列值用统一接口表示

## 何时不用

- **同构集合** — 如果所有元素都是相同类型，普通数组更简单
- **性能关键的内层循环** — 标签分发有分支开销；当类型在静态时已知时使用具体类型
- **深层次结构** — 如果需要 50+ 个变体且行为复杂，考虑使用类层次结构或 trait 对象

## 更多生产案例

- [V8 Engine](https://github.com/v8/v8/blob/main/src/objects/tagged-value.h) — JavaScript 值使用标签指针区分 Smi（小整数）和堆对象
- [SQLite Value](https://github.com/sqlite/sqlite) — 内部 `Mem` 结构体存储类型标签 + 值 union
- [Lua TValue](https://github.com/lua/lua) — 每个 Lua 值都是带类型标签的 `TValue` + `Value` union
- [GHC Haskell](https://github.com/ghc/ghc) — 代数数据类型编译为标签化的堆对象

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [虚函数表 / 操作分发 (Vtable / Ops Dispatch)](/zh/patterns/vtable/) | 两者都实现运行时多态——标签联合通过 switch，虚函数表通过函数指针 |
| [位掩码 (Bitmask)](/zh/patterns/bitmask/) | 位掩码标志可以在轻量级标签联合实现中充当类型标签 |
| [访问者 / 树遍历器 (Visitor / Tree Walker)](/zh/patterns/visitor/) | 访问者按节点类型分发，而节点类型通常表示为标签联合 |

## 挑战题

::: details Q1: 你有一个包含 4 种类型的标签联合体。在 C 中如果最大的变体是 24 字节，值占多少字节？
**答案：** union 大小等于最大成员：24 字节。加上 tag（通常是 4 字节加填充），总共 28 或 32 字节，取决于对齐。

关键洞察：在 union 中，所有变体共享相同的内存。编译器为最大的那个分配足够的空间。tag 存储在 union 外部，所以总大小 = sizeof(tag) + padding + sizeof(最大变体)。
:::

::: details Q2: TypeScript 有内置的可辨识联合体。为什么还要手动实现标签联合体？
**答案：** TypeScript 的可辨识联合体只存在于编译时——在运行时被擦除为普通 JavaScript 对象。如果你需要运行时类型检查（例如反序列化来自 API 的 JSON，或者类型在编译时未知的插件系统），你需要一个在运行时存活的显式 tag 字段。

此外，当在数据库、序列化格式或跨语言边界存储异构值时，你需要一个物理 tag——TypeScript 的类型系统在那里帮不上忙。
:::

::: details Q3: Godot 的 Variant 有 38 个类型标签。随时间添加更多标签有什么风险？
**答案：** 每个对标签做 switch 的函数都必须处理新情况。如果任何 switch 不是穷举的，你会得到运行时错误或隐式 bug。这就是"表达式问题"——添加新类型很容易（加一个 tag），但你必须更新每个操作。

缓解策略：(1) 编译器的穷举 switch 警告，(2) default/fallback case，(3) Visitor 模式集中分发，(4) Rust 的 `match` 在编译时强制穷举。
:::

::: details Q4: 标签联合体和类层次结构在多态性方面有什么区别？
**答案：** 标签联合体是*封闭的*——所有变体预先已知，通过 switch 分发。类层次结构是*开放的*——可以在不修改现有代码的情况下添加子类，通过 vtable 分发。

权衡：标签联合体便于添加新*操作*（写一个新 switch）。类层次结构便于添加新*类型*（加一个子类）。这是经典的表达式问题。标签联合体更适合面向数据的设计（序列化、解释器），而类层次结构适合面向行为的设计（UI 组件、游戏实体）。
:::
