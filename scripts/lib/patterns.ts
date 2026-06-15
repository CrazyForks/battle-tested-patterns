/**
 * Shared utilities for content quality check scripts.
 *
 * Provides:
 * - Pattern file discovery (EN + ZH)
 * - Frontmatter parsing
 * - Section extraction
 * - Code block extraction
 * - CI-compatible error/warning output
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = join(import.meta.dirname, '../..');
export const DOCS_DIR = join(ROOT, 'docs');
export const PATTERNS_DIR = join(DOCS_DIR, 'patterns');
export const ZH_PATTERNS_DIR = join(DOCS_DIR, 'zh/patterns');

// ─── Pattern Discovery ───────────────────────────────────────────────────────

export interface PatternFile {
  /** Pattern slug (e.g., "circuit-breaker") */
  slug: string;
  /** Absolute path to the EN file */
  enPath: string;
  /** Absolute path to the ZH file (may not exist) */
  zhPath: string;
  /** Whether the ZH file exists */
  hasZh: boolean;
}

/**
 * Discover all pattern directories and their EN/ZH file paths.
 */
export function discoverPatterns(): PatternFile[] {
  const patterns: PatternFile[] = [];
  if (!statSync(PATTERNS_DIR, { throwIfNoEntry: false })?.isDirectory()) return patterns;

  for (const slug of readdirSync(PATTERNS_DIR).sort()) {
    const enPath = join(PATTERNS_DIR, slug, 'index.md');
    const zhPath = join(ZH_PATTERNS_DIR, slug, 'index.md');
    if (!statSync(enPath, { throwIfNoEntry: false })?.isFile()) continue;
    const hasZh = !!statSync(zhPath, { throwIfNoEntry: false })?.isFile();
    patterns.push({ slug, enPath, zhPath, hasZh });
  }
  return patterns;
}

/**
 * Find all markdown files in a directory (non-recursive for guide/by-project).
 */
export function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry.endsWith('.md') && statSync(full).isFile()) {
      results.push(full);
    }
  }
  return results;
}

// ─── Frontmatter Parsing ─────────────────────────────────────────────────────

export interface Frontmatter {
  raw: string;
  fields: Map<string, string>;
}

/**
 * Extract frontmatter from markdown content.
 * Returns null if no frontmatter found.
 */
export function parseFrontmatter(content: string): Frontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const raw = match[1]!;
  const fields = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) fields.set(kv[1]!, kv[2]!.trim());
  }
  return { raw, fields };
}

// ─── Section Extraction ──────────────────────────────────────────────────────

export interface Section {
  heading: string;
  level: number;
  content: string;
  startLine: number;
}

/**
 * Extract all H2/H3 sections from markdown content.
 */
export function extractSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  const contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      if (current) {
        current.content = contentLines.join('\n');
        sections.push(current);
        contentLines.length = 0;
      }
      current = {
        heading: headingMatch[2]!,
        level: headingMatch[1]!.length,
        content: '',
        startLine: i + 1,
      };
    } else if (current) {
      contentLines.push(line);
    }
  }
  if (current) {
    current.content = contentLines.join('\n');
    sections.push(current);
  }
  return sections;
}

// ─── Code Block Extraction ───────────────────────────────────────────────────

export interface CodeBlock {
  language: string;
  label?: string;
  content: string;
  startLine: number;
}

const CODE_LANGS = new Set(['typescript', 'python', 'rust', 'go', 'c', 'cpp', 'java']);

/**
 * Extract fenced code blocks from markdown content.
 * Only extracts blocks with recognized programming languages.
 */
export function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = content.split('\n');
  let inBlock = false;
  let currentLang = '';
  let currentLabel: string | undefined;
  let currentContent: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!inBlock) {
      // Match: ```typescript [TypeScript] or ```rust
      const openMatch = line.match(/^```(\w+)(?:\s+\[([^\]]+)\])?/);
      if (openMatch && CODE_LANGS.has(openMatch[1]!)) {
        inBlock = true;
        currentLang = openMatch[1]!;
        currentLabel = openMatch[2];
        currentContent = [];
        startLine = i + 1;
      }
    } else {
      if (line === '```') {
        blocks.push({
          language: currentLang,
          label: currentLabel,
          content: currentContent.join('\n'),
          startLine,
        });
        inBlock = false;
      } else {
        currentContent.push(line);
      }
    }
  }
  return blocks;
}

// ─── GitHub Link Extraction ──────────────────────────────────────────────────

export interface GitHubLink {
  url: string;
  hasLineNumber: boolean;
  isL1Only: boolean;
  line: number;
}

const GITHUB_URL_RE = /https:\/\/github\.com\/[^\s)>\]]+/g;

/**
 * Extract GitHub URLs from a section of text.
 */
export function extractGitHubLinks(text: string, baseLineOffset = 0): GitHubLink[] {
  const links: GitHubLink[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i]!.match(GITHUB_URL_RE) || [];
    for (const rawUrl of matches) {
      const url = rawUrl.replace(/[)>\]]+$/, '');
      const hasLineNumber = /#L\d+/.test(url);
      const isL1Only = /#L1[^0-9]/.test(url) || url.endsWith('#L1');
      links.push({ url, hasLineNumber, isL1Only, line: baseLineOffset + i + 1 });
    }
  }
  return links;
}

// ─── CI Output Formatting ────────────────────────────────────────────────────

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  file: string;
  line?: number;
  severity: Severity;
  message: string;
  rule: string;
}

const diagnostics: Diagnostic[] = [];

/**
 * Sanitize a string for use in GitHub Actions annotation commands.
 * Removes newlines (which break annotation parsing) and `::` (which is
 * the annotation delimiter and could enable injection).
 */
function sanitizeAnnotation(value: string): string {
  return value.replace(/[\r\n]/g, ' ').replace(/::/g, '');
}

/**
 * Report a diagnostic (error or warning).
 */
export function report(d: Diagnostic): void {
  diagnostics.push(d);
  const relFile = relative(ROOT, d.file);
  const lineStr = d.line ? `,line=${d.line}` : '';
  const prefix = d.severity === 'error' ? '❌' : '⚠️';

  // GitHub Actions annotation format
  if (process.env.CI) {
    console.log(
      `::${d.severity} file=${sanitizeAnnotation(relFile)}${lineStr}::${sanitizeAnnotation(d.rule)}: ${sanitizeAnnotation(d.message)}`,
    );
  } else {
    console.log(`  ${prefix} [${d.rule}] ${relFile}${d.line ? `:${d.line}` : ''} — ${d.message}`);
  }
}

/**
 * Get all collected diagnostics.
 */
export function getDiagnostics(): Diagnostic[] {
  return diagnostics;
}

/**
 * Print summary and return exit code.
 */
export function summarize(scriptName: string): number {
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  console.log('');
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`✅ ${scriptName}: All checks passed`);
    return 0;
  }

  if (errors.length > 0) {
    console.log(`❌ ${scriptName}: ${errors.length} error(s), ${warnings.length} warning(s)`);
    return 1;
  }

  console.log(`⚠️  ${scriptName}: ${warnings.length} warning(s) (no errors)`);
  return 0;
}

/**
 * Convert kebab-case to snake_case.
 */
export function toSnakeCase(slug: string): string {
  return slug.replace(/-/g, '_');
}
