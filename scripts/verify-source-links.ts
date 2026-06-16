import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DOCS_DIR = join(ROOT, 'docs');
const ROOT_READMES = ['README.md', 'README.zh-CN.md'].map((f) => join(ROOT, f));
const GITHUB_URL_RE = /https:\/\/github\.com\/[^\s)>\]"']+/g;

interface LinkResult {
  file: string;
  url: string;
  status: number | 'error';
  ok: boolean;
  isProductionProof: boolean;
  hasLineNumber: boolean;
  isBranchLink: boolean;
}

function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === '.vitepress') continue;
    if (statSync(full).isDirectory()) {
      results.push(...findMarkdownFiles(full));
    } else if (entry.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function extractLinks(content: string): Array<{ url: string; isProductionProof: boolean }> {
  const links: Array<{ url: string; isProductionProof: boolean }> = [];
  const lines = content.split('\n');
  let inProofSection = false;

  for (const line of lines) {
    if (/^## Production Proof|^## 生产验证/.test(line)) {
      inProofSection = true;
    } else if (/^## /.test(line)) {
      inProofSection = false;
    }

    const urls = line.match(GITHUB_URL_RE) || [];
    for (const rawUrl of urls) {
      const url = rawUrl.replace(/[)>\]"']+$/, '');
      links.push({ url, isProductionProof: inProofSection });
    }
  }

  return links;
}

async function checkUrl(
  url: string,
  retries = 2,
): Promise<{ status: number | 'error'; ok: boolean }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return { status: res.status, ok: true };
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      return { status: res.status, ok: false };
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      return { status: 'error', ok: false };
    }
  }
  return { status: 'error', ok: false };
}

async function main() {
  const isCI = process.argv.includes('--ci');
  const files = [
    ...findMarkdownFiles(DOCS_DIR),
    ...ROOT_READMES.filter((f) => {
      try {
        statSync(f);
        return true;
      } catch {
        return false;
      }
    }),
  ];

  if (files.length === 0) {
    console.log('No markdown files found.');
    process.exit(0);
  }

  console.log(`Scanning ${files.length} files for GitHub links...\n`);

  const results: LinkResult[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const links = extractLinks(content);

    for (const { url, isProductionProof } of links) {
      if (seen.has(url)) continue;
      seen.add(url);

      const hasLineNumber = /#L\d+/.test(url) && !url.endsWith('#L1');
      const isShaLink = /\/(blob|tree)\/[\da-f]{40}(\/|$|[?#])/.test(url);
      const isBranchLink = !isShaLink && /\/(blob|tree)\//.test(url);

      const { status, ok } = await checkUrl(url);
      results.push({
        file: file.replace(process.cwd() + '/', ''),
        url,
        status,
        ok,
        isProductionProof,
        hasLineNumber,
        isBranchLink,
      });
    }
  }

  console.log('\n--- Results ---\n');

  const broken = results.filter((r) => !r.ok);
  const impreciseProofs = results.filter((r) => r.ok && r.isProductionProof && !r.hasLineNumber);
  const branchLinks = results.filter((r) => r.ok && r.isBranchLink);
  const validProofs = results.filter((r) => r.ok && r.isProductionProof && r.hasLineNumber);
  const otherLinks = results.filter((r) => r.ok && !r.isProductionProof);

  for (const r of validProofs) {
    console.log(`  ✅ [proof]  ${r.url}`);
  }
  for (const r of otherLinks) {
    console.log(`  ✅ [other]  ${r.url}`);
  }
  for (const r of impreciseProofs) {
    console.log(`  ⚠️  [proof]  ${r.url} — missing line numbers`);
  }
  if (branchLinks.length) {
    console.log(
      `\n  ℹ️  ${branchLinks.length} link(s) use branch names instead of SHA permalinks:`,
    );
    for (const r of branchLinks) {
      console.log(`     ${r.url}`);
    }
    console.log(`     Run: tsx scripts/convert-to-sha-links.ts`);
  }
  for (const r of broken) {
    console.log(`  ❌ ${r.status} ${r.url} (in ${r.file})`);
  }

  console.log(`\n${results.length} unique links:`);
  console.log(`  ✅ ${validProofs.length} production proofs (precise)`);
  console.log(`  ✅ ${otherLinks.length} other links`);
  if (impreciseProofs.length)
    console.log(`  ⚠️  ${impreciseProofs.length} production proofs without line numbers`);
  if (branchLinks.length)
    console.log(`  ℹ️  ${branchLinks.length} branch-based links (convert before release)`);
  if (broken.length) console.log(`  ❌ ${broken.length} broken`);

  if (broken.length > 0) {
    if (isCI) console.log('\nSee .sop/06-broken-link-fix.md');
    process.exit(1);
  }
}

main();
