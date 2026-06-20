---
title: "模式：访问者 / 树遍历器 (Visitor / Tree Walker)"
description: "将树遍历与操作解耦，通过分发到类型特定的回调——使新操作无需修改树结构。"
difficulty: "advanced"
---

# 模式：访问者 / 树遍历器 (Visitor / Tree Walker)

<DifficultyBadge />

## 一句话

将树遍历与操作解耦，通过分发到类型特定的回调——使新操作无需修改树结构。

<DemoBadge />

## 现实类比

一个巡查不同类型房间的建筑检查员。检查员对每种房间有不同的检查清单——厨房和浴室的检查方式不同。房间不需要知道怎么检查自己；它们只需开门，让检查员根据房间类型做正确的事。

## 核心思想

访问者模式将"如何遍历树"与"在每个节点做什么"分离。树定义一个 `accept(visitor)` 方法，分发到访问者的类型特定回调（如 `visitAdd`、`visitMultiply`）。要添加新操作（求值、打印、优化），只需创建新的访问者——无需修改树节点类。

```text
  AST:         +               Eval Visitor:
              / \                visitNumber(n) → n
             *   4              visitAdd(l, r)  → visit(l) + visit(r)
            / \                 visitMul(l, r)  → visit(l) * visit(r)
           2   3

  visit(tree, evalVisitor):
    visitAdd(
      visitMul(visitNumber(2), visitNumber(3)),   → 6
      visitNumber(4)                               → 4
    ) → 10

  Print Visitor (new operation, zero tree changes):
    visitAdd(l, r) → "(" + visit(l) + " + " + visit(r) + ")"
    → "((2 * 3) + 4)"
```

| 属性 | 值 |
|------|------|
| 添加操作 | 容易——编写新的访问者 |
| 添加节点类型 | 困难——必须更新所有访问者（表达式问题） |
| 遍历控制 | 由访问者或 accept() 方法控制 |
| 模式分类 | 行为型——与 Strategy 和 Iterator 相关 |

**动手试试** — 选择访问者类型并遍历 AST，观察每个节点被访问：

<VisitorViz />

## 生产验证

| 项目 | 源码 | 用途 |
|------|------|------|
| LLVM | [InstVisitor.h#L45-L107](https://github.com/llvm/llvm-project/blob/1dc53bacd24fb555dfd2ec030a5ee33f5db3fadf/llvm/include/llvm/IR/InstVisitor.h#L45-L107) | `InstVisitor<SubClass, RetTy>`（L45）是对所有 LLVM IR 指令类型的 CRTP 访问者。通过 `visit(Instruction &I)` 按操作码分发到 `visitAdd`、`visitBr`、`visitCall` 等。用于指令计数、常量折叠和优化遍历。默认行为委托给父类访问者。 |
| Vue.js | [transforms/vIf.ts#L35-L60](https://github.com/vuejs/core/blob/48ad452dd61926a59e358da3c74c5ef750ae21c4/packages/compiler-core/src/transforms/vIf.ts#L35-L60) | `transformIf` 是一个遍历模板 AST 的 `NodeTransform` 访问者。编译器的 `traverseNode`（在 transform.ts 中）将每个 AST 节点分发到注册的转换访问者。每个转换（v-if、v-for、v-bind）都是一个访问者，在不修改 AST 结构代码的情况下重写节点。 |

## 实现

::: code-group

```typescript [TypeScript]
type Expr =
  | { type: 'number'; value: number }
  | { type: 'add'; left: Expr; right: Expr }
  | { type: 'multiply'; left: Expr; right: Expr };

interface ExprVisitor<T> {
  visitNumber: (value: number) => T;
  visitAdd: (left: Expr, right: Expr) => T;
  visitMultiply: (left: Expr, right: Expr) => T;
}

function visit<T>(expr: Expr, v: ExprVisitor<T>): T {
  switch (expr.type) {
    case 'number': return v.visitNumber(expr.value);
    case 'add': return v.visitAdd(expr.left, expr.right);
    case 'multiply': return v.visitMultiply(expr.left, expr.right);
  }
}

// Eval visitor
const evalVisitor: ExprVisitor<number> = {
  visitNumber: (n) => n,
  visitAdd: (l, r) => visit(l, evalVisitor) + visit(r, evalVisitor),
  visitMultiply: (l, r) => visit(l, evalVisitor) * visit(r, evalVisitor),
};
```

```rust [Rust]
enum Expr {
    Number(f64),
    Add(Box<Expr>, Box<Expr>),
    Multiply(Box<Expr>, Box<Expr>),
}

trait ExprVisitor {
    type Output;
    fn visit_number(&mut self, value: f64) -> Self::Output;
    fn visit_add(&mut self, left: &Expr, right: &Expr) -> Self::Output;
    fn visit_multiply(&mut self, left: &Expr, right: &Expr) -> Self::Output;
}

fn visit<V: ExprVisitor>(expr: &Expr, v: &mut V) -> V::Output {
    match expr {
        Expr::Number(n) => v.visit_number(*n),
        Expr::Add(l, r) => v.visit_add(l, r),
        Expr::Multiply(l, r) => v.visit_multiply(l, r),
    }
}

struct Evaluator;
impl ExprVisitor for Evaluator {
    type Output = f64;
    fn visit_number(&mut self, value: f64) -> f64 { value }
    fn visit_add(&mut self, left: &Expr, right: &Expr) -> f64 {
        visit(left, self) + visit(right, self)
    }
    fn visit_multiply(&mut self, left: &Expr, right: &Expr) -> f64 {
        visit(left, self) * visit(right, self)
    }
}
```

```go [Go]
type Expr interface{ exprNode() }

type NumberExpr struct{ Value float64 }
type AddExpr struct{ Left, Right Expr }
type MulExpr struct{ Left, Right Expr }

func (NumberExpr) exprNode() {}
func (AddExpr) exprNode()    {}
func (MulExpr) exprNode()    {}

func Eval(e Expr) float64 {
	switch n := e.(type) {
	case NumberExpr:
		return n.Value
	case AddExpr:
		return Eval(n.Left) + Eval(n.Right)
	case MulExpr:
		return Eval(n.Left) * Eval(n.Right)
	default:
		panic("unknown node")
	}
}
```

```python [Python]
from dataclasses import dataclass
from typing import Protocol, TypeVar

T = TypeVar("T")

@dataclass
class Number:
    value: float

@dataclass
class Add:
    left: "Expr"
    right: "Expr"

@dataclass
class Multiply:
    left: "Expr"
    right: "Expr"

Expr = Number | Add | Multiply

def visit(expr: Expr, visitor: dict) -> float:
    if isinstance(expr, Number):
        return visitor["number"](expr.value)
    elif isinstance(expr, Add):
        return visitor["add"](expr.left, expr.right)
    elif isinstance(expr, Multiply):
        return visitor["multiply"](expr.left, expr.right)
    raise TypeError(f"Unknown expr: {expr}")

eval_visitor = {
    "number": lambda v: v,
    "add": lambda l, r: visit(l, eval_visitor) + visit(r, eval_visitor),
    "multiply": lambda l, r: visit(l, eval_visitor) * visit(r, eval_visitor),
}
```

:::

## 练习

| 难度 | 练习 | 文件 |
|------|------|------|
| 基础 | 数学表达式的 AST 访问者（求值 + 打印） | `exercises/typescript/visitor/01-basic.test.ts` |
| 进阶 | 重写树的转换访问者（常量折叠） | `exercises/typescript/visitor/02-intermediate.test.ts` |

运行练习：`pnpm test:ts`（TypeScript）· `cargo test`（Rust）· `go test ./...`（Go）· `pytest`（Python）

练习文件： Rust `exercises/rust/src/visitor/mod.rs` · Go `exercises/go/visitor/visitor_test.go` · Python `exercises/python/visitor/test_visitor.py`

## 何时使用

- **编译器和解释器** — 对 AST 进行求值、类型检查、优化遍历
- **代码检查和格式化** — 遍历代码 AST 以检测模式或重新格式化
- **序列化** — 遍历对象图以生成 JSON、XML 或二进制格式
- **UI 框架** — 遍历组件树进行渲染、diff 或无障碍检查
- **查询规划器** — 遍历和优化 SQL 查询计划

## 何时不用

- **节点类型频繁变化** — 如果经常添加节点类型，每个访问者都必须更新（表达式问题）
- **简单的单遍逻辑** — 如果只需要一个操作，简单的递归函数比完整访问者更清晰
- **平面数据** — 访问者在树/图结构上发光；对于平面列表，简单循环就够了

## 更多生产案例

- [Babel](https://github.com/babel/babel) — JavaScript AST 转换使用基于访问者的插件架构
- [ESLint](https://github.com/eslint/eslint) — lint 规则是遍历 AST 并报告违规的访问者
- [Roslyn](https://github.com/dotnet/roslyn) — C# 编译器的语法树访问者用于分析和代码生成
- [rustc](https://github.com/rust-lang/rust) — HIR 和 MIR 访问者 trait 用于借用检查、优化和代码生成

## 相关模式

| 模式 | 关系 |
|---------|-------------|
| [迭代器 / 惰性求值 (Iterator)](/zh/patterns/iterator/) | 两者都遍历结构——访问者分发回调，迭代器产出元素 |
| [虚函数表 / 操作分发 (Vtable / Ops Dispatch)](/zh/patterns/vtable/) | 访问者的分发表在概念上是按节点类型索引的虚函数表 |
| [依赖图 (Dependency Graph)](/zh/patterns/dependency-graph/) | 访问者遍历依赖图以正确顺序处理节点 |
| [标签联合体 (Tagged Union / Variant)](/zh/patterns/tagged-union/) | 访问者分发匹配标签联合的类型标签 |
| [状态机 (State Machine)](/zh/patterns/state-machine/) | 访问者可以遍历状态机节点；状态机可以驱动访问者分发 |

## 挑战题

::: details Q1: 你正在构建一个有 20 种 AST 节点类型和 15 个优化遍历的编译器。应该用访问者还是 switch 语句？
**答案：** 访问者。有 15 个遍历（操作）和 20 种节点类型，你需要 15 个单独的 switch 语句，每个处理 20 种情况。用访问者，每个遍历是一个自包含的访问者类。

如果添加新遍历，你写一个访问者。如果用 switch，你添加一个有 20 种情况的函数。访问者让每个遍历的逻辑保持内聚。然而，如果添加新节点类型，你必须更新所有 15 个访问者——这是经典的权衡。
:::

::: details Q2: Babel 插件是访问者。如果两个插件访问相同的节点类型并冲突会怎样？
**答案：** 插件顺序很重要。Babel 按配置中列出的顺序运行访问者。如果插件 A 转换了插件 B 也期望的节点，第一个插件的输出变成第二个插件的输入。

这可能导致微妙的 bug：插件 A 将 `import` 重写为 `require`，然后插件 B（期望 `import`）不匹配。解决方案：(1) 记录插件排序要求，(2) 使用访问者优先级，(3) 在不同遍历中运行冲突的插件。Babel 的 `pre`/`post` 钩子有助于协调。
:::

::: details Q3: 练习中的转换访问者创建新节点而不是修改。为什么不可变性在这里很重要？
**答案：** 不可变转换更安全，因为原始树被保留。这使得以下操作成为可能：(1) 对同一输入运行多个转换，(2) 比较前后以便调试，(3) 如果转换失败则回滚，(4) 对同一棵树进行并行转换。

可变访问者更快（无分配）但危险——一个访问者的修改可能破坏正在读取同一棵树的另一个访问者。LLVM 为性能使用可变访问者，但 Vue 的编译器为安全使用不可变转换。
:::

::: details Q4: LLVM 的 InstVisitor 有一个调用父指令类访问者的默认 case。这为什么有用？
**答案：** 它通过类层次结构实现回退行为。如果你没有覆盖 `visitAdd`，它回退到 `visitBinaryOperator`，然后到 `visitInstruction`，然后到空操作。

这意味着你只需要覆盖你关心的情况。指令计数器可以只覆盖 `visitInstruction` 来计数所有指令。二元操作优化器可以只覆盖 `visitBinaryOperator` 来一次处理 add、sub、mul、div，而不用逐一列出。这是应用于访问者的"模板方法"模式。
:::
