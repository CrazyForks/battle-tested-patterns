---
description: "Process sequences one element at a time without materializing the entire collection, enabling composable transformations with zero intermediate allocations."
difficulty: "beginner"
---

# Pattern: Iterator / Lazy Evaluation

<DifficultyBadge />

## One Liner

Process sequences one element at a time without materializing the entire collection, enabling composable transformations with zero intermediate allocations.

<DemoBadge />

## Real-World Analogy

A deck of cards held face-down. You draw one card at a time without knowing what's underneath. You don't need to spread out the entire deck — you just keep drawing until you're done or decide to stop.

## Core Idea

An iterator is an object that produces values one at a time via a `next()` method. Transformations (map, filter, fold) are chained lazily — nothing executes until a terminal operation (collect, for-each) drives the chain.

```mermaid
flowchart LR
    S["Source\n[1,2,...,10]"] --> F["filter\n(isOdd)"] --> M["map\n(×10)"] --> T["take(3)"] --> C["collect\n[10,30,50]"]
```

No intermediate arrays are created. Each element flows through the entire chain before the next one starts. `take(3)` stops after 3 results — elements 6-10 are never touched.

| Property | Value |
|----------|-------|
| next() | O(1) per element — one step through the pipeline |
| Memory | O(1) — no intermediate collections, one element at a time |
| Short-circuit | `take(k)` stops early — only k elements are processed |
| Composability | Chain map/filter/fold without allocating intermediate arrays |

**Try it yourself** — step through array and tree iterators, watching elements get visited one at a time:

<IteratorViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| Rust stdlib | [iterator.rs#L68-L112](https://github.com/rust-lang/rust/blob/main/library/core/src/iter/traits/iterator.rs#L68-L112) | The `Iterator` trait — `next()` (line 78) is the single required method. `map` (line 831), `filter` (line 952), `fold`, `collect` are all built on top. This is the foundation of Rust's zero-cost abstraction for sequences. |
| Python | [genobject.c#L259-L374](https://github.com/python/cpython/blob/main/Objects/genobject.c#L259-L374) | `gen_send_ex2` (L259-L324) — core generator send: pushes arg onto frame stack, calls `_PyEval_EvalFrame`, distinguishes yield vs return. `gen_send_ex` (L329-L374) validates generator state (CREATED/EXECUTING/FINISHED) before delegating. |

## Implementation

::: code-group

```typescript [TypeScript]
class Iter<T> {
  constructor(private source: () => Generator<T>) {}

  static from<T>(items: T[]): Iter<T> {
    return new Iter(function* () { yield* items; });
  }

  map<U>(fn: (x: T) => U): Iter<U> {
    const source = this.source;
    return new Iter(function* () {
      for (const item of source()) yield fn(item);
    });
  }

  filter(pred: (x: T) => boolean): Iter<T> {
    const source = this.source;
    return new Iter(function* () {
      for (const item of source()) if (pred(item)) yield item;
    });
  }

  take(n: number): Iter<T> {
    const source = this.source;
    return new Iter(function* () {
      let i = 0;
      for (const item of source()) {
        if (i++ >= n) break;
        yield item;
      }
    });
  }

  collect(): T[] {
    return [...this.source()];
  }

  fold<U>(init: U, fn: (acc: U, x: T) => U): U {
    let acc = init;
    for (const item of this.source()) acc = fn(acc, item);
    return acc;
  }
}
```

```rust [Rust]
// Rust's Iterator trait is built-in. Usage:
fn example() {
    let result: Vec<i32> = (1..=10)
        .filter(|x| x % 2 == 0)
        .map(|x| x * x)
        .collect();
    // [4, 16, 36, 64, 100] — no intermediate Vec allocated
}
```

```go [Go]
// Go 1.23+ iter.Seq for lazy iteration
package iterator

import "iter"

func Filter[T any](seq iter.Seq[T], pred func(T) bool) iter.Seq[T] {
	return func(yield func(T) bool) {
		for v := range seq {
			if pred(v) && !yield(v) {
				return
			}
		}
	}
}

func Map[T, U any](seq iter.Seq[T], fn func(T) U) iter.Seq[U] {
	return func(yield func(U) bool) {
		for v := range seq {
			if !yield(fn(v)) {
				return
			}
		}
	}
}

func Take[T any](seq iter.Seq[T], n int) iter.Seq[T] {
	return func(yield func(T) bool) {
		i := 0
		for v := range seq {
			if i >= n || !yield(v) {
				return
			}
			i++
		}
	}
}

func Collect[T any](seq iter.Seq[T]) []T {
	var out []T
	for v := range seq {
		out = append(out, v)
	}
	return out
}

// Usage: lazy pipeline — only processes 5 elements to find 3 odd ones
// source := slices.Values([]int{1,2,3,4,5,6,7,8,9,10})
// result := Collect(Take(Map(Filter(source, isOdd), times10), 3))
// → [10, 30, 50]
```

```python [Python]
# Python generators are native lazy iterators
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

# Take first 10 even Fibonacci numbers — lazy, infinite-safe
evens = (x for x in fibonacci() if x % 2 == 0)
first_10 = [next(evens) for _ in range(10)]
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a lazy iterator with map, filter, collect | `exercises/typescript/iterator/01-basic.test.ts` |
| Intermediate | Lazy pipeline with flatMap, take, and reduce | `exercises/typescript/iterator/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/iterator.rs` · Go `exercises/go/iterator_test.go` · Python `exercises/python/test_iterator.py`

## When to Use

- **Large/infinite sequences** — process millions of rows without loading all into memory
- **Composable pipelines** — chain transformations without intermediate allocations
- **Early termination** — `take(5)` on a billion-element source only processes 5
- **Stream processing** — files, network data, event streams

## When NOT to Use

- **Random access** — iterators are sequential; use arrays/vectors for index-based access
- **Multiple passes** — most iterators are single-use; use a collection if you need to traverse twice
- **Simple loops** — a plain `for` loop is clearer than a one-step iterator chain

## More Production Uses

- [Java Streams](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/stream/Stream.java) — lazy pipeline with intermediate/terminal operations
- [C# LINQ](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Linq/src/System/Linq/Enumerable.cs) — deferred query execution over `IEnumerable<T>`
- [GHC Haskell](https://github.com/ghc/ghc) — lazy lists are the default; every `[a]` is an iterator
- [Kotlin Sequences](https://github.com/JetBrains/kotlin/blob/master/libraries/stdlib/src/kotlin/collections/Sequences.kt) — lazy evaluation analogous to Java Streams
- [Swift LazySequence](https://github.com/swiftlang/swift/blob/main/stdlib/public/core/LazySequence.swift) — `.lazy` adapter for deferred computation

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Merge Iterator (K-Way Merge)](/patterns/merge-iterator/) | Merge iterator composes multiple iterators into one sorted output |
| [Visitor](/patterns/visitor/) | Both traverse data structures — iterators yield elements, visitors dispatch callbacks |
| [Middleware](/patterns/middleware-chain/) | Middleware chains iterate through handler sequences |
| [Dependency Graph](/patterns/dependency-graph/) | Topological iteration over dependency graphs uses the iterator pattern for traversal |

## Challenge Questions

::: details Q1: You create an infinite iterator `fibonacci()` and call `.collect()` on it. What happens?
**Answer:** The program runs until it exhausts memory and crashes — `collect()` tries to materialize an infinite sequence into a finite array.

Infinite iterators are only safe with operations that consume a bounded number of elements: `take(n)`, `find()`, `any()`, `first()`. Terminal operations like `collect()`, `count()`, or `fold()` attempt to consume every element and will never terminate on an infinite source. This is why lazy evaluation requires discipline: the chain must include a bounding combinator before any materializing terminal. Rust's type system does not prevent this — it's a runtime issue.
:::

::: details Q2: You have `iter.filter(expensiveCheck).take(5).collect()`. Does `expensiveCheck` run on all elements or only until 5 pass?
**Answer:** `expensiveCheck` runs only until 5 elements pass the filter — then `take` stops pulling from the source.

This is the power of lazy evaluation: `take(5)` pulls from `filter`, which pulls from the source, one element at a time. Once `take` has accumulated 5 passing elements, it stops requesting more. If only 1 in 10 elements passes the filter, `expensiveCheck` runs on roughly 50 elements (to find 5 that pass), not 1 million. This demand-driven execution is why lazy iterators excel at early termination — no wasted work.
:::

::: details Q3: You try to iterate over the same iterator twice. The second loop produces no elements. Why, and how do you fix it?
**Answer:** Most iterators are single-use — once consumed, their internal cursor is at the end and `next()` returns `None`/`done` forever.

An iterator is a stateful cursor, not a collection. After the first loop exhausts it, the state is permanently "finished." To iterate twice, you need either: (1) create a new iterator from the original source (`source.iter()` called twice), (2) collect into a collection first and iterate the collection, or (3) use a "replayable" abstraction like Kotlin's `Sequence` or Rust's `IntoIterator` on a collection (which creates a fresh iterator each time). Python generators have the same single-use constraint.
:::

::: details Q4: Two consumers need to process the same stream of events — one filters for errors, the other counts totals. Can they share a single iterator?
**Answer:** No, a single iterator has one cursor. You need either `tee` (clone the iterator) or a broadcast pattern (observer) to feed multiple consumers.

Python's `itertools.tee` creates N independent iterators from one source by buffering elements that one consumer has read but others haven't. The catch: if one consumer is much faster than the other, the buffer grows unboundedly. For truly independent consumption of a live stream, the observer/pub-sub pattern is more appropriate — the source pushes to all subscribers rather than subscribers pulling from a shared cursor. Iterators are fundamentally single-consumer; multiple consumers need a fan-out mechanism.
:::
