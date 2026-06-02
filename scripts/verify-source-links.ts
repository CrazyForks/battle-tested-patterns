import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PATTERNS_DIR = join(import.meta.dirname, '..', 'docs', 'patterns');
const GITHUB_URL_RE = /https:\/\/github\.com\/[^\s)]+#L\d+/g;

interface LinkResult {
  file: string;
  url: string;
  status: number | 'error';
  ok: boolean;
}

async function checkUrl(url: string): Promise<{ status: number | 'error'; ok: boolean }> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return { status: res.status, ok: res.ok };
  } catch {
    return { status: 'error', ok: false };
  }
}

async function main() {
  const isCI = process.argv.includes('--ci');
  let files: string[];

  try {
    files = readdirSync(PATTERNS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => join(PATTERNS_DIR, f));
  } catch {
    console.log('No pattern files found in docs/patterns/. Nothing to verify.');
    process.exit(0);
  }

  if (files.length === 0) {
    console.log('No pattern files found. Nothing to verify.');
    process.exit(0);
  }

  const results: LinkResult[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const urls = content.match(GITHUB_URL_RE) || [];

    for (const url of urls) {
      const cleanUrl = url.replace(/[)>\]]+$/, '');
      console.log(`  Checking: ${cleanUrl}`);
      const { status, ok } = await checkUrl(cleanUrl);
      results.push({
        file: file.replace(process.cwd() + '/', ''),
        url: cleanUrl,
        status,
        ok,
      });
    }
  }

  console.log('\n--- Results ---\n');

  const broken = results.filter((r) => !r.ok);
  const valid = results.filter((r) => r.ok);

  for (const r of valid) {
    console.log(`  ✅ ${r.status} ${r.url}`);
  }

  for (const r of broken) {
    console.log(`  ❌ ${r.status} ${r.url} (in ${r.file})`);
  }

  console.log(`\nTotal: ${results.length} links, ${valid.length} valid, ${broken.length} broken`);

  if (broken.length > 0) {
    if (isCI) {
      console.log('\nBroken links detected. See SOP 06 for fix instructions.');
    }
    process.exit(1);
  }
}

main();
