import { describe, it, expect } from 'vitest';

/**
 * Visitor - Intermediate: Transform visitor that rewrites the tree.
 *
 * TODO: Implement a transform visitor that can rewrite AST nodes
 * during traversal. Use cases: constant folding (evaluate known
 * expressions at compile time), variable substitution.
 *
 * Real-world use: LLVM InstVisitor, Vue compiler transforms,
 * Babel AST transforms.
 */

type Expr =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'add'; left: Expr; right: Expr }
  | { type: 'multiply'; left: Expr; right: Expr }
  | { type: 'negate'; operand: Expr };

/** A transform visitor returns a (possibly different) Expr for each node */
interface TransformVisitor {
  visitNumber: (value: number) => Expr;
  visitVariable: (name: string) => Expr;
  visitAdd: (left: Expr, right: Expr) => Expr;
  visitMultiply: (left: Expr, right: Expr) => Expr;
  visitNegate: (operand: Expr) => Expr;
}

/** Walk and transform the tree */
function transform(expr: Expr, visitor: TransformVisitor): Expr {
  // TODO: implement
  switch (expr.type) {
    case 'number':
      return visitor.visitNumber(expr.value);
    case 'variable':
      return visitor.visitVariable(expr.name);
    case 'add':
      return visitor.visitAdd(transform(expr.left, visitor), transform(expr.right, visitor));
    case 'multiply':
      return visitor.visitMultiply(transform(expr.left, visitor), transform(expr.right, visitor));
    case 'negate':
      return visitor.visitNegate(transform(expr.operand, visitor));
  }
}

/** Identity visitor — returns nodes unchanged (base for overrides) */
function identityVisitor(): TransformVisitor {
  return {
    visitNumber: (v) => ({ type: 'number', value: v }),
    visitVariable: (n) => ({ type: 'variable', name: n }),
    visitAdd: (l, r) => ({ type: 'add', left: l, right: r }),
    visitMultiply: (l, r) => ({ type: 'multiply', left: l, right: r }),
    visitNegate: (o) => ({ type: 'negate', operand: o }),
  };
}

/** Constant folding — evaluate operations on known numbers at compile time */
function constantFoldVisitor(): TransformVisitor {
  // TODO: implement — fold add/multiply/negate when all operands are numbers
  const base = identityVisitor();
  return {
    ...base,
    visitAdd: (left, right) => {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: left.value + right.value };
      }
      return { type: 'add', left, right };
    },
    visitMultiply: (left, right) => {
      if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: left.value * right.value };
      }
      return { type: 'multiply', left, right };
    },
    visitNegate: (operand) => {
      if (operand.type === 'number') {
        return { type: 'number', value: -operand.value };
      }
      return { type: 'negate', operand };
    },
  };
}

/** Variable substitution — replace variable names with values from an env */
function substituteVisitor(env: Record<string, number>): TransformVisitor {
  // TODO: implement — replace variables found in env with number nodes
  const base = identityVisitor();
  return {
    ...base,
    visitVariable: (name) => {
      if (name in env) {
        return { type: 'number', value: env[name]! };
      }
      return { type: 'variable', name };
    },
  };
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Visitor - Intermediate: Transform Visitor', () => {
  const num = (n: number): Expr => ({ type: 'number', value: n });
  const varr = (n: string): Expr => ({ type: 'variable', name: n });
  const add = (l: Expr, r: Expr): Expr => ({ type: 'add', left: l, right: r });
  const mul = (l: Expr, r: Expr): Expr => ({ type: 'multiply', left: l, right: r });

  it('should fold constant addition', () => {
    const expr = add(num(3), num(7));
    const result = transform(expr, constantFoldVisitor());
    expect(result).toEqual({ type: 'number', value: 10 });
  });

  it('should fold nested constants', () => {
    // (2 + 3) * 4 → 5 * 4 → 20
    const expr = mul(add(num(2), num(3)), num(4));
    const result = transform(expr, constantFoldVisitor());
    expect(result).toEqual({ type: 'number', value: 20 });
  });

  it('should not fold expressions with variables', () => {
    const expr = add(varr('x'), num(5));
    const result = transform(expr, constantFoldVisitor());
    expect(result.type).toBe('add');
  });

  it('should substitute variables from environment', () => {
    const expr = add(varr('x'), mul(varr('y'), num(2)));
    const substituted = transform(expr, substituteVisitor({ x: 10, y: 3 }));
    const folded = transform(substituted, constantFoldVisitor());
    expect(folded).toEqual({ type: 'number', value: 16 });
  });

  it('should handle partial substitution and folding', () => {
    // x + (3 * 4) with x unknown → x + 12
    const expr = add(varr('x'), mul(num(3), num(4)));
    const folded = transform(expr, constantFoldVisitor());
    expect(folded.type).toBe('add');
    expect((folded as { type: 'add'; left: Expr; right: Expr }).left).toEqual(varr('x'));
    expect((folded as { type: 'add'; left: Expr; right: Expr }).right).toEqual(num(12));
  });
});
