import { describe, it, expect } from 'vitest';

/**
 * Trie - Intermediate: Autocomplete with ranked results.
 *
 * TODO: Implement a Trie that supports autocomplete(prefix, limit).
 * Each word has a frequency score set at insert time. autocomplete()
 * returns up to `limit` words matching the prefix, sorted by frequency
 * descending (highest first). Ties broken alphabetically.
 *
 * Real-world use: search bars, IDE code completion, command palettes.
 */

class TrieNode {
  children = new Map<string, TrieNode>();
  isEnd = false;
  frequency = 0;
}

class AutocompleteTrie {
  private root = new TrieNode();

  /** Insert a word with its frequency score. */
  insert(word: string, frequency: number): void {
    // TODO: implement
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch)!;
    }
    node.isEnd = true;
    node.frequency = frequency;
  }

  /**
   * Return up to `limit` words that start with `prefix`,
   * sorted by frequency descending, then alphabetically.
   * If prefix is empty, return top words from entire trie.
   */
  autocomplete(prefix: string, limit: number): string[] {
    // TODO: implement
    const node = this.findNode(prefix);
    if (!node) return [];

    const results: Array<{ word: string; frequency: number }> = [];
    this.collectWords(node, prefix, results);

    results.sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return a.word.localeCompare(b.word);
    });

    return results.slice(0, limit).map((r) => r.word);
  }

  private findNode(prefix: string): TrieNode | null {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children.has(ch)) return null;
      node = node.children.get(ch)!;
    }
    return node;
  }

  private collectWords(
    node: TrieNode,
    current: string,
    results: Array<{ word: string; frequency: number }>,
  ): void {
    if (node.isEnd) {
      results.push({ word: current, frequency: node.frequency });
    }
    for (const [ch, child] of node.children) {
      this.collectWords(child, current + ch, results);
    }
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Trie - Intermediate: Autocomplete', () => {
  it('should return basic completions sorted by frequency', () => {
    const trie = new AutocompleteTrie();
    trie.insert('apple', 50);
    trie.insert('application', 80);
    trie.insert('apply', 30);

    const results = trie.autocomplete('app', 10);
    expect(results).toEqual(['application', 'apple', 'apply']);
  });

  it('should limit the number of results', () => {
    const trie = new AutocompleteTrie();
    trie.insert('cat', 10);
    trie.insert('car', 50);
    trie.insert('card', 40);
    trie.insert('care', 30);
    trie.insert('cart', 20);

    const results = trie.autocomplete('car', 2);
    expect(results).toHaveLength(2);
    expect(results).toEqual(['car', 'card']);
  });

  it('should return empty array when no matches exist', () => {
    const trie = new AutocompleteTrie();
    trie.insert('hello', 10);
    trie.insert('help', 20);

    expect(trie.autocomplete('xyz', 5)).toEqual([]);
    expect(trie.autocomplete('hero', 5)).toEqual([]);
  });

  it('should return all words when prefix is empty', () => {
    const trie = new AutocompleteTrie();
    trie.insert('banana', 30);
    trie.insert('apple', 50);
    trie.insert('cherry', 10);

    const results = trie.autocomplete('', 10);
    expect(results).toEqual(['apple', 'banana', 'cherry']);
  });

  it('should handle shared prefixes with correct ranking', () => {
    const trie = new AutocompleteTrie();
    trie.insert('react', 100);
    trie.insert('reactive', 40);
    trie.insert('reactor', 40);
    trie.insert('read', 60);
    trie.insert('readme', 80);

    const results = trie.autocomplete('rea', 5);
    // react(100), readme(80), read(60), reactive(40), reactor(40)
    // reactive vs reactor: same freq, alphabetical order
    expect(results).toEqual(['react', 'readme', 'read', 'reactive', 'reactor']);
  });
});
