---
title: "Pattern: Visitor / Tree Walker"
description: "Decouple tree traversal from operations by dispatching to type-specific callbacks — enabling new operations without modifying the tree."
difficulty: "advanced"
---

# Pattern: Visitor / Tree Walker

<DifficultyBadge />

## One Liner

Decouple tree traversal from operations by dispatching to type-specific callbacks — enabling new operations without modifying the tree.

<DemoBadge />

## Real-World Analogy

A building inspector visiting different types of rooms. The inspector has a specific checklist for each room type — kitchen inspection differs from bathroom inspection. The rooms don't need to know how to inspect themselves; they just open the door and let the inspector do the right thing based on room type.

## Core Idea

The visitor pattern separates "how to walk a tree" from "what to do at each node." The tree defines an `accept(visitor)` method that dispatches to the visitor's type-specific callback (e.g., `visitAdd`, `visitMultiply`). To add a new operation (evaluation, printing, optimization), you create a new visitor — no tree node classes need to change.

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

| Property | Value |
|----------|-------|
| Adding operations | Easy — write a new visitor |
| Adding node types | Hard — must update all visitors (expression problem) |
| Traversal | Controlled by visitor or by accept() methods |
| Pattern family | Behavioral — related to Strategy and Iterator |

**Try it yourself** — select a visitor type and traverse the AST, watching each node get visited:

<VisitorViz />

## Production Proof

| Project | Source | Usage |
|---------|--------|-------|
| LLVM | [InstVisitor.h#L45-L107](https://github.com/llvm/llvm-project/blob/1dc53bacd24fb555dfd2ec030a5ee33f5db3fadf/llvm/include/llvm/IR/InstVisitor.h#L45-L107) | `InstVisitor<SubClass, RetTy>` (L45) is a CRTP visitor over all LLVM IR instruction types. It dispatches via `visit(Instruction &I)` which switches on opcode to call `visitAdd`, `visitBr`, `visitCall`, etc. Used for instruction counting, constant folding, and optimization passes. Default behavior delegates to parent class visitors. |
| Vue.js | [transforms/vIf.ts#L35-L60](https://github.com/vuejs/core/blob/48ad452dd61926a59e358da3c74c5ef750ae21c4/packages/compiler-core/src/transforms/vIf.ts#L35-L60) | `transformIf` is a `NodeTransform` visitor that walks the template AST. The compiler's `traverseNode` (in transform.ts) dispatches each AST node to registered transform visitors. Each transform (v-if, v-for, v-bind) is a visitor that rewrites nodes without modifying the AST structure code. |

## Implementation

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

## Exercises

| Level | Exercise | File |
|-------|----------|------|
| Basic | AST visitor for math expressions (eval + print) | `exercises/typescript/visitor/01-basic.test.ts` |
| Intermediate | Transform visitor that rewrites the tree (constant folding) | `exercises/typescript/visitor/02-intermediate.test.ts` |

Run exercises: `pnpm test:ts` (TypeScript) · `cargo test` (Rust) · `go test ./...` (Go) · `pytest` (Python)

Exercise files: Rust `exercises/rust/src/visitor/mod.rs` · Go `exercises/go/visitor/visitor_test.go` · Python `exercises/python/visitor/test_visitor.py`

## When to Use

- **Compilers and interpreters** — evaluation, type checking, optimization passes over ASTs
- **Linters and formatters** — walk code AST to detect patterns or reformat
- **Serialization** — traverse an object graph to emit JSON, XML, or binary
- **UI frameworks** — walk component tree for rendering, diffing, or accessibility checks
- **Query planners** — walk and optimize SQL query plans

## When NOT to Use

- **Frequently changing node types** — if you add node types often, every visitor must be updated (expression problem)
- **Simple single-pass logic** — if you only need one operation, a simple recursive function is clearer than a full visitor
- **Flat data** — visitors shine on tree/graph structures; for flat lists, a simple loop suffices

## More Production Uses

- [Babel](https://github.com/babel/babel) — JavaScript AST transforms use a visitor-based plugin architecture
- [ESLint](https://github.com/eslint/eslint) — lint rules are visitors that walk the AST and report violations
- [Roslyn](https://github.com/dotnet/roslyn) — C# compiler's syntax tree visitors for analysis and code generation
- [rustc](https://github.com/rust-lang/rust) — HIR and MIR visitor traits for borrow checking, optimization, and codegen

## Related Patterns

| Pattern | Relationship |
|---------|-------------|
| [Iterator](/patterns/iterator/) | Both traverse structures — visitors dispatch callbacks, iterators yield elements |
| [Vtable](/patterns/vtable/) | Visitor's dispatch table is conceptually a vtable indexed by node type |
| [Dependency Graph](/patterns/dependency-graph/) | Visitors walk dependency graphs to process nodes in correct order |
| [Tagged Union](/patterns/tagged-union/) | Visitor dispatch matches on tagged union's type tag |
| [State Machine](/patterns/state-machine/) | Visitors can traverse state machine nodes; state machines can drive visitor dispatch |

## Challenge Questions

::: details Q1: You're building a compiler with 20 AST node types and 15 optimization passes. Should you use visitors or switch statements?
**Answer:** Visitors. With 15 passes (operations) and 20 node types, you'd need 15 separate switch statements each handling 20 cases. With visitors, each pass is a self-contained visitor class.

If you add a new pass, you write one visitor. If you use switches, you add one function with 20 cases. The visitor keeps each pass's logic cohesive. However, if you add a new node type, you must update all 15 visitors — this is the classic tradeoff.
:::

::: details Q2: Babel plugins are visitors. What happens if two plugins visit the same node type and conflict?
**Answer:** Plugin order matters. Babel runs visitors in the order plugins are listed in the config. If plugin A transforms a node that plugin B also expects, the first plugin's output becomes the second plugin's input.

This can cause subtle bugs: plugin A rewrites `import` to `require`, then plugin B (expecting `import`) doesn't match. Solutions: (1) Document plugin ordering requirements, (2) Use visitor priorities, (3) Run conflicting plugins in separate passes. Babel's `pre`/`post` hooks help coordinate.
:::

::: details Q3: The transform visitor in the exercise creates new nodes instead of mutating. Why is immutability important here?
**Answer:** Immutable transforms are safer because the original tree is preserved. This enables: (1) running multiple transforms on the same input, (2) comparing before/after for debugging, (3) rolling back if a transform fails, (4) parallel transforms on the same tree.

Mutable visitors are faster (no allocation) but dangerous — one visitor's mutation can break another visitor that's reading the same tree. LLVM uses mutable visitors for performance, but Vue's compiler uses immutable transforms for safety.
:::

::: details Q4: LLVM's InstVisitor has a default case that calls the parent instruction class's visitor. Why is this useful?
**Answer:** It implements fallback behavior via the class hierarchy. If you don't override `visitAdd`, it falls back to `visitBinaryOperator`, then to `visitInstruction`, then to a no-op.

This means you only need to override the cases you care about. An instruction counter can override just `visitInstruction` to count all instructions. A binary operation optimizer can override just `visitBinaryOperator` to handle add, sub, mul, div at once, without listing each. This is the "template method" pattern applied to visitors.
:::
