# 模式：虚函数表 / 操作分发 (Vtable / Ops Dispatch)

## 一句话

将函数指针组合到结构体中实现运行时多态——接口、trait 和虚方法背后的手动基础。

## 核心思想

虚函数表（vtable）是一个函数指针结构体，定义了类型上可用的操作。每个"对象"将其 vtable 指针与数据一起存储。调用方法时，通过 vtable 指针间接调用——这是 C 语言在没有类的情况下实现多态的方式，也是编译器在底层实现接口和虚方法的方式。

```text
  Circle                   Rectangle
  ┌──────────┐             ┌──────────┐
  │ data:    │             │ data:    │
  │  r = 5   │             │  w = 4   │
  │          │             │  h = 6   │
  │ vtable ──┼──┐          │ vtable ──┼──┐
  └──────────┘  │          └──────────┘  │
                ▼                        ▼
  ┌──────────────────┐   ┌──────────────────┐
  │  circle_vtable   │   │   rect_vtable    │
  ├──────────────────┤   ├──────────────────┤
  │ area:  pi*r*r    │   │ area:  w*h       │
  │ perim: 2*pi*r    │   │ perim: 2*(w+h)   │
  └──────────────────┘   └──────────────────┘

  Dispatch: shape.vtable.area(shape.data)
```

| 属性 | 值 |
|------|------|
| 调用开销 | 一次指针间接寻址（vtable 查找） |
| 添加新类型 | 添加新 vtable——无需修改现有代码 |
| 添加新操作 | 必须更新所有 vtable（表达式问题） |
| 内存 | 每个类型一个 vtable（所有实例共享） |

**动手试试** — 调用对象方法，观察 vtable 分发解析具体实现：

<VTableViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| Linux 内核 | [fs.h#L2093-L2163](https://github.com/torvalds/linux/blob/master/include/linux/fs.h#L2093-L2163) | `file_operations` 结构体（L2093）是一个函数指针 vtable：`.read`、`.write`、`.open`、`.release`、`.mmap`、`.poll` 等。每个文件系统（ext4、btrfs、tmpfs）提供自己的 `file_operations` 实例。VFS 层通过这个 vtable 分发 `read()` / `write()` 调用——一个 API，多种实现。 |
| CPython | [object.h#L250-L340](https://github.com/python/cpython/blob/main/Include/cpython/object.h#L250-L340) | `PyTypeObject`（L250）是所有 Python 类型的 vtable。包含 `tp_repr`、`tp_hash`、`tp_call`、`tp_getattro`、`tp_richcompare` 等函数指针，以及协议套件（`tp_as_number`、`tp_as_sequence`、`tp_as_mapping`）。每个 Python `type` 对象指向一个 `PyTypeObject` vtable。 |

## 实现

::: code-group

```typescript [TypeScript]
interface ShapeVtable {
  area: (data: number[]) => number;
  perimeter: (data: number[]) => number;
}

interface Shape {
  vtable: ShapeVtable;
  data: number[];
}

const circleVtable: ShapeVtable = {
  area: (d) => Math.PI * d[0] * d[0],
  perimeter: (d) => 2 * Math.PI * d[0],
};

const rectVtable: ShapeVtable = {
  area: (d) => d[0] * d[1],
  perimeter: (d) => 2 * (d[0] + d[1]),
};

function createCircle(r: number): Shape {
  return { vtable: circleVtable, data: [r] };
}

function createRect(w: number, h: number): Shape {
  return { vtable: rectVtable, data: [w, h] };
}

// Polymorphic dispatch — works for any shape
function totalArea(shapes: Shape[]): number {
  return shapes.reduce((sum, s) => sum + s.vtable.area(s.data), 0);
}
```

```go [Go]
type ShapeOps struct {
	Area      func(data []float64) float64
	Perimeter func(data []float64) float64
}

type Shape struct {
	Ops  *ShapeOps
	Data []float64
}

var CircleOps = &ShapeOps{
	Area:      func(d []float64) float64 { return math.Pi * d[0] * d[0] },
	Perimeter: func(d []float64) float64 { return 2 * math.Pi * d[0] },
}

var RectOps = &ShapeOps{
	Area:      func(d []float64) float64 { return d[0] * d[1] },
	Perimeter: func(d []float64) float64 { return 2 * (d[0] + d[1]) },
}

func NewCircle(r float64) Shape { return Shape{Ops: CircleOps, Data: []float64{r}} }
func NewRect(w, h float64) Shape { return Shape{Ops: RectOps, Data: []float64{w, h}} }
```

```python [Python]
from dataclasses import dataclass
from typing import Callable

@dataclass
class ShapeVtable:
    area: Callable[[list[float]], float]
    perimeter: Callable[[list[float]], float]

@dataclass
class Shape:
    vtable: ShapeVtable
    data: list[float]

import math

circle_vtable = ShapeVtable(
    area=lambda d: math.pi * d[0] ** 2,
    perimeter=lambda d: 2 * math.pi * d[0],
)

rect_vtable = ShapeVtable(
    area=lambda d: d[0] * d[1],
    perimeter=lambda d: 2 * (d[0] + d[1]),
)

def create_circle(r: float) -> Shape:
    return Shape(vtable=circle_vtable, data=[r])

def create_rect(w: float, h: float) -> Shape:
    return Shape(vtable=rect_vtable, data=[w, h])
```

```rust [Rust]
struct ShapeVtable {
    area: fn(&[f64]) -> f64,
    perimeter: fn(&[f64]) -> f64,
}

struct Shape {
    vtable: &'static ShapeVtable,
    data: Vec<f64>,
}

static CIRCLE_VTABLE: ShapeVtable = ShapeVtable {
    area: |d| std::f64::consts::PI * d[0] * d[0],
    perimeter: |d| 2.0 * std::f64::consts::PI * d[0],
};

static RECT_VTABLE: ShapeVtable = ShapeVtable {
    area: |d| d[0] * d[1],
    perimeter: |d| 2.0 * (d[0] + d[1]),
};

fn create_circle(r: f64) -> Shape {
    Shape { vtable: &CIRCLE_VTABLE, data: vec![r] }
}

fn create_rect(w: f64, h: f64) -> Shape {
    Shape { vtable: &RECT_VTABLE, data: vec![w, h] }
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 实现形状的 vtable 分发（面积/周长） | `exercises/typescript/vtable/01-basic.test.ts` |
| 进阶 | 基于 vtable 扩展点的插件系统 | `exercises/typescript/vtable/02-intermediate.test.ts` |

## 何时使用

- **插件架构** — 插件提供一组回调的 vtable 供宿主调用
- **操作系统内核抽象** — 文件系统、设备驱动、网络协议都使用操作结构体
- **语言运行时** — Python 类型、Ruby 类、Lua 元表都是 vtable
- **数据库存储引擎** — 每个引擎（InnoDB、RocksDB）提供读/写/扫描操作
- **渲染后端** — OpenGL、Vulkan、Metal 在统一的 vtable 接口后面

## 何时不用

- **单一实现** — 如果只有一个实现，直接函数调用更简单更快
- **热点内层循环** — vtable 间接调用阻碍内联和分支预测；考虑单态化
- **少操作多类型** — 如果主要添加操作（而非类型），表达式问题让 vtable 变得痛苦

## 更多生产案例

- [Rust dyn Trait](https://github.com/rust-lang/rust) — trait 对象使用 vtable 指针进行动态分发
- [Go interfaces](https://github.com/golang/go) — 接口值包含 itable（接口表）指针
- [SQLite VFS](https://github.com/sqlite/sqlite) — 虚拟文件系统层使用函数指针结构体进行操作系统抽象
- [QEMU](https://github.com/qemu/qemu) — 设备模型提供操作结构体用于内存映射 I/O 处理

## 挑战题

::: details Q1: 在 C++ 中，每个有虚方法的类都有一个隐藏的 vptr。100 万个对象的内存成本是多少？
**答案：** 每个对象存储一个 vptr（64 位系统上 8 字节）。100 万个对象：仅 vtable 指针就 8MB。

但 vtable 本身是共享的——每个类一个，不是每个实例一个。如果你有 10 个类，那只有 10 个 vtable（总共几百字节）。每个对象的成本是 vptr，不是 vtable。

关键洞察：vtable 是按类型的，vptr 是按实例的。继承深度不改变 vptr 大小——每个对象恰好有一个 vptr。
:::

::: details Q2: Linux 的 file_operations 有约 70 个函数指针。当文件系统不支持某个操作时会怎样？
**答案：** 函数指针被设置为 NULL，VFS 层在调用前检查 NULL。如果为 NULL，返回 `-EINVAL` 或 `-EOPNOTSUPP`。

例如，`tmpfs` 不支持某些文件的 `llseek`，所以其 `file_operations` 中 `.llseek = NULL`。VFS 在 `vfs_llseek()` 中检查这一点并返回错误。这是"部分 vtable"模式——不是每个类型都需要每个操作。
:::

::: details Q3: Rust 既有静态分发（泛型）也有动态分发（dyn Trait）。什么时候选择动态分发？
**答案：** 当你需要异构集合时使用动态分发（`dyn Trait`）——例如 `Vec<Box<dyn Shape>>` 同时持有圆形和矩形。当类型在编译时已知且你希望编译器内联优化时使用静态分发（泛型）。

动态分发每次调用约 2-5ns（指针间接 + 缓存未命中风险）。静态分发是零开销但通过单态化增加二进制大小。经验法则：热路径用泛型，冷路径和 API 用 `dyn Trait`。
:::

::: details Q4: CPython 的 PyTypeObject 与 C++ vtable 有什么不同？
**答案：** C++ vtable 是编译器生成的且隐藏——你无法在运行时修改它。CPython 的 `PyTypeObject` 是一个普通的 C 结构体，在运行时完全可变。

这使得 Python 的动态特性成为可能：你可以在运行时通过修改 `PyTypeObject` 的槽来添加/替换类型上的方法。它还通过复制父级槽并允许覆盖来支持继承。权衡：每次方法调用都经过 dict 查找 + 类型槽，使 Python 方法分发比 C++ 虚调用慢约 100 倍。
:::
