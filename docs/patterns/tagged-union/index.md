---
title: "Pattern: Tagged Union / Variant"
description: "Store a type tag alongside a value union so one variable safely holds different types, dispatching behavior via the tag."
difficulty: "beginner"
---

# Pattern: Tagged Union / Variant

<DifficultyBadge />

## One Liner

Store a type tag alongside a value union so one variable safely holds different types, dispatching behavior via the tag.

<DemoBadge />

## Real-World Analogy

A shipping label on a package. The label says 'fragile', 'perishable', or 'standard', and the warehouse handles each type differently. The label (tag) determines the handling procedure (dispatch) — one system, multiple behaviors.

## Core Idea

A tagged union (also called a variant, discriminated union, or sum type) pairs a type discriminator with a value payload. At runtime, code inspects the tag to determine which type the value actually is, then dispatches to the correct handler. This is the manual foundation behind TypeScript discriminated unions, Rust enums, and algebraic data types.

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

| Property | Value |
|----------|-------|
| Memory | Size of tag + size of largest variant |
| Type safety | Exhaustive switch ensures all cases handled |
| Extension | Add a new tag + handler (open to extension) |
| Zero-cost? | In C/Rust: yes (enum tag + union). In JS/Python: object overhead |

**Try it yourself** — switch between variant types and see tag-based dispatch in action:

<TaggedUnionViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Godot Engine | [variant.h#L78-L120](https://github.com/godotengine/godot/blob/ec67cbe92628bdaf979b10594359ba6f02cf8838/core/variant/variant.h#L78-L120) | `Variant::Type` enum (L78-L108) lists 38 types (NIL, BOOL, INT, FLOAT, STRING, VECTOR2, ...). The `Variant` class stores a `Type` tag and a union of all possible values. Every GDScript value is a `Variant` — the engine dispatches operations via the tag. |
| PyTorch | [ivalue.h#L51-L96](https://github.com/pytorch/pytorch/blob/cef26d1e97fcb9dd61b4471f9bd7fa9a32bd42b9/aten/src/ATen/core/ivalue.h#L51-L96) | `IValue` (Interpreter Value) holds a tag (`Tag` enum: Tensor, Int, Double, Bool, String, List, Dict, etc.) and a `Payload` union. The TorchScript interpreter uses tag-based dispatch for all operations on heterogeneous values. |

## Implementation

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

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement tagged values with type dispatch | `exercises/typescript/tagged-union/01-basic.test.ts` |
| Intermediate | JSON-like value type with nested arrays/objects | `exercises/typescript/tagged-union/02-intermediate.test.ts` |

Run exercises: `pnpm test:ts` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/tagged_union/mod.rs` · Go `exercises/go/tagged_union/tagged_union_test.go` · Python `exercises/python/tagged_union/test_tagged_union.py`

## When to Use

- **Scripting language values** — a single Value type holds numbers, strings, arrays, etc. (Godot Variant, Lua TValue)
- **Serialization formats** — JSON, MessagePack, Protocol Buffers oneof fields
- **Compiler IRs** — AST nodes, instruction operands, interpreter values
- **Configuration systems** — settings that can be string, number, boolean, or list
- **Database drivers** — column values of varying SQL types in a single interface

## When NOT to Use

- **Homogeneous collections** — if everything is the same type, a plain array is simpler
- **Performance-critical inner loops** — tag dispatch has branch overhead; use concrete types when the type is known statically
- **Deep hierarchies** — if you need 50+ variants with complex behavior, consider a class hierarchy or trait objects instead

## More Production Uses

- [V8 Engine](https://github.com/v8/v8/blob/02a623d69f6ba69f513ae2c7aef84b9914fbde51/src/objects/tagged-value.h) — JavaScript values use tagged pointers to distinguish Smis (small integers) from heap objects
- [SQLite](https://github.com/sqlite/sqlite) — internal `Mem` struct stores type tag + value union for all SQL types
- [Lua TValue](https://github.com/lua/lua) — every Lua value is a `TValue` with a type tag and `Value` union
- [GHC Haskell](https://github.com/ghc/ghc) — algebraic data types compile to tagged heap objects

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Vtable](/patterns/vtable/) | Both enable runtime polymorphism — tagged unions via switch, vtables via function pointers |
| [Bitmask](/patterns/bitmask/) | Bitmask flags can serve as type tags in lightweight tagged union implementations |
| [Visitor](/patterns/visitor/) | Visitors dispatch on node types, which are often represented as tagged unions |

## Challenge Questions

::: details Q1: You have a tagged union with 4 types. How many bytes does the value occupy in C if the largest variant is 24 bytes?
**Answer:** The union size equals the largest member: 24 bytes. Add the tag (typically 4 bytes with padding) and you get 28 or 32 bytes total depending on alignment.

Key insight: In a union, all variants share the same memory. The compiler allocates enough space for the largest one. The tag is stored separately (not inside the union), so total size = sizeof(tag) + padding + sizeof(largest_variant).
:::

::: details Q2: TypeScript has discriminated unions built-in. Why would you still implement a tagged union manually?
**Answer:** TypeScript's discriminated unions only exist at compile time — they're erased to plain JavaScript objects at runtime. If you need runtime type checking (e.g., deserializing JSON from an API, or a plugin system where types aren't known at compile time), you need an explicit tag field that survives into runtime.

Also, when storing heterogeneous values in a database, serialization format, or cross-language boundary, you need a physical tag — TypeScript's type system can't help there.
:::

::: details Q3: Godot's Variant has 38 type tags. What's the risk of adding more tags over time?
**Answer:** Every function that switches on the tag must handle the new case. If any switch is not exhaustive, you get a runtime error or silent bug. This is the "expression problem" — adding new types is easy (add a tag), but you must update every operation.

Mitigation strategies: (1) Exhaustive switch warnings in the compiler, (2) A default/fallback case, (3) Visitor pattern to centralize dispatch, (4) Rust's `match` enforces exhaustiveness at compile time.
:::

::: details Q4: What's the difference between a tagged union and a class hierarchy for polymorphism?
**Answer:** Tagged unions are *closed* — all variants are known upfront and dispatched via a switch. Class hierarchies are *open* — you can add subclasses without modifying existing code, dispatched via vtable.

Tradeoffs: Tagged unions make it easy to add new *operations* (just write a new switch). Class hierarchies make it easy to add new *types* (just add a subclass). This is the classic expression problem. Tagged unions are better for data-oriented designs (serialization, interpreters), while class hierarchies suit behavior-oriented designs (UI widgets, game entities).
:::
