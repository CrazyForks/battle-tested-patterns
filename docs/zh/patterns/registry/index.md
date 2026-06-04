---
description: "组件按名称将自身注册到全局查找表——消费者在运行时发现实现，无需硬编码依赖。"
difficulty: "beginner"
---

# 模式：注册表 / 自注册 (Registry)

<DifficultyBadge />

## 一句话

组件按名称将自身注册到全局查找表——消费者在运行时发现实现，无需硬编码依赖。

<DemoBadge />

## 现实类比

酒店前台。客人用名字登记入住，任何人都可以问前台「Alice 住哪个房间？」前台不关心房间里发生了什么——它只负责名字到房间号的映射。

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

**动手试试** — 按名称注册处理器，并在运行时查找它们：

<RegistryViz />

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

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

Exercise files: Rust `exercises/rust/src/registry.rs` · Go `exercises/go/registry_test.go` · Python `exercises/python/test_registry.py`

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

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [中间件 / 管道链 (Middleware / Pipeline Chain)](/zh/patterns/middleware-chain/) | 中间件处理器通常将自身注册到注册表中 |
| [依赖图 (Dependency Graph)](/zh/patterns/dependency-graph/) | 注册表可以追踪已注册组件之间的依赖关系 |
| [一致性哈希 (Consistent Hashing)](/zh/patterns/consistent-hashing/) | 服务注册表为一致性哈希提供可用节点列表 |
| [字典树 (Trie)](/zh/patterns/trie/) | 字典树可以作为基于前缀的注册表查询的底层查找结构 |

## 挑战题

::: details Q1: 两个插件都尝试注册名称 "json"。应该发生什么？
**答案：** 在注册时快速失败并报错。

静默覆盖会隐藏 bug——第一个插件的处理器无声地消失，导致微妙的运行时故障。"最后写入者获胜"策略适用于配置但对代码分派是危险的。

正确的做法：在重复注册时抛出/返回错误。如果需要有意替换，提供显式的 `override()` 或 `replace()` 方法来表明意图。
:::

::: details Q2: 你的注册表使用字符串键。如何防止像 "josn" 这样的拼写错误导致运行时错误？
**答案：** 多种策略：

1. **常量**：将键定义为导出常量（`const JSON = "json"`），这样编译器能捕获拼写错误。
2. **枚举**：使用枚举类型替代原始字符串——在编译时限制键空间。
3. **注册验证**：启动时验证所有预期的键都已注册，然后再接受流量。
4. **模糊匹配**：查找失败时，建议相似的已注册名称（Levenshtein 距离）。

最佳方法取决于注册表是开放的（插件添加键）还是封闭的（键在编译时已知）。封闭注册表应该使用枚举；开放注册表应该在启动时验证。
:::

::: details Q3: TensorFlow 的 REGISTER_OP 使用 C++ 宏在静态初始化时注册操作。风险是什么？
**答案：** 静态初始化顺序灾难。

在 C++ 中，跨编译单元的静态初始化顺序是未定义的。如果操作 A 的注册依赖于操作 B 先注册，而它们在不同的 .cc 文件中，程序可能崩溃或静默失败。

TensorFlow 通过使注册与顺序无关来缓解这个问题——每个操作独立注册，不依赖其他操作。`OpRegistry` 单例在首次使用时创建（Meyers 单例），避免了注册表本身的"静态初始化顺序灾难"。
:::

::: details Q4: 注册表与依赖注入（DI）有什么区别？
**答案：** 控制流方向不同。

- **注册表**：消费者主动按名称拉取实现。消费者知道名称并调用 `registry.get("json")`。
- **DI**：框架将依赖推送到消费者中。消费者声明它需要什么（通过构造函数参数或注解），DI 容器负责组装。

注册表更简单但将消费者耦合到注册表 API 和字符串名称。DI 进一步解耦但增加了框架复杂性。实际中，DI 容器内部通常使用一个注册表。
:::
