import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';

const DOCS_DIR = join(import.meta.dirname, '..', 'docs', 'patterns');
const TMP_DIR = join(import.meta.dirname, '..', '.tmp-code-verify');

interface CodeBlock {
  file: string;
  pattern: string;
  lang: string;
  code: string;
  line: number;
}

function findPatternDocs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const index = join(full, 'index.md');
      try { statSync(index); results.push(index); } catch {}
    }
  }
  return results;
}

function extractCodeBlocks(file: string): CodeBlock[] {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const blocks: CodeBlock[] = [];
  const pattern = basename(join(file, '..'));
  let inBlock = false, lang = '', code: string[] = [], startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!inBlock && /^```(typescript|rust|go|python)/.test(line)) {
      inBlock = true;
      lang = line.match(/^```(\w+)/)?.[1] || '';
      code = [];
      startLine = i + 1;
    } else if (inBlock && line === '```') {
      inBlock = false;
      if (code.length > 0) blocks.push({ file, pattern, lang, code: code.join('\n'), line: startLine });
    } else if (inBlock) {
      code.push(line);
    }
  }
  return blocks;
}

function verifyTypeScript(block: CodeBlock): string | null {
  const file = join(TMP_DIR, `${block.pattern}.ts`);
  writeFileSync(file, block.code);
  try {
    execSync(`npx tsc --noEmit --strict --target ES2022 --moduleResolution bundler "${file}" 2>&1`, { timeout: 15000 });
    return null;
  } catch (e: any) {
    return e.stdout?.toString() || e.message;
  }
}

function verifyPython(block: CodeBlock): string | null {
  const file = join(TMP_DIR, `${block.pattern}.py`);
  writeFileSync(file, block.code);
  try {
    execSync(`python3 -c "import py_compile; py_compile.compile('${file}', doraise=True)" 2>&1`, { timeout: 10000 });
    return null;
  } catch (e: any) {
    return e.stdout?.toString() || e.message;
  }
}

function verifyRust(block: CodeBlock): string | null {
  const file = join(TMP_DIR, `${block.pattern}_${block.line}.rs`);
  let code = block.code;

  const hasMain = code.includes('fn main');
  const hasStructOrImpl = code.includes('struct ') || code.includes('impl ') || code.includes('enum ');

  if (!hasMain) {
    if (hasStructOrImpl) {
      // Code with struct/impl: append fn main() at the end
      code += '\n\nfn main() {}';
    } else {
      // Pure function/const definitions + usage statements: wrap usage in main
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
        } else if (/^(pub |)(fn |use |const |static |type |mod |trait )/.test(trimmed) || trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('#[')) {
          decls.push(line);
          depth += opens - closes;
        } else {
          stmts.push(line);
        }
      }

      if (stmts.length > 0) {
        code = decls.join('\n') + '\n\nfn main() {\n' + stmts.map(l => '    ' + l).join('\n') + '\n}';
      } else {
        code += '\n\nfn main() {}';
      }
    }
  }

  code = '#![allow(dead_code, unused_variables, unused_imports, unused_mut)]\n' + code;
  writeFileSync(file, code);
  try {
    const outFile = file.replace('.rs', '');
    execSync(`rustc --edition 2021 "${file}" -o "${outFile}" 2>&1`, { timeout: 30000 });
    try { rmSync(outFile); } catch {}
    return null;
  } catch (e: any) {
    return (e.stderr?.toString() || e.stdout?.toString() || e.message).split('\n').slice(0, 5).join('\n');
  }
}

function verifyGo(block: CodeBlock): string | null {
  const dir = join(TMP_DIR, `go_${block.pattern}_${block.line}`);
  mkdirSync(dir, { recursive: true });

  let code = block.code;
  const hasPackage = code.includes('package ');

  if (!hasPackage) {
    // Detect needed imports
    const imports: string[] = [];
    if (/\bsync\./.test(code)) imports.push('"sync"');
    if (/\bfmt\./.test(code)) imports.push('"fmt"');
    if (/\btime\./.test(code)) imports.push('"time"');
    if (/\bcontext\./.test(code)) imports.push('"context"');
    if (/\bsort\./.test(code)) imports.push('"sort"');
    if (/\brand\./.test(code)) imports.push('"math/rand"');
    if (/\blist\./.test(code)) imports.push('"container/list"');
    if (/\bbisect\./.test(code)) imports.push('"sort"');
    if (/\bstrconv\./.test(code)) imports.push('"strconv"');
    if (/\bmath\./.test(code)) imports.push('"math"');
    if (/\bio\./.test(code)) imports.push('"io"');
    if (/\bbytes\./.test(code)) imports.push('"bytes"');
    if (/\bstrings\./.test(code)) imports.push('"strings"');

    const importBlock = imports.length > 0 ? `import (\n${imports.map(i => '\t' + i).join('\n')}\n)\n\n` : '';
    code = `package main\n\n${importBlock}${code}`;
  }

  // Wrap top-level statements (like x := ...) in func main
  if (!code.includes('func main')) {
    const goLines = code.split('\n');
    const goDecls: string[] = [];
    const goStmts: string[] = [];
    let goDepth = 0;

    for (const line of goLines) {
      const trimmed = line.trim();
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;

      if (goDepth > 0) {
        goDecls.push(line);
        goDepth += opens - closes;
      } else if (/^(package |import |func |type |const |var |\/\/|\)|	)/.test(trimmed) || /^\t/.test(line) || trimmed === '' || /^    /.test(line)) {
        goDecls.push(line);
        goDepth += opens - closes;
      } else if (/^[A-Z]/.test(trimmed) && goDepth === 0) {
        // Exported function call or type at package level — likely a statement
        goStmts.push(line);
      } else {
        goStmts.push(line);
      }
    }

    if (goStmts.length > 0) {
      code = goDecls.join('\n') + '\n\nfunc main() {\n' + goStmts.map(l => '\t' + l).join('\n') + '\n}';
    } else {
      code += '\n\nfunc main() {}';
    }
  }

  // Write go.mod
  writeFileSync(join(dir, 'go.mod'), 'module verify\n\ngo 1.23\n');
  writeFileSync(join(dir, 'main.go'), code);
  try {
    execSync(`cd "${dir}" && go build ./... 2>&1`, { timeout: 15000 });
    return null;
  } catch (e: any) {
    return (e.stderr?.toString() || e.stdout?.toString() || e.message).split('\n').slice(0, 5).join('\n');
  }
}

function hasToolchain(cmd: string): boolean {
  try { execSync(`which ${cmd}`, { stdio: 'ignore' }); return true; } catch { return false; }
}

async function main() {
  const docs = findPatternDocs(DOCS_DIR);
  console.log(`Found ${docs.length} pattern documents\n`);
  mkdirSync(TMP_DIR, { recursive: true });

  const hasGo = hasToolchain('go');
  const hasRust = hasToolchain('rustc');
  const hasPython = hasToolchain('python3');

  if (!hasGo) console.log('⚠️  Go not found — Go blocks will be skipped locally (verified in CI)\n');
  if (!hasRust) console.log('⚠️  Rust not found — Rust blocks will be skipped locally (verified in CI)\n');

  const results: Array<{ block: CodeBlock; error: string | null }> = [];

  for (const doc of docs) {
    const blocks = extractCodeBlocks(doc);
    for (const block of blocks) {
      let error: string | null = null;
      let skipped = false;

      switch (block.lang) {
        case 'typescript': error = verifyTypeScript(block); break;
        case 'python': error = hasPython ? verifyPython(block) : null; skipped = !hasPython; break;
        case 'rust': if (hasRust) { error = verifyRust(block); } else { skipped = true; } break;
        case 'go': if (hasGo) { error = verifyGo(block); } else { skipped = true; } break;
        default: continue;
      }

      if (skipped) {
        console.log(`  ⏭️  ${block.pattern} [${block.lang}] (line ${block.line})`);
        continue;
      }

      const status = error ? '❌' : '✅';
      console.log(`  ${status} ${block.pattern} [${block.lang}] (line ${block.line})`);
      if (error) results.push({ block, error });
      else results.push({ block, error: null });
    }
  }

  try { rmSync(TMP_DIR, { recursive: true, force: true }); } catch {}

  const failures = results.filter((r) => r.error);
  const passed = results.filter((r) => !r.error);

  console.log(`\n${results.length} code blocks verified: ${passed.length} passed, ${failures.length} failed`);

  if (failures.length > 0) {
    console.log('\n❌ Failures (blocking):');
    for (const f of failures) {
      console.log(`\n  ${f.block.pattern} [${f.block.lang}] line ${f.block.line}:`);
      console.log(`     ${f.error?.split('\n')[0]}`);
    }
    process.exit(1);
  }
}

main();
