/**
 * test-exercises.ts — Run the exercise test suites across all four languages
 * (TypeScript / Rust / Go / Python) with one command, mirroring what CI does
 * across its separate test-ts / test-rust / test-go / test-python jobs.
 *
 * Why this exists:
 *   `pnpm test` / `pnpm test:exercises` only ever ran the TypeScript (Vitest)
 *   suite, while CI also runs cargo / go test / pytest. That left a gap where a
 *   broken Rust/Go/Python exercise would pass locally and only fail in CI. This
 *   script closes that gap for contributors who have the toolchains installed.
 *
 * Policy (shared with verify-code-blocks via scripts/lib/toolchain.ts):
 *   • Locally  — a missing toolchain is SKIPPED (no need to install all four).
 *   • In CI    — a missing toolchain is a HARD FAILURE.
 *
 * Output is streamed live (inherited stdio) so the native test runners' own
 * progress/formatting is preserved. Exit code is non-zero if any suite fails.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { resolveToolchains, type ToolchainSpec } from './lib/toolchain.ts';

const ROOT = join(import.meta.dirname, '..');
const EXERCISES = join(ROOT, 'exercises');

interface Suite {
  label: string;
  /** Toolchain that must be present to run this suite (undefined = always). */
  toolchain?: ToolchainSpec;
  cmd: string;
  args: string[];
  cwd: string;
}

const PYTHON = process.env.PYTHON ?? 'python3';

const SUITES: Suite[] = [
  {
    label: 'TypeScript (Vitest)',
    cmd: 'pnpm',
    args: ['--filter', 'exercises', 'test'],
    cwd: ROOT,
  },
  {
    label: 'Rust (cargo test)',
    toolchain: { cmd: 'cargo', label: 'Rust' },
    cmd: 'cargo',
    args: ['test'],
    cwd: join(EXERCISES, 'rust'),
  },
  {
    label: 'Go (go test ./...)',
    toolchain: { cmd: 'go', args: ['version'], label: 'Go' },
    cmd: 'go',
    args: ['test', './...'],
    cwd: join(EXERCISES, 'go'),
  },
  {
    label: 'Python (pytest)',
    toolchain: { cmd: PYTHON, label: 'Python' },
    cmd: PYTHON,
    args: ['-m', 'pytest', '-q'],
    cwd: join(EXERCISES, 'python'),
  },
];

function run(suite: Suite): Promise<number> {
  return new Promise((resolve) => {
    console.log(`\n──────── ${suite.label} ────────`);
    const child = spawn(suite.cmd, suite.args, {
      cwd: suite.cwd,
      stdio: 'inherit',
      shell: false,
    });
    child.on('error', (err) => {
      console.error(`❌ Failed to launch ${suite.label}: ${err.message}`);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  // Probe the non-TS toolchains up front; this also enforces CI fail-hard.
  const probed = SUITES.map((s) => s.toolchain).filter((t): t is ToolchainSpec => Boolean(t));
  const statuses = await resolveToolchains(probed);
  const available = new Map(statuses.map((s) => [s.spec.cmd, s.available]));

  const results: { label: string; status: 'pass' | 'fail' | 'skip' }[] = [];

  // Run sequentially so the streamed output stays readable per language.
  for (const suite of SUITES) {
    if (suite.toolchain && !available.get(suite.toolchain.cmd)) {
      results.push({ label: suite.label, status: 'skip' });
      continue;
    }
    const code = await run(suite);
    results.push({ label: suite.label, status: code === 0 ? 'pass' : 'fail' });
  }

  console.log('\n──────── Summary ────────');
  for (const r of results) {
    const label = r.status === 'skip' ? `${r.label} (skipped)` : r.label;
    const icon = r.status === 'pass' ? '✓' : r.status === 'skip' ? '-' : '✗';
    console.log(`  ${icon} ${label}`);
  }

  const failed = results.filter((r) => r.status === 'fail').length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`❌ test-exercises crashed: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
