---
description: "Deduplicate immutable values through a canonical lookup table — O(1) equality by pointer comparison instead of O(n) content comparison."
---

# Pattern: Interning / Symbol Table

## One Liner

Deduplicate immutable values through a canonical lookup table — O(1) equality by pointer comparison instead of O(n) content comparison.

## Core Idea

Interning stores each unique value exactly once in a table and hands out lightweight identifiers (symbols, IDs, or interned pointers) that refer to the canonical copy. Two values that are structurally equal get the same identifier, so equality checks become O(1) pointer/integer comparisons instead of O(n) content comparisons. This trades upfront deduplication cost for massive savings on repeated equality checks.

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

  Equality: symbol_a == symbol_b  (integer comparison, O(1))
  Instead of: strcmp(str_a, str_b) (character scan, O(n))
```

| Property | Value |
|----------|-------|
| intern() | O(n) first time (hash + store), O(1) amortized on hit |
| Equality | O(1) — integer/pointer comparison |
| Memory | Deduplicated — each unique value stored once |
| Tradeoff | Intern table grows monotonically (values never freed) |

**Try it yourself** — intern strings and see how duplicates resolve to the same ID:

<InterningViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Rust Compiler (rustc) | [symbol.rs#L24-L79](https://github.com/rust-lang/rust/blob/master/compiler/rustc_span/src/symbol.rs#L24-L79) | `Symbol` (L24) is a newtype around `u32` — an index into the global interning table. `Interner` (L56-L79) stores strings in a `Vec` and deduplicates via a `HashMap`. All identifiers in the Rust compiler are `Symbol`s — equality is a single `u32` comparison. |
| CPython | [unicodeobject.c#L15575-L15631](https://github.com/python/cpython/blob/main/Objects/unicodeobject.c#L15575-L15631) | `PyUnicode_InternInPlace` (L15575) interns Python strings by storing them in a global dict. If the string already exists, the existing object is returned and the new one's refcount is decremented. All identifier strings (variable names, attribute names) are interned automatically for O(1) dict lookups. |

## Implementation

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

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a string interner with intern/resolve | `exercises/typescript/interning/01-basic.test.ts` |
| Intermediate | Type interner with structural equality | `exercises/typescript/interning/02-intermediate.test.ts` |

Run exercises: `pnpm test`

## When to Use

- **Compilers and interpreters** — intern identifiers, keywords, and type descriptors for fast equality
- **Database query engines** — intern column names, table names for fast comparison in query planning
- **Serialization** — intern repeated field names in JSON/XML to reduce memory
- **Game engines** — intern asset names, material IDs, animation states
- **String-heavy workloads** — any system that compares the same strings millions of times

## When NOT to Use

- **Short-lived strings** — if strings are created and discarded quickly, interning overhead outweighs benefit
- **Mostly unique strings** — if few strings repeat, the intern table wastes memory without saving comparisons
- **Memory-constrained with no cleanup** — classic interning tables grow monotonically; consider weak references if cleanup is needed

## More Production Uses

- [Java String.intern()](https://github.com/openjdk/jdk) — JVM-level string interning in the string pool
- [V8 Internalized Strings](https://github.com/nicknisi/v8) — V8 interns strings used as property names for O(1) property lookup
- [Ruby Symbol](https://github.com/ruby/ruby) — `Symbol` is an interned string that's never garbage-collected
- [LLVM StringPool](https://github.com/llvm/llvm-project) — interned strings for identifiers across the compiler pipeline

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Flyweight](/patterns/flyweight/) | Interning is the mechanism behind flyweight — deduplicate identical immutable values |
| [LRU Cache](/patterns/lru-cache/) | Intern tables can use LRU eviction to bound memory usage |
| [Bloom Filter](/patterns/bloom-filter/) | Bloom filters can pre-check before expensive intern table lookups |

## Challenge Questions

::: details Q1: Your compiler interns 100,000 identifiers. How does interning affect memory compared to storing raw strings?
**Answer:** Each unique string is stored exactly once in the intern table. Every reference is a `u32` (4 bytes) instead of a pointer + length + heap allocation (typically 24+ bytes per string on 64-bit systems).

If the average identifier is 12 characters with 5x duplication, raw storage costs 100,000 * (24 + 12) = 3.6MB. With interning, you store 20,000 unique strings (720KB) + 100,000 IDs at 4 bytes each (400KB) = 1.12MB. That's ~3x less memory, plus O(1) equality checks.
:::

::: details Q2: Ruby Symbols are interned and never garbage-collected. What's the security risk?
**Answer:** An attacker can exhaust server memory by generating unlimited unique symbols (e.g., converting user input to symbols via `to_sym`). Since symbols are never GC'd, each unique input permanently consumes memory.

This was a real vulnerability (CVE-2013-0156). The fix: never intern user-controlled input. Use strings for external data, symbols only for known constants. Ruby 2.2+ introduced "mortal symbols" that can be GC'd, but `Symbol#to_s.to_sym` still creates immortal ones.
:::

::: details Q3: Why does the Rust compiler use u32 for Symbol instead of u64 or usize?
**Answer:** A u32 limits the compiler to ~4 billion unique symbols, which is more than enough for any real program. The benefit is that every `Symbol` is only 4 bytes — half the size of `u64` on 64-bit systems.

Since symbols appear everywhere in the compiler's data structures (AST nodes, types, scopes), halving their size provides meaningful cache efficiency improvements. This is a deliberate space-time tradeoff: the compiler's performance is memory-bound, so smaller data = fewer cache misses.
:::

::: details Q4: Your multi-threaded application uses a global string interner protected by a mutex. Profiling shows the intern lock is the top contention point. How would you reduce contention without giving up interning?
**Answer:** Use per-thread (thread-local) interners for the hot path, and merge into a global table only when cross-thread comparison is needed.

A single global interner becomes a serialization bottleneck when many threads intern concurrently. The solution is sharded or thread-local interning: each thread maintains its own interner for fast, lock-free interning. Symbols from different thread-local interners are not directly comparable, so cross-thread comparison requires either a merge step or a two-level scheme (local ID + thread ID). The Rust compiler uses a scoped interner per session, and some JVMs use concurrent hash maps with striped locks to reduce contention. The key insight is that most equality checks are thread-local (within a single compilation unit or query), so paying for global synchronization on every intern is wasteful.
:::
