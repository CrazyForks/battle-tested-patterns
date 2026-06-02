# 模式：位掩码 (Bitmask)

## 一句话

将多个布尔标志打包到一个整数中，通过位运算实现常数时间的集合操作。

## 核心思想

不使用布尔数组或多字段对象，位掩码将每个标志编码为整数中的一个比特位。这带来 O(1) 的设置/检查/清除/切换操作，以及轻松的多标志组合。

```text
  比特位:        7   6   5   4   3   2   1   0
                ┌───┬───┬───┬───┬───┬───┬───┬───┐
  标志:         │   │   │   │ SN│ CB│ RF│ UP│ PL│
                └───┴───┴───┴─┬─┴─┬─┴─┬─┴─┬─┴─┬─┘
                              │   │   │   │   └─ Placement  (1 << 0)
                              │   │   │   └──── Update     (1 << 1)
                              │   │   └──────── Ref        (1 << 2)
                              │   └──────────── Callback   (1 << 3)
                              └──────────────── Snapshot   (1 << 4)
```

**四种操作** — 均为 O(1)，无分支：

| 目的 | 写法 | 原理 |
|------|------|------|
| 设置标志 | `flags \|= FLAG` | OR 开启目标位，其他不变 |
| 检查标志 | `flags & FLAG` | AND 隔离目标位 — 非零即已设置 |
| 清除标志 | `flags &= ~FLAG` | AND 反转掩码关闭目标位 |
| 切换标志 | `flags ^= FLAG` | XOR 翻转目标位 |

核心洞察：一次 `&` 操作就能同时检查任意标志组合 — 无循环、无分支。

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

## 动手试试

<script setup>
const bitmaskLangs = {
  typescript: `// 🎯 修改标志，观察二进制变化！

var READ    = 1 << 0;  // 1
var WRITE   = 1 << 1;  // 2
var EXECUTE = 1 << 2;  // 4
var DELETE  = 1 << 3;  // 8

function show(label, flags) {
  console.log(label + ": " + flags.toString(2).padStart(4, "0") + " (十进制 " + flags + ")");
}

var perms = 0;
show("初始", perms);

perms = perms | READ | WRITE;
show("+ READ + WRITE", perms);

console.log("有 READ?    " + ((perms & READ) !== 0));
console.log("有 EXECUTE? " + ((perms & EXECUTE) !== 0));

perms |= EXECUTE;
show("+ EXECUTE", perms);

perms &= ~WRITE;
show("- WRITE", perms);

perms ^= DELETE;
show("^ DELETE (开)", perms);
perms ^= DELETE;
show("^ DELETE (关)", perms);`,
  python: `# 🎯 修改标志，观察二进制变化！

READ    = 1 << 0  # 1
WRITE   = 1 << 1  # 2
EXECUTE = 1 << 2  # 4
DELETE  = 1 << 3  # 8

def show(label, flags):
    print(f"{label}: {flags:04b} (十进制 {flags})")

perms = 0
show("初始", perms)

perms = perms | READ | WRITE
show("+ READ + WRITE", perms)

print(f"有 READ?    {bool(perms & READ)}")
print(f"有 EXECUTE? {bool(perms & EXECUTE)}")

perms |= EXECUTE
show("+ EXECUTE", perms)

perms &= ~WRITE
show("- WRITE", perms)`
};
</script>

<CodePlayground title="位掩码 Playground" :languages="bitmaskLangs" />
