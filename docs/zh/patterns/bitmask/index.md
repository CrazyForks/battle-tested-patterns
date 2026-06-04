---
description: "将多个布尔标志打包到一个整数中，通过位运算实现常数时间的集合操作。"
---

# 模式：位掩码 (Bitmask)

## 一句话

将多个布尔标志打包到一个整数中，通过位运算实现常数时间的集合操作。

<DemoBadge />

## 核心思想

不使用布尔数组或多字段对象，位掩码将每个标志编码为整数中的一个比特位。这带来 O(1) 的设置/检查/清除/切换操作，以及轻松的多标志组合。

```text
 bit  7     6     5     4     3     2     1     0
    ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
    │     │     │     │ SN  │ CB  │ RF  │ UP  │ PL  │
    └─────┴─────┴─────┴──┬──┴──┬──┴──┬──┴──┬──┴──┬──┘
                         │     │     │     │     └── Placement  1 << 0
                         │     │     │     └──────── Update     1 << 1
                         │     │     └────────────── Ref        1 << 2
                         │     └──────────────────── Callback   1 << 3
                         └────────────────────────── Snapshot   1 << 4
```

**位运算操作** — 均为 O(1)，无分支：

| 目的 | 写法 | 原理 |
|------|------|------|
| 设置标志 | `flags \|= FLAG` | OR 开启目标位，其他不变 |
| 检查标志 | `(flags & FLAG) !== 0` | AND 隔离目标位 — 非零即已设置 |
| 清除标志 | `flags &= ~FLAG` | AND 反转掩码关闭目标位 |
| 切换标志 | `flags ^= FLAG` | XOR 翻转目标位 |
| 组合标志 | `flags = A \| B \| C` | OR 将多个标志合并为一个值 |
| 检查全部 | `(flags & mask) === mask` | mask 中每一位都被设置才为 true |
| 检查任一 | `(flags & mask) !== 0` | mask 中至少一位被设置即为 true |
| 计数置位 | `n.toString(2).split('1').length - 1` | 位计数 (popcnt) |

核心洞察：一次 `&` 操作就能同时检查任意标志组合 — 无循环、无分支。

**动手试试** — 切换权限位，观察掩码值在二进制、十进制、十六进制中的变化：

<BitmaskViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| React | [ReactFiberFlags.js#L14-L36](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js#L14-L36) | Fiber 节点的副作用标志 — 追踪协调过程中每个 fiber 上待处理的效果（Placement、Update、Deletion、Ref 等） |
| Linux 内核 | [stat.h#L25-L33](https://github.com/torvalds/linux/blob/master/include/uapi/linux/stat.h#L25-L33) | 文件权限位 — 经典的 `rwxrwxrwx`（所有者/组/其他的读/写/执行）编码为 9 位掩码 |
| Go 标准库 | [types.go#L32-L46](https://github.com/golang/go/blob/master/src/os/types.go#L32-L46) | `os.FileMode` — Go 的文件模式位使用 iota 位移的类型常量镜像 Unix 权限标志 |

## 实现

::: code-group

```typescript [TypeScript]
const Flags = {
  Read:    1 << 0,  // 0b0001
  Write:   1 << 1,  // 0b0010
  Execute: 1 << 2,  // 0b0100
  Delete:  1 << 3,  // 0b1000
} as const;

type FlagSet = number;

const hasFlag = (set: FlagSet, flag: number): boolean =>
  (set & flag) === flag;

const hasAny = (set: FlagSet, mask: number): boolean =>
  (set & mask) !== 0;

const setFlag = (set: FlagSet, flag: number): FlagSet =>
  set | flag;

const clearFlag = (set: FlagSet, flag: number): FlagSet =>
  set & ~flag;

const toggleFlag = (set: FlagSet, flag: number): FlagSet =>
  set ^ flag;

// 用法：组合多个标志
const editorPerms = Flags.Read | Flags.Write;
hasFlag(editorPerms, Flags.Read);    // true
hasFlag(editorPerms, Flags.Delete);  // false
```

```rust [Rust]
pub const READ:    u32 = 1 << 0;
pub const WRITE:   u32 = 1 << 1;
pub const EXECUTE: u32 = 1 << 2;
pub const DELETE:  u32 = 1 << 3;

pub fn has_flag(flags: u32, flag: u32) -> bool {
    (flags & flag) == flag
}

pub fn has_any(flags: u32, mask: u32) -> bool {
    (flags & mask) != 0
}

pub fn set_flag(flags: u32, flag: u32) -> u32 {
    flags | flag
}

pub fn clear_flag(flags: u32, flag: u32) -> u32 {
    flags & !flag
}

pub fn toggle_flag(flags: u32, flag: u32) -> u32 {
    flags ^ flag
}

let editor = READ | WRITE;
assert!(has_flag(editor, READ));
assert!(!has_flag(editor, DELETE));
```

```go [Go]
type Permission uint32

const (
    Read    Permission = 1 << iota // 0b0001
    Write                          // 0b0010
    Execute                        // 0b0100
    Delete                         // 0b1000
)

func HasFlag(flags, flag Permission) bool {
    return flags&flag == flag
}

func HasAny(flags, mask Permission) bool {
    return flags&mask != 0
}

func SetFlag(flags, flag Permission) Permission {
    return flags | flag
}

func ClearFlag(flags, flag Permission) Permission {
    return flags &^ flag // Go 的 AND NOT 运算符
}

editor := Read | Write
HasFlag(editor, Read)    // true
HasFlag(editor, Delete)  // false
```

```python [Python]
# Python: 原生位运算，整数无大小限制
READ    = 1 << 0  # 0b0001
WRITE   = 1 << 1  # 0b0010
EXECUTE = 1 << 2  # 0b0100
DELETE  = 1 << 3  # 0b1000

def has_flag(flags: int, flag: int) -> bool:
    return (flags & flag) == flag

def has_any(flags: int, mask: int) -> bool:
    return (flags & mask) != 0

def set_flag(flags: int, flag: int) -> int:
    return flags | flag

def clear_flag(flags: int, flag: int) -> int:
    return flags & ~flag

def toggle_flag(flags: int, flag: int) -> int:
    return flags ^ flag

# 用法
editor = READ | WRITE
assert has_flag(editor, READ)       # True
assert not has_flag(editor, DELETE)  # True
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 基本位运算标志操作（设置、检查、清除、切换） | `exercises/typescript/bitmask/01-basic.test.ts` |
| 进阶 | 构建基于角色的权限系统 | `exercises/typescript/bitmask/02-permission-system.test.ts` |
| 高级 | React 风格的 Fiber 标志与子树冒泡 | `exercises/typescript/bitmask/03-react-flags.test.ts` |

运行练习：`pnpm test`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）

## 何时使用

- **热路径上的多布尔标志** — 一个整数替代 N 个布尔值，节省内存并支持批量操作
- **组合状态** — 需要一次操作检查"这些中的任一个"或"这些全部"
- **序列化** — 单个整数的存储、传输和比较都很简单
- **权限系统** — Unix 的 `rwx` 模型就是位掩码
- **ECS（实体组件系统）** — 游戏引擎中的组件成员掩码

## 何时不用

- **超过 32 个标志** — JavaScript 的位运算操作在 32 位整数上；超出则使用 `BigInt` 或 `Set`
- **互斥状态** — 如果同一时间只能有一个值激活，使用 `enum`
- **可读性比性能更重要** — 命名布尔字段对大多数开发者更清晰
- **动态标志集** — 如果可能的标志集在编译时未知，使用 `Set<string>`

## 更多生产案例

- [Chromium](https://chromium.googlesource.com/chromium/src) — layer compositing flags
- [SQLite](https://www.sqlite.org/src) — VFS flags
- [Nginx](https://github.com/nginx/nginx) — event flags
- Most ECS game engines — component membership masks
- Unix `fcntl` flags

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [标签联合体 (Tagged Union / Variant)](/zh/patterns/tagged-union/) | 两者都将类型信息编码为紧凑的整数表示 |
| [脏标记 (Dirty Flag)](/zh/patterns/dirty-flag/) | 脏标记通常作为位掩码中的位来存储 |
| [双缓冲 (Double Buffering)](/zh/patterns/double-buffering/) | React 在双缓冲树的每个 Fiber 节点上使用位掩码标志追踪工作 |

## 挑战题

::: details Q1: 你的团队在 JavaScript 配置系统中用 Bitmask 定义了 40 个功能开关。QA 报告第 32-39 号开关行为异常——即使设置了某个开关，检查时有时返回 false。出了什么问题？
**答案：** JavaScript 位运算符只能处理 32 位整数，因此第 32 位及以上的标志会被静默截断。

`|`、`&`、`^` 和 `~` 运算符在内部将操作数转换为有符号 32 位整数。`1 << 32` 会回绕为 `1`（等同于 `1 << 0`），这意味着第 32 号标志与第 0 号标志冲突。超过 32 个标志时，你需要使用 `BigInt` 进行位运算，或者改用 `Set<string>` 方案。
:::

::: details Q2: 你有 `permissions = Read | Write | Execute`。一个初级开发者写了 `if (permissions === Read)` 来检查用户是否有读权限。这在单元测试中通过了，但在生产环境中失败了。为什么？
**答案：** `===` 检查的是精确相等，因此只有当 permissions *恰好*是 `Read` 且没有其他权限时才返回 true。

在生产环境中，用户通常有多个组合权限。`permissions === Read` 对于 `Read | Write`（值为 3 vs 值为 1）会返回 false。正确的检查方式是 `(permissions & Read) !== 0` 或 `(permissions & Read) === Read`，它只隔离和测试 Read 位，不受其他标志影响。
:::

::: details Q3: React 使用 Bitmask 标志来跟踪 fiber 的副作用。为什么 React 选择 Bitmask 而不是像 `['placement', 'update', 'ref']` 这样的字符串数组来追踪 fiber 需要哪些 effect？
**答案：** Bitmask 让 React 能用单次整数运算检查、组合和传播多个 effect 标志，而不需要遍历数组。

在协调过程中，React 使用 `parent.subtreeFlags |= child.flags` 将子节点的 effect "冒泡"到父 fiber。如果用数组，这需要去重和拼接操作。Bitmask 方案还能用单次 `subtreeFlags !== 0` 比较来检查"这个子树是否有任何工作要做"——这在每帧需要遍历数千个 fiber 节点时至关重要。
:::

::: details Q4: 你正在设计一个权限系统，其中角色是互斥的——用户只能是 Admin、Editor 或 Viewer 之一。一位同事建议使用 Bitmask。这个模式选对了吗？
**答案：** 不对。互斥状态应该使用枚举（enum），而不是 Bitmask。

Bitmask 适用于标志可以自由组合的场景（`Read | Write | Execute`）。对于互斥角色，Bitmask 允许你意外设置 `Admin | Viewer`，这是一个无意义的状态。枚举在类型层面强制只有一个值，使无效状态无法表示。Bitmask 适用于组合标志；枚举适用于互斥状态。
:::
