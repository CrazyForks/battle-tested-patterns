/**
 * verify-line-ranges.ts — Production Proof line number content verification.
 *
 * Validates that GitHub SHA links in Production Proof sections:
 *   L1: Line range is within file bounds (not out-of-range)
 *   L2: Code at the referenced lines contains keywords related to the pattern
 *
 * Usage:
 *   tsx scripts/verify-line-ranges.ts [options]
 *
 * Options:
 *   --ci          CI mode: exit 1 on any FAIL
 *   --no-cache    Ignore cached results, re-fetch everything
 *   --section all Check all sections (including More Production Uses)
 *   --verbose     Show PASS results too
 *   --pattern X   Only check pattern with slug X
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { discoverPatterns, discoverCaseStudies, extractSections, ROOT } from './lib/patterns.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParsedLink {
  url: string;
  owner: string;
  repo: string;
  sha: string;
  filePath: string;
  startLine: number;
  endLine: number;
  patternSlug: string;
  section: 'proof' | 'more-uses';
  /** Identifiers extracted from the table row context (Usage column) */
  contextIdentifiers: string[];
}

interface VerifyResult {
  link: ParsedLink;
  status: 'pass' | 'warn' | 'fail' | 'error';
  totalLines?: number;
  keywordsFound: string[];
  keywordsExpected: string[];
  message: string;
}

interface CacheEntry {
  status: 'pass' | 'warn' | 'fail' | 'error';
  totalLines?: number;
  keywordsFound: string[];
  message: string;
  checkedAt: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const CACHE_PATH = join(ROOT, 'tmp/line-range-cache.json');
const CONCURRENCY = 5;
const DELAY_MS = 150; // between batches to avoid rate limiting

// ─── CLI Args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isCI = args.includes('--ci');
const noCache = args.includes('--no-cache');
const verbose = args.includes('--verbose');
const sectionAll = args.includes('--section') && args[args.indexOf('--section') + 1] === 'all';
const patternFilter = args.includes('--pattern') ? args[args.indexOf('--pattern') + 1] : undefined;

// ─── Link Parsing ───────────────────────────────────────────────────────────

const SHA_LINK_RE =
  /https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([\da-f]{40})\/([^#\s)]+)#L(\d+)(?:-L(\d+))?/g;

function parseProductionProofLinks(
  content: string,
  patternSlug: string,
  checkAll: boolean,
): ParsedLink[] {
  const links: ParsedLink[] = [];
  const sections = extractSections(content);

  for (const section of sections) {
    let sectionType: 'proof' | 'more-uses' | null = null;
    if (/Production Proof|生产验证/.test(section.heading)) {
      sectionType = 'proof';
    } else if (/More Production Uses|更多生产案例/.test(section.heading)) {
      sectionType = 'more-uses';
    }

    if (!sectionType) continue;
    if (sectionType === 'more-uses' && !checkAll) continue;

    // Process line by line to capture table row context for each link
    const sectionLines = section.content.split('\n');
    for (const line of sectionLines) {
      let match: RegExpExecArray | null;
      const re = new RegExp(SHA_LINK_RE.source, 'g');
      while ((match = re.exec(line)) !== null) {
        // Extract code identifiers from the same table row (backtick-wrapped)
        const identifiers = extractIdentifiersFromRow(line);
        links.push({
          url: match[0]!,
          owner: match[1]!,
          repo: match[2]!,
          sha: match[3]!,
          filePath: match[4]!,
          startLine: parseInt(match[5]!, 10),
          endLine: match[6] ? parseInt(match[6], 10) : parseInt(match[5]!, 10),
          patternSlug,
          section: sectionType,
          contextIdentifiers: identifiers,
        });
      }
    }
  }

  return links;
}

/**
 * Extract code identifiers from a markdown table row.
 * Looks for backtick-wrapped identifiers like `CircuitBreaker`, `markSuccess`.
 */
function extractIdentifiersFromRow(row: string): string[] {
  const identifiers: string[] = [];
  const backtickRe = /`([A-Za-z_]\w{2,})`/g;
  let m: RegExpExecArray | null;
  while ((m = backtickRe.exec(row)) !== null) {
    identifiers.push(m[1]!);
  }
  return identifiers;
}

// ─── Keyword Generation ─────────────────────────────────────────────────────

function generateKeywords(link: ParsedLink): string[] {
  const slug = link.patternSlug;
  const words = slug.split('-');
  const keywords: string[] = [];

  // Original words (e.g., "circuit", "breaker")
  for (const w of words) {
    if (w.length >= 3) keywords.push(w);
  }

  // camelCase (e.g., "circuitBreaker")
  const camel = words.map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1))).join('');
  keywords.push(camel);

  // PascalCase (e.g., "CircuitBreaker")
  const pascal = words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join('');
  keywords.push(pascal);

  // snake_case (e.g., "circuit_breaker")
  keywords.push(words.join('_'));

  // SCREAMING_SNAKE (e.g., "CIRCUIT_BREAKER")
  keywords.push(words.join('_').toUpperCase());

  // File name without extension (e.g., "gobreaker" from "gobreaker.go")
  const fileName =
    link.filePath
      .split('/')
      .pop()
      ?.replace(/\.\w+$/, '') ?? '';
  if (fileName.length >= 3) keywords.push(fileName);

  // Context identifiers from the Usage column (e.g., "HystrixCircuitBreakerImpl")
  for (const id of link.contextIdentifiers) {
    keywords.push(id);
  }

  // Deduplicate and filter short ones
  return [...new Set(keywords)].filter((k) => k.length >= 3);
}

// ─── File Fetching ──────────────────────────────────────────────────────────

async function fetchFileContent(
  owner: string,
  repo: string,
  sha: string,
  filePath: string,
): Promise<{ lines: string[]; error?: string }> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${filePath}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      return { lines: [], error: `HTTP ${res.status} from raw.githubusercontent.com` };
    }
    const text = await res.text();
    return { lines: text.split('\n') };
  } catch (e) {
    return { lines: [], error: `Fetch error: ${(e as Error).message}` };
  }
}

// ─── Verification Logic ─────────────────────────────────────────────────────

async function verifyLink(link: ParsedLink): Promise<VerifyResult> {
  const keywords = generateKeywords(link);

  const { lines, error } = await fetchFileContent(link.owner, link.repo, link.sha, link.filePath);

  if (error) {
    return {
      link,
      status: 'error',
      keywordsFound: [],
      keywordsExpected: keywords,
      message: error,
    };
  }

  const totalLines = lines.length;

  // L1: Range validity
  if (link.startLine < 1 || link.endLine > totalLines) {
    return {
      link,
      status: 'fail',
      totalLines,
      keywordsFound: [],
      keywordsExpected: keywords,
      message: `Line range L${link.startLine}-L${link.endLine} exceeds file length (${totalLines} lines)`,
    };
  }

  // L2: Keyword presence in the referenced range
  const rangeContent = lines
    .slice(link.startLine - 1, link.endLine)
    .join('\n')
    .toLowerCase();
  const found = keywords.filter((k) => rangeContent.includes(k.toLowerCase()));

  if (found.length === 0) {
    return {
      link,
      status: 'warn',
      totalLines,
      keywordsFound: found,
      keywordsExpected: keywords,
      message: `No pattern keywords found in L${link.startLine}-L${link.endLine}. Expected one of: ${keywords.slice(0, 5).join(', ')}`,
    };
  }

  return {
    link,
    status: 'pass',
    totalLines,
    keywordsFound: found,
    keywordsExpected: keywords,
    message: `${found.length}/${keywords.length} keywords matched`,
  };
}

// ─── Cache ──────────────────────────────────────────────────────────────────

function loadCache(): Map<string, CacheEntry> {
  if (noCache || !existsSync(CACHE_PATH)) return new Map();
  try {
    const data = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

function saveCache(cache: Map<string, CacheEntry>): void {
  mkdirSync(join(ROOT, 'tmp'), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(Object.fromEntries(cache), null, 2));
}

function cacheKey(link: ParsedLink): string {
  // SHA + file + line range = unique immutable reference
  return `${link.sha}:${link.filePath}#L${link.startLine}-L${link.endLine}:${link.patternSlug}`;
}

// ─── Batch Execution ────────────────────────────────────────────────────────

async function runBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('verify-line-ranges: Checking Production Proof line number content...\n');

  const patterns = discoverPatterns();
  const caseStudies = discoverCaseStudies();
  const sources = [...patterns, ...caseStudies];
  const allLinks: ParsedLink[] = [];

  for (const source of sources) {
    if (patternFilter && source.slug !== patternFilter) continue;
    const content = readFileSync(source.enPath, 'utf-8');
    const links = parseProductionProofLinks(content, source.slug, sectionAll);
    allLinks.push(...links);
  }

  if (allLinks.length === 0) {
    console.log('No SHA links with line numbers found.');
    process.exit(0);
  }

  console.log(
    `Found ${allLinks.length} SHA link(s) to verify across ${patterns.length} patterns and ${caseStudies.length} case studies.`,
  );

  // Load cache
  const cache = loadCache();
  const toVerify: ParsedLink[] = [];
  const cachedResults: VerifyResult[] = [];

  for (const link of allLinks) {
    const key = cacheKey(link);
    const cached = cache.get(key);
    if (cached) {
      cachedResults.push({
        link,
        status: cached.status,
        totalLines: cached.totalLines,
        keywordsFound: cached.keywordsFound,
        keywordsExpected: generateKeywords(link),
        message: cached.message + ' (cached)',
      });
    } else {
      toVerify.push(link);
    }
  }

  if (cachedResults.length > 0) {
    console.log(`  ${cachedResults.length} cached, ${toVerify.length} to fetch.\n`);
  } else {
    console.log('');
  }

  // Verify uncached links
  const freshResults = await runBatch(toVerify, verifyLink, CONCURRENCY);

  // Update cache with fresh results
  for (let i = 0; i < toVerify.length; i++) {
    const link = toVerify[i]!;
    const result = freshResults[i]!;
    cache.set(cacheKey(link), {
      status: result.status,
      totalLines: result.totalLines,
      keywordsFound: result.keywordsFound,
      message: result.message,
      checkedAt: new Date().toISOString(),
    });
  }
  saveCache(cache);

  // Combine results
  const results = [...cachedResults, ...freshResults];

  // Output
  const passes = results.filter((r) => r.status === 'pass');
  const warns = results.filter((r) => r.status === 'warn');
  const fails = results.filter((r) => r.status === 'fail');
  const errors = results.filter((r) => r.status === 'error');

  if (verbose) {
    for (const r of passes) {
      const file = r.link.filePath.split('/').pop();
      console.log(
        `  ✅ [${r.link.section}] ${r.link.patternSlug} → ${file} L${r.link.startLine}-L${r.link.endLine} (${r.totalLines} lines) — ${r.message}`,
      );
    }
  }

  for (const r of warns) {
    const file = r.link.filePath.split('/').pop();
    console.log(
      `  ⚠️  [${r.link.section}] ${r.link.patternSlug} → ${file} L${r.link.startLine}-L${r.link.endLine} — ${r.message}`,
    );
  }

  for (const r of fails) {
    const file = r.link.filePath.split('/').pop();
    console.log(
      `  ❌ [${r.link.section}] ${r.link.patternSlug} → ${file} L${r.link.startLine}-L${r.link.endLine} — ${r.message}`,
    );
  }

  for (const r of errors) {
    const file = r.link.filePath.split('/').pop();
    console.log(`  ❌ [${r.link.section}] ${r.link.patternSlug} → ${file} — ${r.message}`);
  }

  // Summary
  console.log(`\n${results.length} links verified:`);
  console.log(`  ✅ ${passes.length} pass`);
  if (warns.length)
    console.log(`  ⚠️  ${warns.length} warn (keywords not found — review recommended)`);
  if (fails.length) console.log(`  ❌ ${fails.length} fail (line range out of bounds)`);
  if (errors.length) console.log(`  ❌ ${errors.length} error (fetch failed)`);

  if (fails.length > 0 || errors.length > 0) {
    if (isCI) {
      process.exit(1);
    }
    console.log('\nRun with --verbose to see all results.');
    process.exit(1);
  }

  if (warns.length > 0) {
    console.log('\nWarnings are non-blocking. Review manually if needed.');
  }
}

main();
