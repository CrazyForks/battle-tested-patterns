import { describe, it, expect } from 'vitest';

/**
 * Bitmask - Advanced: React-style fiber flags.
 *
 * Implement a simplified version of React's side-effect flag system
 * (ReactFiberFlags.js) where fiber nodes track pending work using bitmasks.
 */

// Simplified React-style fiber flags
const FiberFlags = {
  NoFlags: 0b0000000,
  Placement: 0b0000001, // New node, needs DOM insertion
  Update: 0b0000010, // Props or state changed
  Deletion: 0b0000100, // Node removed
  ChildDeletion: 0b0001000, // Child removed
  Ref: 0b0010000, // Ref needs attaching/detaching
  Callback: 0b0100000, // Has lifecycle callback
  Snapshot: 0b1000000, // Needs getSnapshotBeforeUpdate
} as const;

interface SimpleFiber {
  tag: string;
  flags: number;
  subtreeFlags: number;
  children: SimpleFiber[];
}

function createFiber(tag: string): SimpleFiber {
  return { tag, flags: FiberFlags.NoFlags, subtreeFlags: FiberFlags.NoFlags, children: [] };
}

function markUpdate(fiber: SimpleFiber): void {
  fiber.flags |= FiberFlags.Update;
}

function markPlacement(fiber: SimpleFiber): void {
  fiber.flags |= FiberFlags.Placement;
}

function markDeletion(fiber: SimpleFiber): void {
  fiber.flags |= FiberFlags.Deletion;
}

function markRef(fiber: SimpleFiber): void {
  fiber.flags |= FiberFlags.Ref;
}

function hasSideEffects(fiber: SimpleFiber): boolean {
  return fiber.flags !== FiberFlags.NoFlags;
}

function needsPlacement(fiber: SimpleFiber): boolean {
  return (fiber.flags & FiberFlags.Placement) !== 0;
}

function needsUpdate(fiber: SimpleFiber): boolean {
  return (fiber.flags & FiberFlags.Update) !== 0;
}

// Bubble flags up: parent's subtreeFlags = OR of all children's (flags | subtreeFlags)
function bubbleFlags(fiber: SimpleFiber): void {
  let subtreeFlags = FiberFlags.NoFlags;
  for (const child of fiber.children) {
    bubbleFlags(child);
    subtreeFlags |= child.flags | child.subtreeFlags;
  }
  fiber.subtreeFlags = subtreeFlags;
}

// Optimization: skip subtree if no work to do (like React's subtreeFlags check)
function subtreeHasWork(fiber: SimpleFiber): boolean {
  return fiber.subtreeFlags !== FiberFlags.NoFlags;
}

describe('Bitmask - Advanced: React-Style Fiber Flags', () => {
  it('should create fiber with no flags', () => {
    const fiber = createFiber('div');
    expect(fiber.flags).toBe(FiberFlags.NoFlags);
    expect(hasSideEffects(fiber)).toBe(false);
  });

  it('should mark and check individual effects', () => {
    const fiber = createFiber('span');
    markUpdate(fiber);
    expect(needsUpdate(fiber)).toBe(true);
    expect(needsPlacement(fiber)).toBe(false);
    expect(hasSideEffects(fiber)).toBe(true);
  });

  it('should accumulate multiple effects', () => {
    const fiber = createFiber('div');
    markPlacement(fiber);
    markRef(fiber);
    expect(needsPlacement(fiber)).toBe(true);
    expect((fiber.flags & FiberFlags.Ref) !== 0).toBe(true);
    expect(needsUpdate(fiber)).toBe(false);
    expect(fiber.flags).toBe(FiberFlags.Placement | FiberFlags.Ref);
  });

  it('should bubble subtree flags from children to parent', () => {
    const parent = createFiber('div');
    const child1 = createFiber('span');
    const child2 = createFiber('p');

    markUpdate(child1);
    markPlacement(child2);

    parent.children = [child1, child2];
    bubbleFlags(parent);

    expect(parent.subtreeFlags).toBe(FiberFlags.Update | FiberFlags.Placement);
    expect(subtreeHasWork(parent)).toBe(true);
  });

  it('should bubble flags through multiple levels', () => {
    const root = createFiber('root');
    const middle = createFiber('div');
    const leaf = createFiber('span');

    markUpdate(leaf);
    middle.children = [leaf];
    root.children = [middle];

    bubbleFlags(root);

    // Middle should have subtreeFlags from leaf
    expect(middle.subtreeFlags).toBe(FiberFlags.Update);
    // Root should have subtreeFlags from middle's subtree
    expect(root.subtreeFlags).toBe(FiberFlags.Update);
    expect(subtreeHasWork(root)).toBe(true);
  });

  it('should skip subtrees without work', () => {
    const root = createFiber('root');
    const cleanBranch = createFiber('clean');
    const dirtyBranch = createFiber('dirty');
    const dirtyLeaf = createFiber('leaf');

    markUpdate(dirtyLeaf);
    dirtyBranch.children = [dirtyLeaf];
    root.children = [cleanBranch, dirtyBranch];

    bubbleFlags(root);

    expect(subtreeHasWork(cleanBranch)).toBe(false);
    expect(subtreeHasWork(dirtyBranch)).toBe(true);
  });

  it('should combine parent flags with subtree flags', () => {
    const parent = createFiber('div');
    const child = createFiber('span');

    markPlacement(parent);
    markUpdate(child);

    parent.children = [child];
    bubbleFlags(parent);

    expect(parent.flags).toBe(FiberFlags.Placement);
    expect(parent.subtreeFlags).toBe(FiberFlags.Update);
    // Total work on this node: own flags + subtree flags
    const totalWork = parent.flags | parent.subtreeFlags;
    expect(totalWork).toBe(FiberFlags.Placement | FiberFlags.Update);
  });
});
