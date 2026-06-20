/**
 * check-relations.ts — Pattern relationship integrity check.
 *
 * Validates:
 * - R1: Related Patterns bidirectionality (A→B implies B→A)
 * - R2: Sidebar consistency (all patterns in docs/patterns/ appear in config.ts sidebar)
 * - R3: Catalog consistency (docs/patterns/index.md + ZH mirror list every pattern)
 *
 * Usage:
 *   tsx scripts/check-relations.ts
 *   tsx scripts/check-relations.ts --verbose
 */

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS_DIR, discoverPatterns, extractSections, report, summarize } from './lib/patterns.js';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

// ─── R1: Related Patterns Bidirectionality ───────────────────────────────────

function checkBidirectionalRelations(): void {
  const patterns = discoverPatterns();
  // Build a map: slug → set of related slugs
  const relationsMap = new Map<string, Set<string>>();

  for (const pf of patterns) {
    const content = readFileSync(pf.enPath, 'utf-8');
    const sections = extractSections(content);
    const relatedSection = sections.find((s) => s.heading === 'Related Patterns');
    if (!relatedSection) continue;

    const related = new Set<string>();
    // Extract pattern links from table: [Pattern Name](/patterns/slug/)
    const linkRe = /\[([^\]]+)\]\(\/(?:battle-tested-patterns\/)?patterns\/([^/)]+)/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(relatedSection.content)) !== null) {
      related.add(m[2]!);
    }
    // Also match relative links: [Name](../slug/) or [Name](../slug/index.md)
    const relLinkRe = /\[([^\]]+)\]\(\.\.\/([^/)]+)/g;
    while ((m = relLinkRe.exec(relatedSection.content)) !== null) {
      related.add(m[2]!);
    }
    relationsMap.set(pf.slug, related);
  }

  // Check bidirectionality
  for (const [slug, related] of relationsMap) {
    for (const target of related) {
      const targetRelations = relationsMap.get(target);
      if (targetRelations && !targetRelations.has(slug)) {
        const pf = patterns.find((p) => p.slug === slug)!;
        report({
          file: pf.enPath,
          severity: 'warning',
          message: `"${slug}" references "${target}" in Related Patterns, but "${target}" does not reference back`,
          rule: 'R1',
        });
      }
    }
  }

  if (verbose) {
    console.log(`  ✓ R1: Checked ${relationsMap.size} patterns for bidirectional relations`);
  }
}

// ─── R2: Sidebar Consistency ─────────────────────────────────────────────────

function checkSidebarConsistency(): void {
  const configPath = join(DOCS_DIR, '.vitepress/config.ts');
  if (!statSync(configPath, { throwIfNoEntry: false })?.isFile()) {
    report({
      file: configPath,
      severity: 'error',
      message: 'Cannot find .vitepress/config.ts',
      rule: 'R2',
    });
    return;
  }

  const configContent = readFileSync(configPath, 'utf-8');
  const patterns = discoverPatterns();

  // Extract pattern slugs referenced in sidebar
  const sidebarSlugs = new Set<string>();
  const sidebarRe = /\/patterns\/([a-z][a-z0-9-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = sidebarRe.exec(configContent)) !== null) {
    // Clean trailing slashes or index
    const slug = m[1]!.replace(/\/index$/, '').replace(/\/$/, '');
    if (slug) sidebarSlugs.add(slug);
  }

  // Check each pattern appears in sidebar
  for (const pf of patterns) {
    if (!sidebarSlugs.has(pf.slug)) {
      report({
        file: pf.enPath,
        severity: 'error',
        message: `Pattern "${pf.slug}" exists in docs/patterns/ but not found in config.ts sidebar`,
        rule: 'R2',
      });
    }
  }

  // Check sidebar doesn't reference non-existent patterns
  const patternSlugs = new Set(patterns.map((p) => p.slug));
  for (const slug of sidebarSlugs) {
    if (!patternSlugs.has(slug)) {
      report({
        file: configPath,
        severity: 'warning',
        message: `Sidebar references pattern "${slug}" but docs/patterns/${slug}/index.md does not exist`,
        rule: 'R2',
      });
    }
  }

  if (verbose) {
    console.log(
      `  ✓ R2: ${patterns.length} patterns checked against sidebar (${sidebarSlugs.size} sidebar entries)`,
    );
  }
}

// ─── R3: Catalog Page Consistency ────────────────────────────────────────────

/**
 * Verify a catalog page (docs/patterns/index.md or its ZH mirror) lists every
 * pattern exactly once. The catalog tables use relative links like
 * `[Name](./bitmask/)`, so the homepage hero page (docs/index.md) is NOT the
 * source of truth — it renders patterns via a Vue component and has no per-
 * pattern links. Checking index.md here would silently pass (0 links found).
 */
function checkCatalogPage(catalogPath: string): void {
  if (!statSync(catalogPath, { throwIfNoEntry: false })?.isFile()) return;

  const content = readFileSync(catalogPath, 'utf-8');
  const patterns = discoverPatterns();

  // Extract slugs from markdown links: [Name](./slug/) | [Name](slug/) |
  // [Name](/patterns/slug/) | [Name](../slug/) — covers relative & absolute.
  const catalogSlugs = new Set<string>();
  const linkRe = /\]\((?:\.{0,2}\/)?(?:patterns\/)?([a-z][a-z0-9-]+)\/?\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(content)) !== null) {
    const slug = m[1]!.replace(/\/index$/, '').replace(/\/$/, '');
    if (slug) catalogSlugs.add(slug);
  }

  const patternSlugs = new Set(patterns.map((p) => p.slug));

  // Every pattern must appear in the catalog.
  for (const pf of patterns) {
    if (!catalogSlugs.has(pf.slug)) {
      report({
        file: catalogPath,
        severity: 'error',
        message: `Pattern "${pf.slug}" exists in docs/patterns/ but is not listed in this catalog page`,
        rule: 'R3',
      });
    }
  }

  // Catalog must not list non-existent patterns.
  for (const slug of catalogSlugs) {
    if (!patternSlugs.has(slug)) {
      report({
        file: catalogPath,
        severity: 'warning',
        message: `Catalog page links pattern "${slug}" but docs/patterns/${slug}/index.md does not exist`,
        rule: 'R3',
      });
    }
  }

  if (verbose) {
    console.log(
      `  ✓ R3: ${catalogSlugs.size} patterns listed in ${catalogPath.replace(DOCS_DIR, 'docs')}, ${patterns.length} total`,
    );
  }
}

function checkCatalogConsistency(): void {
  checkCatalogPage(join(DOCS_DIR, 'patterns/index.md'));
  checkCatalogPage(join(DOCS_DIR, 'zh/patterns/index.md'));
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('check-relations: Verifying pattern relationship integrity...\n');

  checkBidirectionalRelations();
  checkSidebarConsistency();
  checkCatalogConsistency();

  process.exit(summarize('check-relations'));
}

main();
