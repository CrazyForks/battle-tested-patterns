/**
 * Shared toolchain detection + CI policy for scripts that exercise the
 * multi-language exercises/docs (TypeScript / Rust / Go / Python).
 *
 * Single source of truth for the project's long-standing convention:
 *   • Locally  — a missing toolchain is SKIPPED (don't force every contributor
 *                to install Rust + Go + Python just to run `pnpm test`).
 *   • In CI    — a missing toolchain is a HARD FAILURE, so the non-TS code is
 *                never silently left unverified (env CI=true).
 *
 * Extracted from verify-code-blocks.ts so test-exercises.ts can reuse the exact
 * same detection + policy (DRY: two call sites, one implementation).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Treat missing toolchains as failures in CI; skip them locally. */
export const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

/**
 * Return true if `cmd` is invokable (used as a cheap "is this toolchain
 * installed?" probe). Never throws — a missing binary resolves to false.
 */
export async function hasToolchain(cmd: string, args: string[] = ['--version']): Promise<boolean> {
  try {
    await execFileAsync(cmd, args, { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/** A toolchain we probe for, with the human-facing language label. */
export interface ToolchainSpec {
  /** Binary to probe, e.g. "rustc". */
  cmd: string;
  /** Probe args (some tools have no `--version`, e.g. `go version`). */
  args?: string[];
  /** Human label, e.g. "Rust". */
  label: string;
  /**
   * Optional minimum version (e.g. [3, 10] for Python 3.10+).
   * If set, the version output is parsed for the first `X.Y` match and
   * compared. A version below this is treated as "unavailable".
   */
  minVersion?: [number, number];
}

export interface ToolchainStatus {
  spec: ToolchainSpec;
  available: boolean;
  /** If available but version too low, explains why it was rejected. */
  reason?: string;
}

/**
 * Probe a set of toolchains concurrently and enforce the CI policy:
 * in CI, exit(1) listing every missing toolchain; locally, warn and continue.
 *
 * @returns the availability of each probed toolchain (caller decides what to
 *          run/skip based on `available`).
 */
/**
 * Parse the first "X.Y" version from a string (e.g. "Python 3.9.7" → [3, 9]).
 */
function parseVersion(output: string): [number, number] | null {
  const m = output.match(/(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function versionSatisfies(actual: [number, number], min: [number, number]): boolean {
  return actual[0] > min[0] || (actual[0] === min[0] && actual[1] >= min[1]);
}

export async function resolveToolchains(specs: ToolchainSpec[]): Promise<ToolchainStatus[]> {
  const statuses = await Promise.all(
    specs.map(async (spec) => {
      const exists = await hasToolchain(spec.cmd, spec.args);
      if (!exists) return { spec, available: false };

      // Version check (if minVersion specified).
      if (spec.minVersion) {
        try {
          const { stdout } = await execFileAsync(spec.cmd, spec.args ?? ['--version'], {
            timeout: 10_000,
          });
          const ver = parseVersion(stdout);
          if (ver && !versionSatisfies(ver, spec.minVersion)) {
            return {
              spec,
              available: false,
              reason: `found ${ver[0]}.${ver[1]}, need ≥ ${spec.minVersion[0]}.${spec.minVersion[1]}`,
            };
          }
        } catch {
          // If we can't parse version, assume OK (binary exists).
        }
      }
      return { spec, available: true };
    }),
  );

  const missing = statuses.filter((s) => !s.available);

  if (IS_CI && missing.length > 0) {
    console.error(`❌ Missing toolchains in CI: ${missing.map((s) => s.spec.cmd).join(', ')}`);
    console.error('   CI must provide all toolchains so multi-language code is truly exercised.');
    process.exit(1);
  }

  for (const s of missing) {
    const detail = s.reason ? ` (${s.reason})` : '';
    console.log(`⚠️  ${s.spec.cmd} not available${detail} — ${s.spec.label} skipped locally`);
  }

  return statuses;
}
