import { describe, it, expect } from 'vitest';

/**
 * Bloom Filter - Intermediate: Spell Checker.
 *
 * TODO: Build a spell checker by loading a dictionary into a
 * bloom filter. The checker can quickly reject words that are
 * definitely NOT in the dictionary, while accepting that a small
 * percentage of misspelled words may slip through (false positives).
 *
 * Real-world use: Chrome's built-in spell checker, email spam
 * filters, and network security appliances use bloom filters
 * for fast set-membership tests on large datasets.
 */

function hashFn(str: string, seed: number, size: number): number {
  // TODO: implement — generic seeded hash
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
    h = (h ^ (h >>> 16)) | 0;
  }
  return ((h % size) + size) % size;
}

class SpellChecker {
  private bits: Uint8Array;
  private size: number;
  private seeds: number[];

  constructor(expectedWords: number, falsePositiveRate = 0.05) {
    // TODO: implement — calculate optimal size and hash count
    // Optimal bit array size: m = -(n * ln(p)) / (ln(2)^2)
    this.size = Math.ceil(
      -(expectedWords * Math.log(falsePositiveRate)) / (Math.log(2) ** 2),
    );
    // Optimal hash count: k = (m/n) * ln(2)
    const k = Math.ceil((this.size / expectedWords) * Math.log(2));
    this.seeds = Array.from({ length: k }, (_, i) => 31 * (i + 1) + 7);
    this.bits = new Uint8Array(this.size);
  }

  /** Load a word into the dictionary. */
  addWord(word: string): void {
    // TODO: implement
    const lower = word.toLowerCase();
    for (const seed of this.seeds) {
      this.bits[hashFn(lower, seed, this.size)] = 1;
    }
  }

  /** Load many words at once. */
  loadDictionary(words: string[]): void {
    for (const w of words) this.addWord(w);
  }

  /** Check if a word might be in the dictionary. */
  check(word: string): boolean {
    // TODO: implement
    const lower = word.toLowerCase();
    for (const seed of this.seeds) {
      if (this.bits[hashFn(lower, seed, this.size)] !== 1) return false;
    }
    return true;
  }
}

// ─── Tests (do not modify below this line) ───────────────────────

describe('Bloom Filter - Intermediate: Spell Checker', () => {
  const dictionary = [
    'apple', 'banana', 'cherry', 'date', 'elderberry',
    'fig', 'grape', 'honeydew', 'kiwi', 'lemon',
    'mango', 'nectarine', 'orange', 'papaya', 'quince',
    'raspberry', 'strawberry', 'tangerine', 'watermelon', 'blueberry',
  ];

  it('should recognize all dictionary words', () => {
    const checker = new SpellChecker(100);
    checker.loadDictionary(dictionary);

    for (const word of dictionary) {
      expect(checker.check(word)).toBe(true);
    }
  });

  it('should be case-insensitive', () => {
    const checker = new SpellChecker(100);
    checker.loadDictionary(dictionary);

    expect(checker.check('APPLE')).toBe(true);
    expect(checker.check('Banana')).toBe(true);
    expect(checker.check('CHERRY')).toBe(true);
  });

  it('should reject most unknown words (false positive rate < 10%)', () => {
    const checker = new SpellChecker(dictionary.length, 0.05);
    checker.loadDictionary(dictionary);

    // Generate 200 random strings that are NOT in the dictionary
    const unknowns: string[] = [];
    for (let i = 0; i < 200; i++) {
      unknowns.push(`xyzzy${i}qworp${i * 7}`);
    }

    let falsePositives = 0;
    for (const word of unknowns) {
      if (checker.check(word)) falsePositives++;
    }

    const fpRate = falsePositives / unknowns.length;
    expect(fpRate).toBeLessThan(0.1);
  });

  it('should return false for everything on an empty filter', () => {
    const checker = new SpellChecker(100);
    expect(checker.check('hello')).toBe(false);
    expect(checker.check('world')).toBe(false);
    expect(checker.check('')).toBe(false);
  });

  it('should handle a large dictionary without degradation', () => {
    const largeDict = Array.from({ length: 1000 }, (_, i) => `word${i}`);
    const checker = new SpellChecker(1000, 0.01);
    checker.loadDictionary(largeDict);

    // All added words must be found (no false negatives)
    for (const word of largeDict) {
      expect(checker.check(word)).toBe(true);
    }
  });
});
