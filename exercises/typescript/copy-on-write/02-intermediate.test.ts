import { describe, it, expect } from 'vitest';

/**
 * Copy-on-Write - Intermediate: Versioned Config.
 *
 * TODO: Implement a CoW config store where fork() creates a new version
 * that shares data with the original. Writing to a fork copies only the
 * modified keys — the original remains unchanged.
 *
 * Real-world use: Docker image layers, git branches, OS process fork().
 */

class VersionedConfig {
  private own = new Map<string, string>();
  private parent: VersionedConfig | null;

  constructor(parent: VersionedConfig | null = null) {
    // TODO: implement
    this.parent = parent;
  }

  /** Create a new version sharing this config's data. */
  fork(): VersionedConfig {
    // TODO: implement
    return new VersionedConfig(this);
  }

  /** Set a key. Only stores in this version's own layer. */
  set(key: string, value: string): void {
    // TODO: implement
    this.own.set(key, value);
  }

  /** Get a key. Walks up the parent chain if not found locally. */
  get(key: string): string | undefined {
    // TODO: implement
    if (this.own.has(key)) return this.own.get(key);
    if (this.parent) return this.parent.get(key);
    return undefined;
  }

  /** Check if a key exists in this version or any ancestor. */
  has(key: string): boolean {
    // TODO: implement
    if (this.own.has(key)) return true;
    if (this.parent) return this.parent.has(key);
    return false;
  }

  /** Number of keys owned directly by this version (not inherited). */
  get ownSize(): number {
    return this.own.size;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Copy-on-Write - Intermediate: Versioned Config', () => {
  it('should share data between original and fork', () => {
    const base = new VersionedConfig();
    base.set('host', 'localhost');
    base.set('port', '3000');

    const fork = base.fork();
    expect(fork.get('host')).toBe('localhost');
    expect(fork.get('port')).toBe('3000');
    expect(fork.ownSize).toBe(0); // fork hasn't written anything
  });

  it('should not affect original when writing to fork', () => {
    const base = new VersionedConfig();
    base.set('db', 'postgres');
    base.set('port', '5432');

    const staging = base.fork();
    staging.set('db', 'sqlite'); // override in fork only

    expect(staging.get('db')).toBe('sqlite');
    expect(base.get('db')).toBe('postgres'); // original unchanged
    expect(staging.get('port')).toBe('5432'); // inherited
  });

  it('should keep multiple forks independent', () => {
    const base = new VersionedConfig();
    base.set('env', 'production');

    const fork1 = base.fork();
    const fork2 = base.fork();

    fork1.set('env', 'staging');
    fork2.set('env', 'development');

    expect(fork1.get('env')).toBe('staging');
    expect(fork2.get('env')).toBe('development');
    expect(base.get('env')).toBe('production');
  });

  it('should preserve original after multiple fork writes', () => {
    const base = new VersionedConfig();
    base.set('a', '1');
    base.set('b', '2');
    base.set('c', '3');

    const child = base.fork();
    child.set('a', 'x');
    child.set('b', 'y');
    child.set('d', '4'); // new key only in child

    expect(base.get('a')).toBe('1');
    expect(base.get('b')).toBe('2');
    expect(base.get('c')).toBe('3');
    expect(base.has('d')).toBe(false);
    expect(child.ownSize).toBe(3);
  });

  it('should support nested fork chains', () => {
    const v1 = new VersionedConfig();
    v1.set('version', '1.0');
    v1.set('feature', 'basic');

    const v2 = v1.fork();
    v2.set('version', '2.0');

    const v3 = v2.fork();
    v3.set('feature', 'advanced');

    // v3 sees version from v2 and its own feature override
    expect(v3.get('version')).toBe('2.0');
    expect(v3.get('feature')).toBe('advanced');

    // v2 still has original feature
    expect(v2.get('feature')).toBe('basic');
    expect(v2.get('version')).toBe('2.0');

    // v1 untouched
    expect(v1.get('version')).toBe('1.0');
    expect(v1.get('feature')).toBe('basic');
  });
});
