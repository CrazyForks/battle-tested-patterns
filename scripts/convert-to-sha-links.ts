/**
 * Convert GitHub branch-based URLs to SHA permalink URLs.
 *
 * Authentication (in priority order):
 *   1. `gh auth token` — reads from system keyring (recommended, no plaintext)
 *   2. GITHUB_TOKEN env var — fallback for CI environments
 *
 * Usage:
 *   tsx scripts/convert-to-sha-links.ts --dry-run    # preview changes, no file writes
 *   tsx scripts/convert-to-sha-links.ts              # execute conversion
 *   tsx scripts/convert-to-sha-links.ts --verify-only # spot-check existing URLs (no auth needed)
 *
 * Exit code: 0 = success, 1 = errors found
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const TMP_DIR = join(ROOT, 'tmp');
const DOCS_DIR = join(ROOT, 'docs');
const ROOT_READMES = ['README.md', 'README.zh-CN.md'].map(f => join(ROOT, f));
const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY_ONLY = process.argv.includes('--verify-only');

// Resolve token: prefer `gh auth token` (no plaintext), fallback to env var
function resolveToken(): string {
  // 1. Try gh CLI (secure — reads from system keyring)
  try {
    const token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
    if (token) return token;
  } catch {
    // gh CLI unavailable or not authed — fall through to env var.
  }
  // 2. Fallback to environment variable
  return process.env.GITHUB_TOKEN || '';
}

// Match: https://github.com/{owner}/{repo}/(blob|tree)/{branch}/{path}
const GITHUB_REF_URL_RE = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/(blob|tree)\/([^/]+)\/([\w\-./]+(?:#[^\s)>\]]*)?)/g;

// Known branch names (not SHAs)
const BRANCH_NAMES = new Set([
  'main', 'master', 'dev', 'develop', 'trunk', 'unstable',
  'v1.x', 'v2.x', 'v3.x', 'next', 'canary', 'release',
]);

function isBranch(ref: string): boolean {
  if (/^[0-9a-f]{40}$/.test(ref)) return false; // Already a SHA
  if (/^[0-9a-f]{7,12}$/.test(ref)) return false; // Short SHA
  return BRANCH_NAMES.has(ref) || !/^v?\d+\.\d+/.test(ref); // Not a version tag
}

// ─── File discovery ───
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

// ─── GitHub API ───
interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

const shaCache = new Map<string, string>();

async function resolveSHA(owner: string, repo: string, branch: string, token: string, retries = 2): Promise<string | null> {
  const key = `${owner}/${repo}@${branch}`;
  if (shaCache.has(key)) return shaCache.get(key)!;

  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.sha',
    'User-Agent': 'battle-tested-patterns-link-converter',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
        const wait = Math.min(Math.max(reset - Date.now(), 1000), 60_000);
        console.log(`  Rate limited. Waiting ${Math.ceil(wait / 1000)}s...`);
        await new Promise(r => setTimeout(r, wait));
        if (retries > 0) {
          return resolveSHA(owner, repo, branch, token, retries - 1); // Retry
        }
        console.error(`  ✗ ${key}: rate limit retry exhausted`);
        return null;
      }
    }
    if (!res.ok) {
      console.error(`  ✗ ${key}: HTTP ${res.status}`);
      return null;
    }
    const sha = (await res.text()).trim();
    if (/^[0-9a-f]{40}$/.test(sha)) {
      shaCache.set(key, sha);
      return sha;
    }
    console.error(`  ✗ ${key}: unexpected response "${sha.substring(0, 50)}"`);
    return null;
  } catch (e: unknown) {
    console.error(`  ✗ ${key}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// ─── URL extraction ───
interface UrlMatch {
  file: string;
  fullUrl: string;
  owner: string;
  repo: string;
  type: string; // 'blob' or 'tree'
  branch: string;
  path: string;
}

function extractBranchUrls(files: string[]): UrlMatch[] {
  const matches: UrlMatch[] = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    let m: RegExpExecArray | null;
    const re = new RegExp(GITHUB_REF_URL_RE.source, 'g');
    while ((m = re.exec(content)) !== null) {
      const [fullUrl, owner, repo, type, branch, path] = m as unknown as [string, string, string, string, string, string];
      if (isBranch(branch)) {
        matches.push({ file, fullUrl, owner: owner!, repo: repo!, type: type!, branch: branch!, path: path! });
      }
    }
  }
  return matches;
}

// ─── Main ───
async function main() {
  // Clean up previous mapping file
  const mappingPath = join(TMP_DIR, 'sha-mapping.json');
  rmSync(mappingPath, { force: true });

  const token = resolveToken();

  if (!token && !VERIFY_ONLY) {
    console.error('Error: No GitHub token found.');
    console.error('Options:');
    console.error('  1. gh auth login   (recommended — token stored in system keyring)');
    console.error('  2. Set GITHUB_TOKEN env var (for CI environments)');
    process.exit(1);
  }

  const files = [
    ...findMarkdownFiles(DOCS_DIR),
    ...ROOT_READMES.filter(f => { try { statSync(f); return true; } catch { return false; } }),
  ];
  console.log(`\nScanning ${files.length} markdown files...\n`);

  const matches = extractBranchUrls(files);
  const uniqueUrls = [...new Set(matches.map(m => m.fullUrl))];
  console.log(`Found ${uniqueUrls.length} unique branch-based URLs`);

  if (VERIFY_ONLY) {
    console.log('\n--verify-only mode: checking existing URLs...');
    let broken = 0;
    for (const url of uniqueUrls.slice(0, 10)) {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15_000) });
      const status = res.ok ? '✓' : '✗';
      if (!res.ok) broken++;
      console.log(`  ${status} ${res.status} ${url.substring(0, 80)}...`);
    }
    console.log(`\nChecked 10/${uniqueUrls.length} URLs. ${broken} broken.`);
    process.exit(broken > 0 ? 1 : 0);
  }

  // Group by repo+branch
  const repoRefs = new Map<string, RepoRef>();
  for (const m of matches) {
    const key = `${m.owner}/${m.repo}@${m.branch}`;
    if (!repoRefs.has(key)) {
      repoRefs.set(key, { owner: m.owner, repo: m.repo, branch: m.branch });
    }
  }

  console.log(`Resolving SHA for ${repoRefs.size} repo/branch combinations...\n`);

  // Resolve SHAs
  const shaMap = new Map<string, string>();
  let resolved = 0, failed = 0;
  for (const [key, ref] of repoRefs) {
    const sha = await resolveSHA(ref.owner, ref.repo, ref.branch, token);
    if (sha) {
      shaMap.set(key, sha);
      resolved++;
      console.log(`  ✓ ${key} → ${sha.substring(0, 7)}`);
    } else {
      failed++;
    }
  }

  console.log(`\nResolved: ${resolved}, Failed: ${failed}`);

  if (failed > 0) {
    console.warn(`\n⚠ ${failed} repo/branch combinations could not be resolved. Those URLs will be skipped.`);
  }

  // Build replacement map
  const replacements = new Map<string, string>();
  for (const m of matches) {
    const key = `${m.owner}/${m.repo}@${m.branch}`;
    const sha = shaMap.get(key);
    if (sha) {
      const newUrl = m.fullUrl.replace(`/${m.type}/${m.branch}/`, `/${m.type}/${sha}/`);
      replacements.set(m.fullUrl, newUrl);
    }
  }

  console.log(`\n${replacements.size} URLs to convert.\n`);

  if (DRY_RUN) {
    console.log('=== DRY RUN — no files modified ===\n');
    for (const [old, newUrl] of [...replacements].slice(0, 20)) {
      console.log(`  ${old.substring(0, 80)}...`);
      console.log(`  → ${newUrl.substring(0, 80)}...\n`);
    }
    if (replacements.size > 20) {
      console.log(`  ... and ${replacements.size - 20} more.`);
    }

    if (shaMap.size > 0) {
      const mapping: Record<string, Record<string, string>> = {};
      for (const [key, sha] of shaMap) {
        const [repoFull, branch] = key.split('@');
        if (!mapping[repoFull!]) mapping[repoFull!] = {};
        mapping[repoFull!]![branch!] = sha;
      }
      mkdirSync(TMP_DIR, { recursive: true });
      writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
      console.log('\nSaved tmp/sha-mapping.json');
    }
    process.exit(0);
  }

  // Execute replacements
  let filesModified = 0;
  for (const file of files) {
    let content = readFileSync(file, 'utf-8');
    let modified = false;
    for (const [oldUrl, newUrl] of replacements) {
      if (content.includes(oldUrl)) {
        content = content.replaceAll(oldUrl, newUrl);
        modified = true;
      }
    }
    if (modified) {
      writeFileSync(file, content);
      filesModified++;
    }
  }

  console.log(`\n✓ Modified ${filesModified} files.`);
  console.log(`✓ Converted ${replacements.size} unique URLs to SHA permalinks.`);

  // Save mapping only when conversions occurred
  if (shaMap.size > 0) {
    const mapping: Record<string, Record<string, string>> = {};
    for (const [key, sha] of shaMap) {
      const [repoFull, branch] = key.split('@');
      if (!mapping[repoFull!]) mapping[repoFull!] = {};
      mapping[repoFull!]![branch!] = sha;
    }
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    console.log('✓ Saved tmp/sha-mapping.json');
  }
}

main();
