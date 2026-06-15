import { describe, it, expect } from 'vitest';

/**
 * Dirty Flag - Intermediate: Transform hierarchy with world position caching.
 *
 * TODO: Implement a TransformNode with:
 * - setPosition(x, y): Set local position, mark self and all descendants dirty
 * - getWorldPosition(): Return {x, y} in world space (parent + local), using dirty flag caching
 * - addChild(child): Add a child node, setting its parent
 *
 * Real-world use: Game scene graphs, UI layout engines, 3D transform hierarchies.
 */

class TransformNode {
  private localX = 0;
  private localY = 0;
  private worldDirty = true;
  private worldX = 0;
  private worldY = 0;
  private children: TransformNode[] = [];
  private parent: TransformNode | null = null;

  setPosition(x: number, y: number): void {
    // TODO: implement
    this.localX = x;
    this.localY = y;
    this.markWorldDirty();
  }

  getWorldPosition(): { x: number; y: number } {
    // TODO: implement
    if (this.worldDirty) {
      if (this.parent) {
        const pw = this.parent.getWorldPosition();
        this.worldX = pw.x + this.localX;
        this.worldY = pw.y + this.localY;
      } else {
        this.worldX = this.localX;
        this.worldY = this.localY;
      }
      this.worldDirty = false;
    }
    return { x: this.worldX, y: this.worldY };
  }

  addChild(child: TransformNode): void {
    // TODO: implement
    child.parent = this;
    this.children.push(child);
    child.markWorldDirty();
  }

  get isDirty(): boolean {
    return this.worldDirty;
  }

  private markWorldDirty(): void {
    this.worldDirty = true;
    for (const child of this.children) {
      child.markWorldDirty();
    }
  }
}

// --- Tests (do not modify below this line) ---

describe('Dirty Flag - Intermediate: Transform Hierarchy', () => {
  it('should compute world position for root node', () => {
    const root = new TransformNode();
    root.setPosition(10, 20);
    expect(root.getWorldPosition()).toEqual({ x: 10, y: 20 });
  });

  it('should compute world position relative to parent', () => {
    const parent = new TransformNode();
    const child = new TransformNode();
    parent.setPosition(100, 200);
    parent.addChild(child);
    child.setPosition(10, 20);
    expect(child.getWorldPosition()).toEqual({ x: 110, y: 220 });
  });

  it('should cascade dirty flag to children when parent moves', () => {
    const root = new TransformNode();
    const child = new TransformNode();
    const grandchild = new TransformNode();
    root.addChild(child);
    child.addChild(grandchild);

    root.setPosition(0, 0);
    child.setPosition(10, 0);
    grandchild.setPosition(5, 0);

    expect(grandchild.getWorldPosition()).toEqual({ x: 15, y: 0 });

    // Move root — all descendants should become dirty
    root.setPosition(100, 0);
    expect(child.isDirty).toBe(true);
    expect(grandchild.isDirty).toBe(true);
    expect(grandchild.getWorldPosition()).toEqual({ x: 115, y: 0 });
  });

  it('should cache world position when clean', () => {
    const root = new TransformNode();
    const child = new TransformNode();
    root.addChild(child);
    root.setPosition(10, 10);
    child.setPosition(5, 5);

    // First call computes
    const pos1 = child.getWorldPosition();
    expect(pos1).toEqual({ x: 15, y: 15 });
    expect(child.isDirty).toBe(false);

    // Second call returns cached (no recompute)
    const pos2 = child.getWorldPosition();
    expect(pos2).toEqual({ x: 15, y: 15 });
  });

  it('should handle deep hierarchy', () => {
    const nodes: TransformNode[] = [];
    for (let i = 0; i < 5; i++) {
      const node = new TransformNode();
      node.setPosition(10, 0);
      if (i > 0) nodes[i - 1]!.addChild(node);
      nodes.push(node);
    }
    // Each adds 10 to x: 10 + 10 + 10 + 10 + 10 = 50
    expect(nodes[4]!.getWorldPosition()).toEqual({ x: 50, y: 0 });

    // Move root by 100
    nodes[0]!.setPosition(110, 0);
    expect(nodes[4]!.getWorldPosition()).toEqual({ x: 150, y: 0 });
  });
});
