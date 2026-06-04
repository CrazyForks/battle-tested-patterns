---
description: "Components register themselves into a global lookup table by name — consumers discover implementations at runtime without hardcoded dependencies."
difficulty: "beginner"
---

# Pattern: Registry / Self-Registration

<DifficultyBadge />

## One Liner

Components register themselves into a global lookup table by name -- consumers discover implementations at runtime without hardcoded dependencies.

<DemoBadge />

## Real-World Analogy

A hotel front desk. Guests check in with their name, and anyone can ask the desk 'which room is Alice in?' The desk doesn't care what happens in the rooms — it just maps names to locations.

## Core Idea

A registry is a central map from names (strings) to implementations (functions, classes, factories). Producers register themselves at startup -- often via decorators, macros, or init functions. Consumers look up implementations by name at runtime, eliminating compile-time coupling. This enables plugin architectures where new functionality can be added without modifying existing code.

```text
  Registration (startup):

  ┌──────────┐    register("json")    ┌────────────────────┐
  │ JsonCodec│─────────────────────►  │     Registry       │
  └──────────┘                        │                    │
  ┌──────────┐    register("xml")     │  "json" → JsonCodec│
  │ XmlCodec │─────────────────────►  │  "xml"  → XmlCodec │
  └──────────┘                        │  "csv"  → CsvCodec │
  ┌──────────┐    register("csv")     │                    │
  │ CsvCodec │─────────────────────►  └────────────────────┘
  └──────────┘
                                             │
  Lookup (runtime):                          │
                                             ▼
  ┌──────────┐    get("json")         ┌────────────┐
  │ Consumer │─────────────────────►  │ JsonCodec  │
  └──────────┘                        └────────────┘
```

| Property | Value |
|----------|-------|
| Register | O(1) -- hash map insert |
| Lookup | O(1) -- hash map get |
| Coupling | Zero compile-time dependency between producer and consumer |
| Extensibility | Add new implementations without modifying existing code |

**Try it yourself** — register handlers by name and look them up at runtime:

<RegistryViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| TensorFlow | [op.h#L258-L290](https://github.com/tensorflow/tensorflow/blob/master/tensorflow/core/framework/op.h#L258-L290) | `REGISTER_OP` macro registers a new operation into the global `OpRegistry`. Each op defines its name, inputs, outputs, and shape function. The runtime looks up ops by name when building computation graphs, so new ops can be added without touching the graph executor. |
| gRPC-Go | [server.go#L154-L170](https://github.com/grpc/grpc-go/blob/master/server.go#L154-L170) | `RegisterService` adds a service description (methods, handler functions) to the server's service map. When an RPC arrives, the server looks up the method in this registry to dispatch to the correct handler. Services self-register during init. |

## Implementation

::: code-group

```typescript [TypeScript]
type Factory<T> = (...args: any[]) => T;

class Registry<T> {
  private entries = new Map<string, Factory<T>>();

  register(name: string, factory: Factory<T>): void {
    if (this.entries.has(name)) {
      throw new Error(`"${name}" is already registered`);
    }
    this.entries.set(name, factory);
  }

  get(name: string): Factory<T> {
    const factory = this.entries.get(name);
    if (!factory) {
      throw new Error(`"${name}" is not registered`);
    }
    return factory;
  }

  create(name: string, ...args: any[]): T {
    return this.get(name)(...args);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  list(): string[] {
    return [...this.entries.keys()];
  }
}
```

```go [Go]
type Factory func(args ...any) any

type Registry struct {
	mu      sync.RWMutex
	entries map[string]Factory
}

func NewRegistry() *Registry {
	return &Registry{entries: make(map[string]Factory)}
}

func (r *Registry) Register(name string, factory Factory) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.entries[name]; ok {
		return fmt.Errorf("%q is already registered", name)
	}
	r.entries[name] = factory
	return nil
}

func (r *Registry) Get(name string) (Factory, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	factory, ok := r.entries[name]
	if !ok {
		return nil, fmt.Errorf("%q is not registered", name)
	}
	return factory, nil
}

func (r *Registry) Create(name string, args ...any) (any, error) {
	factory, err := r.Get(name)
	if err != nil {
		return nil, err
	}
	return factory(args...), nil
}

func (r *Registry) Has(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.entries[name]
	return ok
}

func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.entries))
	for name := range r.entries {
		names = append(names, name)
	}
	return names
}
```

```python [Python]
from typing import Any, Callable

class Registry:
    def __init__(self):
        self._entries: dict[str, Callable[..., Any]] = {}

    def register(self, name: str, factory: Callable[..., Any]) -> None:
        if name in self._entries:
            raise ValueError(f'"{name}" is already registered')
        self._entries[name] = factory

    def get(self, name: str) -> Callable[..., Any]:
        if name not in self._entries:
            raise KeyError(f'"{name}" is not registered')
        return self._entries[name]

    def create(self, name: str, *args: Any, **kwargs: Any) -> Any:
        return self.get(name)(*args, **kwargs)

    def has(self, name: str) -> bool:
        return name in self._entries

    def list(self) -> list[str]:
        return list(self._entries.keys())

    def decorator(self, name: str):
        """Use as @registry.decorator("name") to auto-register."""
        def wrapper(cls):
            self.register(name, cls)
            return cls
        return wrapper
```

```rust [Rust]
use std::collections::HashMap;

pub struct Registry<T> {
    entries: HashMap<String, Box<dyn Fn() -> T>>,
}

impl<T> Registry<T> {
    pub fn new() -> Self {
        Registry { entries: HashMap::new() }
    }

    pub fn register<F: Fn() -> T + 'static>(
        &mut self, name: &str, factory: F,
    ) -> Result<(), String> {
        if self.entries.contains_key(name) {
            return Err(format!("\"{}\" is already registered", name));
        }
        self.entries.insert(name.to_string(), Box::new(factory));
        Ok(())
    }

    pub fn create(&self, name: &str) -> Result<T, String> {
        self.entries.get(name)
            .map(|f| f())
            .ok_or_else(|| format!("\"{}\" is not registered", name))
    }

    pub fn has(&self, name: &str) -> bool {
        self.entries.contains_key(name)
    }

    pub fn list(&self) -> Vec<&str> {
        self.entries.keys().map(|s| s.as_str()).collect()
    }
}
```

:::

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | Implement a typed registry with register/get/list | `exercises/typescript/registry/01-basic.test.ts` |
| Intermediate | Add decorator-based auto-registration and dependency validation | `exercises/typescript/registry/02-intermediate.test.ts` |

Run exercises: `pnpm test` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/registry.rs` · Go `exercises/go/registry_test.go` · Python `exercises/python/test_registry.py`

## When to Use

- **Plugin systems** -- load and discover plugins by name without compile-time coupling
- **Serialization codecs** -- register JSON, XML, Protobuf codecs; look up by content-type
- **Command/handler dispatch** -- CLI commands, RPC methods, event handlers register themselves
- **Test fixtures** -- register test factories by name for parameterized tests
- **ML framework ops** -- TensorFlow, PyTorch register operators that can be composed into graphs

## When NOT to Use

- **Few fixed implementations** -- if there are only 2-3 known implementations, a switch/match is simpler
- **Type safety is critical** -- string-based lookup loses compile-time type checking; use dependency injection or generics instead
- **Order matters** -- registries are typically unordered; if initialization order is important, use explicit sequencing

## More Production Uses

- [Terraform](https://github.com/hashicorp/terraform) -- provider registry: each cloud provider registers resource types and data sources
- [Babel](https://github.com/babel/babel) -- plugin registry: transforms register themselves by visitor pattern name
- [pytest](https://github.com/pytest-dev/pytest) -- fixture registry: `@pytest.fixture` registers functions discoverable by parameter name
- [Docker](https://github.com/moby/moby) -- driver registry: storage, network, and logging drivers register at daemon startup

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Middleware](/patterns/middleware-chain/) | Middleware handlers often register themselves into a registry |
| [Dependency Graph](/patterns/dependency-graph/) | Registries can track dependencies between registered components |
| [Consistent Hashing](/patterns/consistent-hashing/) | Service registries feed consistent hashing with available node lists |
| [Trie (Prefix Tree)](/patterns/trie/) | Tries can serve as the underlying lookup structure for prefix-based registry queries |

## Challenge Questions

::: details Q1: Two plugins both try to register the name "json". What should happen?
**Answer:** Fail fast with an error at registration time.

Silent overwrite hides bugs -- the first plugin's handler disappears without warning, causing subtle runtime failures. "Last writer wins" policies work for configuration but are dangerous for code dispatch.

The correct approach: throw/return an error on duplicate registration. If intentional replacement is needed, provide an explicit `override()` or `replace()` method that signals intent.
:::

::: details Q2: Your registry uses string keys. How do you prevent typos like "josn" instead of "json" from causing runtime errors?
**Answer:** Multiple strategies:

1. **Constants**: Define keys as exported constants (`const JSON = "json"`) so the compiler catches typos.
2. **Enums**: Use an enum type instead of raw strings -- limits the key space at compile time.
3. **Registration validation**: At startup, verify all expected keys are registered before accepting traffic.
4. **Fuzzy matching**: On lookup failure, suggest similar registered names (Levenshtein distance).

The best approach depends on whether the registry is open (plugins add keys) or closed (keys are known at compile time). Closed registries should use enums; open registries should validate at startup.
:::

::: details Q3: TensorFlow's REGISTER_OP uses a C++ macro to register ops at static initialization time. What's the risk?
**Answer:** The static initialization order fiasco.

In C++, the order of static initialization across translation units is undefined. If op A's registration depends on op B being registered first, and they're in different .cc files, the program may crash or silently fail.

TensorFlow mitigates this by making registration order-independent -- each op registers itself with no dependencies on other ops. The `OpRegistry` singleton is created on first use (Meyers' singleton), avoiding the "static initialization order fiasco" for the registry itself.
:::

::: details Q4: How does a registry differ from dependency injection (DI)?
**Answer:** Control flow direction.

- **Registry**: The consumer actively pulls an implementation by name. The consumer knows the name and calls `registry.get("json")`.
- **DI**: The framework pushes dependencies into the consumer. The consumer declares what it needs (via constructor params or annotations), and the DI container wires it up.

Registry is simpler but couples the consumer to the registry API and string names. DI decouples further but adds framework complexity. In practice, DI containers often use an internal registry under the hood.
:::
