# 模式：注册表 / 自注册 (Registry)

## 一句话

组件按名称将自身注册到全局查找表——消费者在运行时发现实现，无需硬编码依赖。

## 核心思想

注册表是名称（字符串）到实现（函数、类、工厂）的中心映射。生产者在启动时自注册——通常通过装饰器、宏或 init 函数。消费者在运行时按名称查找实现，消除编译时耦合。这实现了插件架构，新功能无需修改现有代码即可添加。

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

| 属性 | 值 |
|------|------|
| 注册 | O(1) -- 哈希表插入 |
| 查找 | O(1) -- 哈希表查找 |
| 耦合度 | 生产者和消费者之间零编译时依赖 |
| 可扩展性 | 无需修改现有代码即可添加新实现 |

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| TensorFlow | [op.h#L258-L290](https://github.com/tensorflow/tensorflow/blob/master/tensorflow/core/framework/op.h#L258-L290) | `REGISTER_OP` 宏将新操作注册到全局 `OpRegistry`。每个 op 定义名称、输入、输出和形状函数。运行时在构建计算图时按名称查找 op，因此新 op 可以在不修改图执行器的情况下添加。 |
| gRPC-Go | [server.go#L154-L170](https://github.com/grpc/grpc-go/blob/master/server.go#L154-L170) | `RegisterService` 将服务描述（方法、处理函数）添加到服务器的服务映射中。当 RPC 到达时，服务器在此注册表中查找方法以分派到正确的处理程序。服务在 init 期间自注册。 |

## 实现

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

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现带注册/查找/列表的类型化注册表 | `exercises/typescript/registry/01-basic.test.ts` |
| 进阶 | 添加基于装饰器的自注册和依赖验证 | `exercises/typescript/registry/02-intermediate.test.ts` |

## 何时使用

- **插件系统** -- 按名称加载和发现插件，无需编译时耦合
- **序列化编解码器** -- 注册 JSON、XML、Protobuf 编解码器；按内容类型查找
- **命令/处理器分派** -- CLI 命令、RPC 方法、事件处理器自注册
- **测试夹具** -- 按名称注册测试工厂，用于参数化测试
- **ML 框架操作** -- TensorFlow、PyTorch 注册可组合到图中的算子

## 何时不用

- **实现数量少且固定** -- 只有 2-3 个已知实现时，switch/match 更简单
- **类型安全至关重要** -- 基于字符串的查找失去编译时类型检查；改用依赖注入或泛型
- **顺序重要** -- 注册表通常是无序的；如果初始化顺序重要，使用显式排序

## 更多生产案例

- [Terraform](https://github.com/hashicorp/terraform) -- 提供者注册表：每个云提供商注册资源类型和数据源
- [Babel](https://github.com/babel/babel) -- 插件注册表：转换器按访问者模式名称自注册
- [pytest](https://github.com/pytest-dev/pytest) -- 夹具注册表：`@pytest.fixture` 注册可通过参数名发现的函数
- [Docker](https://github.com/moby/moby) -- 驱动注册表：存储、网络和日志驱动在守护进程启动时注册

## 挑战题

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
