import { describe, it, expect } from 'vitest';

/**
 * Flyweight - Intermediate: Icon Registry.
 *
 * TODO: Implement a registry that deduplicates icon objects by name.
 * getIcon(name) returns the same object instance for the same name,
 * avoiding redundant allocations. Supports clear() to reset the pool.
 *
 * Real-world use: UI toolkits (VS Code icon cache), game sprite pools,
 * font glyph caches.
 */

interface Icon {
  name: string;
  svg: string;
}

class IconRegistry {
  private pool = new Map<string, Icon>();

  /** Return cached icon or create and cache a new one. */
  getIcon(name: string): Icon {
    // TODO: implement
    if (this.pool.has(name)) return this.pool.get(name)!;
    const icon: Icon = { name, svg: `<svg id="${name}" />` };
    this.pool.set(name, icon);
    return icon;
  }

  /** Number of unique icons in the pool. */
  get size(): number {
    // TODO: implement
    return this.pool.size;
  }

  /** Clear all cached icons. */
  clear(): void {
    // TODO: implement
    this.pool.clear();
  }

  /** Check if an icon is cached. */
  has(name: string): boolean {
    // TODO: implement
    return this.pool.has(name);
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Flyweight - Intermediate: Icon Registry', () => {
  it('should return the same instance for the same icon name', () => {
    const registry = new IconRegistry();
    const a = registry.getIcon('home');
    const b = registry.getIcon('home');

    expect(a).toBe(b); // same reference
    expect(a.name).toBe('home');
  });

  it('should return different instances for different names', () => {
    const registry = new IconRegistry();
    const home = registry.getIcon('home');
    const search = registry.getIcon('search');
    const settings = registry.getIcon('settings');

    expect(home).not.toBe(search);
    expect(search).not.toBe(settings);
    expect(home.name).toBe('home');
    expect(search.name).toBe('search');
  });

  it('should count unique instances correctly', () => {
    const registry = new IconRegistry();
    registry.getIcon('star');
    registry.getIcon('heart');
    registry.getIcon('star'); // duplicate
    registry.getIcon('bell');
    registry.getIcon('heart'); // duplicate

    expect(registry.size).toBe(3);
  });

  it('should clear the registry', () => {
    const registry = new IconRegistry();
    const before = registry.getIcon('arrow');
    expect(registry.has('arrow')).toBe(true);

    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.has('arrow')).toBe(false);
  });

  it('should create fresh instances after clear', () => {
    const registry = new IconRegistry();
    const before = registry.getIcon('menu');

    registry.clear();
    const after = registry.getIcon('menu');

    // New instance created after clear — not the same reference
    expect(after).not.toBe(before);
    expect(after.name).toBe('menu');
    expect(registry.size).toBe(1);
  });
});
