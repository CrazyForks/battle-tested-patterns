/**
 * run-python.ts — Find the best available Python interpreter (≥ 3.10) and
 * run pytest in exercises/python.
 *
 * Why this exists:
 *   On macOS, `python3` often resolves to the system CommandLineTools Python
 *   (3.9.x) even when conda/pyenv/homebrew provides a newer version as `python`.
 *   This script probes multiple candidates in priority order and uses the first
 *   one that satisfies the minimum version requirement.
 *
 * Probe order:
 *   1. $PYTHON env var (explicit override)
 *   2. `python` (conda/pyenv typically set this)
 *   3. `python3` (system fallback)
 *   4. `python3.12`, `python3.11`, `python3.10` (versioned binaries)
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const MIN_VERSION: [number, number] = [3, 10];
const EXERCISES_PYTHON = join(import.meta.dirname, '..', 'exercises', 'python');

const candidates: string[] = [
  ...(process.env.PYTHON ? [process.env.PYTHON] : []),
  'python',
  'python3',
  'python3.13',
  'python3.12',
  'python3.11',
  'python3.10',
];

interface PythonInfo {
  cmd: string;
  path: string;
  version: [number, number, number];
}

function probe(cmd: string): PythonInfo | null {
  try {
    const out = execFileSync(cmd, ['-c', 'import sys; print(sys.executable, sys.version_info.major, sys.version_info.minor, sys.version_info.micro)'], {
      timeout: 5000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const [path, major, minor, micro] = out.split(' ');
    return { cmd, path, version: [Number(major), Number(minor), Number(micro)] };
  } catch {
    return null;
  }
}

function main() {
  let chosen: PythonInfo | null = null;

  for (const cmd of candidates) {
    const info = probe(cmd);
    if (!info) continue;
    if (info.version[0] > MIN_VERSION[0] || (info.version[0] === MIN_VERSION[0] && info.version[1] >= MIN_VERSION[1])) {
      chosen = info;
      break;
    }
  }

  if (!chosen) {
    const tried = candidates.join(', ');
    console.error(`❌ No Python ≥ ${MIN_VERSION[0]}.${MIN_VERSION[1]} found.`);
    console.error(`   Tried: ${tried}`);
    console.error(`   Install Python 3.10+ or set PYTHON=/path/to/python3.10+`);
    console.error(`   macOS tip: if using conda, ensure \`conda init\` is in your shell profile.`);
    process.exit(1);
  }

  console.log(`Using: ${chosen.path} (Python ${chosen.version.join('.')})`);

  const result = spawnSync(chosen.path, ['-m', 'pytest', '-q'], {
    cwd: EXERCISES_PYTHON,
    stdio: 'inherit',
  });

  process.exit(result.status ?? 1);
}

main();
