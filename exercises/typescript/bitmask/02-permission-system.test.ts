import { describe, it, expect } from 'vitest';

/**
 * Bitmask - Intermediate: Build a permission system.
 *
 * Design a role-based permission system where each role
 * is a combination of permission flags, similar to Unix file permissions.
 */

const Permission = {
  NONE: 0,
  READ: 1 << 0,
  WRITE: 1 << 1,
  DELETE: 1 << 2,
  ADMIN: 1 << 3,
} as const;

type PermissionFlags = number;

function createRole(...perms: number[]): PermissionFlags {
  return perms.reduce((acc, p) => acc | p, 0);
}

function hasPermission(role: PermissionFlags, perm: number): boolean {
  return (role & perm) === perm;
}

function hasAnyPermission(role: PermissionFlags, mask: number): boolean {
  return (role & mask) !== 0;
}

function grant(role: PermissionFlags, perm: number): PermissionFlags {
  return role | perm;
}

function revoke(role: PermissionFlags, perm: number): PermissionFlags {
  return role & ~perm;
}

function listPermissions(role: PermissionFlags): string[] {
  const names: string[] = [];
  if (role & Permission.READ) names.push('READ');
  if (role & Permission.WRITE) names.push('WRITE');
  if (role & Permission.DELETE) names.push('DELETE');
  if (role & Permission.ADMIN) names.push('ADMIN');
  return names;
}

describe('Bitmask - Intermediate: Permission System', () => {
  const VIEWER = createRole(Permission.READ);
  const EDITOR = createRole(Permission.READ, Permission.WRITE);
  const MODERATOR = createRole(Permission.READ, Permission.WRITE, Permission.DELETE);
  const SUPER_ADMIN = createRole(Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN);

  it('should create roles with correct flags', () => {
    expect(VIEWER).toBe(0b0001);
    expect(EDITOR).toBe(0b0011);
    expect(MODERATOR).toBe(0b0111);
    expect(SUPER_ADMIN).toBe(0b1111);
  });

  it('should check individual permissions', () => {
    expect(hasPermission(VIEWER, Permission.READ)).toBe(true);
    expect(hasPermission(VIEWER, Permission.WRITE)).toBe(false);
    expect(hasPermission(EDITOR, Permission.READ)).toBe(true);
    expect(hasPermission(EDITOR, Permission.WRITE)).toBe(true);
    expect(hasPermission(EDITOR, Permission.DELETE)).toBe(false);
  });

  it('should check compound permissions', () => {
    const editAccess = Permission.READ | Permission.WRITE;
    expect(hasPermission(EDITOR, editAccess)).toBe(true);
    expect(hasPermission(VIEWER, editAccess)).toBe(false);
  });

  it('should check if any permission matches', () => {
    const writeOrDelete = Permission.WRITE | Permission.DELETE;
    expect(hasAnyPermission(VIEWER, writeOrDelete)).toBe(false);
    expect(hasAnyPermission(EDITOR, writeOrDelete)).toBe(true);
    expect(hasAnyPermission(MODERATOR, writeOrDelete)).toBe(true);
  });

  it('should grant permissions', () => {
    const promoted = grant(VIEWER, Permission.WRITE);
    expect(hasPermission(promoted, Permission.READ)).toBe(true);
    expect(hasPermission(promoted, Permission.WRITE)).toBe(true);
  });

  it('should revoke permissions', () => {
    const demoted = revoke(EDITOR, Permission.WRITE);
    expect(hasPermission(demoted, Permission.READ)).toBe(true);
    expect(hasPermission(demoted, Permission.WRITE)).toBe(false);
  });

  it('should list active permissions', () => {
    expect(listPermissions(VIEWER)).toEqual(['READ']);
    expect(listPermissions(EDITOR)).toEqual(['READ', 'WRITE']);
    expect(listPermissions(SUPER_ADMIN)).toEqual(['READ', 'WRITE', 'DELETE', 'ADMIN']);
    expect(listPermissions(Permission.NONE)).toEqual([]);
  });

  it('should handle grant of already-granted permission (idempotent)', () => {
    const result = grant(EDITOR, Permission.READ);
    expect(result).toBe(EDITOR);
  });

  it('should handle revoke of not-granted permission (idempotent)', () => {
    const result = revoke(VIEWER, Permission.DELETE);
    expect(result).toBe(VIEWER);
  });
});
