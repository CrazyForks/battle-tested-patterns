import { describe, it, expect } from 'vitest';

/**
 * Bitmask - Basic: Fundamental bitwise flag operations.
 *
 * Learn to set, check, clear, and toggle individual flags
 * packed into a single integer using bitwise operators.
 */

// Define flags as powers of 2
const FLAGS = {
  READ: 1 << 0, // 0b0001
  WRITE: 1 << 1, // 0b0010
  EXECUTE: 1 << 2, // 0b0100
  DELETE: 1 << 3, // 0b1000
} as const;

describe('Bitmask - Basic: Bitwise Flag Operations', () => {
  it('should set a single flag using OR', () => {
    let permissions = 0;
    permissions = permissions | FLAGS.READ;
    expect(permissions).toBe(1);
    expect(permissions & FLAGS.READ).toBeTruthy();
  });

  it('should set multiple flags', () => {
    const permissions = FLAGS.READ | FLAGS.WRITE;
    expect(permissions).toBe(0b0011);
    expect(permissions & FLAGS.READ).toBeTruthy();
    expect(permissions & FLAGS.WRITE).toBeTruthy();
    expect(permissions & FLAGS.EXECUTE).toBeFalsy();
  });

  it('should check if a flag is set using AND', () => {
    const permissions = FLAGS.READ | FLAGS.EXECUTE;
    expect((permissions & FLAGS.READ) !== 0).toBe(true);
    expect((permissions & FLAGS.WRITE) !== 0).toBe(false);
    expect((permissions & FLAGS.EXECUTE) !== 0).toBe(true);
  });

  it('should clear a flag using AND + NOT', () => {
    let permissions = FLAGS.READ | FLAGS.WRITE | FLAGS.EXECUTE;
    permissions = permissions & ~FLAGS.WRITE;
    expect(permissions & FLAGS.READ).toBeTruthy();
    expect(permissions & FLAGS.WRITE).toBeFalsy();
    expect(permissions & FLAGS.EXECUTE).toBeTruthy();
  });

  it('should toggle a flag using XOR', () => {
    let permissions = FLAGS.READ;

    // Toggle WRITE on
    permissions = permissions ^ FLAGS.WRITE;
    expect(permissions & FLAGS.WRITE).toBeTruthy();

    // Toggle WRITE off
    permissions = permissions ^ FLAGS.WRITE;
    expect(permissions & FLAGS.WRITE).toBeFalsy();
  });

  it('should check if all flags in a mask are set', () => {
    const required = FLAGS.READ | FLAGS.WRITE;
    const userPerms = FLAGS.READ | FLAGS.WRITE | FLAGS.EXECUTE;
    const insufficientPerms = FLAGS.READ;

    expect((userPerms & required) === required).toBe(true);
    expect((insufficientPerms & required) === required).toBe(false);
  });

  it('should check if any flag in a mask is set', () => {
    const dangerousOps = FLAGS.WRITE | FLAGS.DELETE;
    const readOnly = FLAGS.READ;
    const editor = FLAGS.READ | FLAGS.WRITE;

    expect((readOnly & dangerousOps) !== 0).toBe(false);
    expect((editor & dangerousOps) !== 0).toBe(true);
  });
});
