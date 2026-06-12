/**
 * verify-code-blocks.ts — Compile-check every fenced code block in the pattern
 * docs (TypeScript / Rust / Go / Python) so documentation code can never rot.
 *
 * Design goals (high availability / maintainability / reliability):
 *   • FAST    — one TypeScript Program for all TS blocks (lib.d.ts loaded once),
 *               `rustc --emit=metadata` (skips codegen+link), one shared Go module
 *               checked in a single `go vet ./...`, and bounded per-language
 *               concurrency. ~115s → ~10-20s locally.
 *   • RELIABLE— a code block may opt out with the `verify-skip` info-string flag
 *               (escape hatch for conceptual snippets). When a toolchain is
 *               missing we SKIP locally but FAIL in CI (env CI=true) so the docs'
 *               Rust/Go/Python examples are actually exercised by the pipeline.
 *   • MAINTAINABLE — extraction, wrapping and per-language verifiers are isolated
 *               pure-ish functions; adding a language is a localized change.
 *
 * Prior art this mirrors:
 *   • rustdoc / mdBook  — auto-wrap snippets lacking `fn main`, `--cap-lints allow`
 *   • TypeScript Twoslash — drive the compiler in-process, isolate blocks as modules
 *   • Go testable examples — many packages in one module, checked together
 */
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpus } from 'node:os';
import ts from 'typescript';

const execFileAsync = promisify(execFile);

const ROOT = join(import.meta.dirname, '..');
const DOCS_DIR = join(ROOT, 'docs', 'patterns');
const TMP_DIR = join(ROOT, '.tmp-code-verify');

/** Treat missing toolchains as failures in CI; skip them locally. */
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';
/** Bounded concurrency for compiler subprocesses (Rust/Python). */
const CONCURRENCY = Math.max(2, Math.min(cpus().length, 8));

type Lang = 'typescript' | 'rust' | 'go' | 'python';

interface CodeBlock {
  file: string;
  pattern: string;
  lang: Lang;
  code: string;
  line: number;
  /** From the info string, e.g. ```` ```rust verify-skip ````. */
  skip: boolean;
}

interface BlockResult {
  block: CodeBlock;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
  reason?: string;
}

// ─── Extraction ──────────────────────────────────────────────────────────────

function findPatternDocs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const index = join(full, 'index.md');
      try {
        statSync(index);
        results.push(index);
      } catch {
        /* directory without index.md — ignore */
      }
    }
  }
  return results;
}

const LANG_ALIASES: Record<string, Lang> = {
  typescript: 'typescript',
  ts: 'typescript',
  rust: 'rust',
  rs: 'rust',
  go: 'go',
  python: 'python',
  py: 'python',
};

/**
 * Extract fenced code blocks for the four verified languages. The info string
 * after the language token is parsed for the `verify-skip` flag, e.g.:
 *   ```rust verify-skip
 *   // conceptual pseudo-snippet, not meant to compile
 *   ```
 */
function extractCodeBlocks(file: string): CodeBlock[] {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const blocks: CodeBlock[] = [];
  const pattern = basename(join(file, '..'));

  let inBlock = false;
  let lang: Lang | null = null;
  let skip = false;
  let code: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const open = !inBlock ? /^```(\w+)(.*)$/.exec(line) : null;

    if (open && LANG_ALIASES[open[1]!.toLowerCase()]) {
      inBlock = true;
      lang = LANG_ALIASES[open[1]!.toLowerCase()]!;
      skip = /\bverify-skip\b/.test(open[2] ?? '');
      code = [];
      startLine = i + 1;
    } else if (inBlock && line === '```') {
      inBlock = false;
      if (code.length > 0 && lang) {
        blocks.push({ file, pattern, lang, code: code.join('\n'), line: startLine, skip });
      }
      lang = null;
    } else if (inBlock) {
      code.push(line);
    } else if (!inBlock && /^```/.test(line)) {
      // A fenced block in some other language — skip its body so an inner
      // ``` (rare) or a "go"-looking line cannot be mis-detected.
      for (i++; i < lines.length && lines[i] !== '```'; i++) {
        /* consume until close */
      }
    }
  }
  return blocks;
}

// ─── TypeScript: one Program for all blocks ──────────────────────────────────

const TS_OPTIONS: ts.CompilerOptions = {
  noEmit: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
};

/**
 * Check every TypeScript block in a single in-memory Program. Each block becomes
 * a distinct virtual file ending in `export {}` so it is an ES module — this
 * isolates top-level identifiers between blocks (a name declared in one block
 * does not collide with the same name in another).
 */
function verifyTypeScriptBatch(blocks: CodeBlock[]): Map<CodeBlock, string | null> {
  const results = new Map<CodeBlock, string | null>();
  if (blocks.length === 0) return results;

  const fileToBlock = new Map<string, CodeBlock>();
  const sources = new Map<string, string>();
  blocks.forEach((block, i) => {
    const fileName = `/__snippet_${i}.ts`;
    fileToBlock.set(fileName, block);
    // Trailing `export {}` forces module scope → per-block identifier isolation.
    sources.set(fileName, `${block.code}\nexport {};\n`);
  });

  const defaultHost = ts.createCompilerHost(TS_OPTIONS, true);
  const host: ts.CompilerHost = {
    ...defaultHost,
    fileExists: (f) => sources.has(f) || defaultHost.fileExists(f),
    readFile: (f) => (sources.has(f) ? sources.get(f) : defaultHost.readFile(f)),
    getSourceFile: (f, langVersion, onError, shouldCreate) => {
      const virtual = sources.get(f);
      if (virtual !== undefined) {
        return ts.createSourceFile(f, virtual, langVersion, true);
      }
      return defaultHost.getSourceFile(f, langVersion, onError, shouldCreate);
    },
  };

  const program = ts.createProgram([...sources.keys()], TS_OPTIONS, host);

  for (const [fileName, block] of fileToBlock) {
    const sourceFile = program.getSourceFile(fileName)!;
    const diagnostics = [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ];
    if (diagnostics.length === 0) {
      results.set(block, null);
    } else {
      const text = ts.formatDiagnostics(diagnostics, {
        getCurrentDirectory: () => '/',
        getCanonicalFileName: (f) => f,
        getNewLine: () => '\n',
      });
      results.set(block, text);
    }
  }
  return results;
}

// ─── Rust: --emit=metadata (no codegen/link), rustdoc-style wrapping ─────────

/**
 * Wrap a Rust snippet so it type-checks standalone, mirroring rustdoc's doctest
 * preprocessing: keep item-level declarations at top level and move statements
 * into a synthesized `fn main`. Item detection is line-prefix based (like
 * rustdoc) rather than brace-depth counting, which is robust against braces
 * inside strings/comments.
 */
function wrapRustSnippet(src: string): string {
  const prelude = '#![allow(dead_code, unused_variables, unused_imports, unused_mut)]\n';
  if (src.includes('fn main')) return prelude + src;

  const hasItem = /\b(struct|impl|enum|trait)\s/.test(src);
  if (hasItem) {
    // Top-level items already; just give it an entrypoint.
    return prelude + src + '\n\nfn main() {}';
  }

  const lines = src.split('\n');
  const decls: string[] = [];
  const stmts: string[] = [];
  let depth = 0;
  const ITEM_START = /^(pub\s+)?(fn|use|const|static|type|mod|trait|struct|enum|impl|extern)\b/;

  for (const line of lines) {
    const trimmed = line.trim();
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    if (depth > 0) {
      decls.push(line);
      depth += opens - closes;
    } else if (
      ITEM_START.test(trimmed) ||
      trimmed === '' ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('#[') ||
      trimmed.startsWith('#![')
    ) {
      decls.push(line);
      depth += opens - closes;
    } else {
      stmts.push(line);
    }
  }

  const body =
    stmts.length > 0
      ? `\n\nfn main() {\n${stmts.map((l) => '    ' + l).join('\n')}\n}`
      : '\n\nfn main() {}';
  return prelude + decls.join('\n') + body;
}

async function verifyRust(block: CodeBlock, index: number): Promise<string | null> {
  const file = join(TMP_DIR, `rust_${block.pattern}_${index}.rs`);
  writeFileSync(file, wrapRustSnippet(block.code));
  try {
    await execFileAsync(
      'rustc',
      [
        '--edition',
        '2021',
        '--emit=metadata', // type-check only: skip LLVM codegen + linking
        '--cap-lints',
        'allow', // documentation code should not fail on style lints
        '--crate-type',
        'lib', // metadata of a lib; no entrypoint requirement for emit
        '-o',
        file.replace('.rs', '.rmeta'),
        file,
      ],
      { timeout: 30000 },
    );
    return null;
  } catch (e) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string };
    return (err.stderr?.toString() || err.stdout?.toString() || err.message || 'rustc failed')
      .split('\n')
      .slice(0, 6)
      .join('\n');
  }
}

// ─── Go: one shared module, checked with a single `go vet ./...` ─────────────

const GO_IMPORT_HINTS: Array<[RegExp, string]> = [
  [/\bsync\./, '"sync"'],
  [/\bfmt\./, '"fmt"'],
  [/\btime\./, '"time"'],
  [/\bcontext\./, '"context"'],
  [/\bsort\./, '"sort"'],
  [/\brand\./, '"math/rand"'],
  [/\blist\./, '"container/list"'],
  [/\bstrconv\./, '"strconv"'],
  [/\bmath\./, '"math"'],
  [/\bio\./, '"io"'],
  [/\bbytes\./, '"bytes"'],
  [/\bstrings\./, '"strings"'],
  [/\berrors\./, '"errors"'],
  [/\bos\./, '"os"'],
  [/\batomic\./, '"sync/atomic"'],
];

function wrapGoSnippet(src: string): string {
  let code = src;

  if (!code.includes('package ')) {
    const imports = GO_IMPORT_HINTS.filter(([re]) => re.test(code)).map(([, pkg]) => pkg);
    const importBlock =
      imports.length > 0 ? `import (\n${imports.map((i) => '\t' + i).join('\n')}\n)\n\n` : '';
    code = `package main\n\n${importBlock}${code}`;
  }

  if (!code.includes('func main')) {
    const lines = code.split('\n');
    const decls: string[] = [];
    const stmts: string[] = [];
    let depth = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      if (depth > 0) {
        decls.push(line);
        depth += opens - closes;
      } else if (
        /^(package |import |func |type |const |var |\/\/|\))/.test(trimmed) ||
        /^[\t ]/.test(line) ||
        trimmed === ''
      ) {
        decls.push(line);
        depth += opens - closes;
      } else {
        stmts.push(line);
      }
    }
    code =
      stmts.length > 0
        ? `${decls.join('\n')}\n\nfunc main() {\n${stmts.map((l) => '\t' + l).join('\n')}\n}`
        : `${code}\n\nfunc main() {}`;
  }
  return code;
}

/**
 * Write every Go block into its own package directory inside ONE module, then
 * run a single `go vet ./...`. `go vet` runs the full type-checker before its
 * analyzers, so a type error fails the vet; this avoids 46 separate `go build`
 * invocations and reuses Go's build cache.
 */
async function verifyGoBatch(blocks: CodeBlock[]): Promise<Map<CodeBlock, string | null>> {
  const results = new Map<CodeBlock, string | null>();
  if (blocks.length === 0) return results;

  const moduleDir = join(TMP_DIR, 'go-module');
  mkdirSync(moduleDir, { recursive: true });
  writeFileSync(join(moduleDir, 'go.mod'), 'module verify\n\ngo 1.23\n');

  // dirName → block, so we can attribute `# verify/<dir>` errors back to blocks.
  const dirToBlock = new Map<string, CodeBlock>();
  blocks.forEach((block, i) => {
    const dirName = `s${i}`;
    const dir = join(moduleDir, dirName);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'main.go'), wrapGoSnippet(block.code));
    dirToBlock.set(dirName, block);
    results.set(block, null); // optimistic; flipped to error on attribution
  });

  try {
    await execFileAsync('go', ['vet', './...'], { cwd: moduleDir, timeout: 120000 });
    return results; // all clean
  } catch (e) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string };
    const output = err.stderr?.toString() || err.stdout?.toString() || err.message || '';
    attributeGoErrors(output, dirToBlock, results);
    return results;
  }
}

/**
 * `go vet ./...` prints diagnostics grouped per package, e.g.:
 *   # verify/s12
 *   s12/main.go:5:10: cannot use ...
 * Map each error line back to its originating block by the `sNN` directory.
 */
function attributeGoErrors(
  output: string,
  dirToBlock: Map<string, CodeBlock>,
  results: Map<CodeBlock, string | null>,
): void {
  const byDir = new Map<string, string[]>();
  for (const rawLine of output.split('\n')) {
    const m = /(?:^|\/)(s\d+)\/main\.go:/.exec(rawLine) || /\bverify\/(s\d+)\b/.exec(rawLine);
    if (m) {
      const dir = m[1]!;
      if (!byDir.has(dir)) byDir.set(dir, []);
      byDir.get(dir)!.push(rawLine.trim());
    }
  }
  for (const [dir, msgs] of byDir) {
    const block = dirToBlock.get(dir);
    if (block) results.set(block, msgs.slice(0, 6).join('\n'));
  }
}

// ─── Python: parallel py_compile ─────────────────────────────────────────────

async function verifyPython(block: CodeBlock, index: number): Promise<string | null> {
  const file = join(TMP_DIR, `py_${block.pattern}_${index}.py`);
  writeFileSync(file, block.code);
  try {
    await execFileAsync('python3', ['-m', 'py_compile', file], { timeout: 15000 });
    return null;
  } catch (e) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string };
    return (err.stderr?.toString() || err.stdout?.toString() || err.message || 'py_compile failed')
      .split('\n')
      .slice(0, 6)
      .join('\n');
  }
}

// ─── Concurrency helper ──────────────────────────────────────────────────────

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Toolchain detection ─────────────────────────────────────────────────────

async function hasToolchain(cmd: string, args: string[] = ['--version']): Promise<boolean> {
  try {
    await execFileAsync(cmd, args, { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Orchestration ───────────────────────────────────────────────────────────

async function main() {
  const docs = findPatternDocs(DOCS_DIR);
  console.log(`Found ${docs.length} pattern documents`);
  console.log(`Mode: ${IS_CI ? 'CI (missing toolchains are FAILURES)' : 'local (missing toolchains are skipped)'}\n`);

  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });

  const allBlocks = docs.flatMap(extractCodeBlocks);
  const byLang = (lang: Lang) => allBlocks.filter((b) => b.lang === lang && !b.skip);
  const skipped = allBlocks.filter((b) => b.skip);

  const [hasRust, hasGo, hasPython] = await Promise.all([
    hasToolchain('rustc'),
    hasToolchain('go', ['version']),
    hasToolchain('python3'),
  ]);

  // Hard fail in CI if a toolchain is missing — otherwise non-TS docs go
  // silently unverified (the historical gap this refactor closes).
  const missing: string[] = [];
  if (!hasRust) missing.push('rustc');
  if (!hasGo) missing.push('go');
  if (!hasPython) missing.push('python3');
  if (IS_CI && missing.length > 0) {
    console.error(`❌ Missing toolchains in CI: ${missing.join(', ')}`);
    console.error('   CI must provide all toolchains so docs code is truly verified.');
    process.exit(1);
  }
  for (const m of missing) {
    console.log(`⚠️  ${m} not found — ${m === 'rustc' ? 'Rust' : m === 'go' ? 'Go' : 'Python'} blocks skipped locally\n`);
  }

  const results: BlockResult[] = [];

  // Run the four languages concurrently; each manages its own internal batching.
  const t0 = Date.now();
  const [tsResults, rustResults, goResults, pyResults] = await Promise.all([
    // TypeScript — single Program, synchronous but wrapped in a microtask.
    Promise.resolve().then(() => verifyTypeScriptBatch(byLang('typescript'))),
    // Rust — bounded-concurrency subprocesses.
    hasRust
      ? mapLimit(byLang('rust'), CONCURRENCY, (b, i) => verifyRust(b, i))
      : Promise.resolve<(string | null)[]>([]),
    // Go — one shared module, single vet.
    hasGo ? verifyGoBatch(byLang('go')) : Promise.resolve(new Map<CodeBlock, string | null>()),
    // Python — bounded-concurrency subprocesses.
    hasPython
      ? mapLimit(byLang('python'), CONCURRENCY, (b, i) => verifyPython(b, i))
      : Promise.resolve<(string | null)[]>([]),
  ]);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // Collect TS
  for (const block of byLang('typescript')) {
    const err = tsResults.get(block) ?? null;
    results.push({ block, status: err ? 'fail' : 'pass', error: err ?? undefined });
  }
  // Collect Rust
  if (hasRust) {
    byLang('rust').forEach((block, i) => {
      const err = rustResults[i] ?? null;
      results.push({ block, status: err ? 'fail' : 'pass', error: err ?? undefined });
    });
  } else {
    byLang('rust').forEach((block) =>
      results.push({ block, status: 'skip', reason: 'rustc not installed' }),
    );
  }
  // Collect Go
  if (hasGo) {
    for (const block of byLang('go')) {
      const err = goResults.get(block) ?? null;
      results.push({ block, status: err ? 'fail' : 'pass', error: err ?? undefined });
    }
  } else {
    byLang('go').forEach((block) =>
      results.push({ block, status: 'skip', reason: 'go not installed' }),
    );
  }
  // Collect Python
  if (hasPython) {
    byLang('python').forEach((block, i) => {
      const err = pyResults[i] ?? null;
      results.push({ block, status: err ? 'fail' : 'pass', error: err ?? undefined });
    });
  } else {
    byLang('python').forEach((block) =>
      results.push({ block, status: 'skip', reason: 'python3 not installed' }),
    );
  }
  // Record explicitly skipped blocks.
  for (const block of skipped) {
    results.push({ block, status: 'skip', reason: 'verify-skip' });
  }

  rmSync(TMP_DIR, { recursive: true, force: true });

  // ─── Report ────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.status === 'pass');
  const failed = results.filter((r) => r.status === 'fail');
  const skippedResults = results.filter((r) => r.status === 'skip');

  for (const r of [...failed]) {
    console.log(`  ❌ ${r.block.pattern} [${r.block.lang}] (line ${r.block.line})`);
  }

  console.log(
    `\n${results.length} code blocks: ` +
      `${passed.length} passed, ${failed.length} failed, ${skippedResults.length} skipped ` +
      `(${elapsed}s)`,
  );

  if (skippedResults.length > 0) {
    const reasons = new Map<string, number>();
    for (const r of skippedResults) reasons.set(r.reason!, (reasons.get(r.reason!) ?? 0) + 1);
    console.log(
      '  skipped: ' +
        [...reasons].map(([reason, n]) => `${n}×${reason}`).join(', '),
    );
  }

  if (failed.length > 0) {
    console.log('\n❌ Failures (blocking):');
    for (const r of failed) {
      console.log(`\n  ${r.block.pattern} [${r.block.lang}] line ${r.block.line}:`);
      for (const errLine of (r.error ?? '').split('\n').slice(0, 6)) {
        console.log(`     ${errLine}`);
      }
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('verify-code-blocks crashed:', e);
  rmSync(TMP_DIR, { recursive: true, force: true });
  process.exit(1);
});
