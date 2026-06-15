/**
 * check-relations.ts — Pattern relationship integrity check.
 *
 * Validates:
 * - R1: Related Patterns bidirectionality (A→B implies B→A)
 * - R2: Sidebar consistency (all patterns in docs/patterns/ appear in config.ts sidebar)
 * - R3: Homepage consistency (index.md pattern table matches docs/patterns/ directory)
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

// ─── R3: Homepage Consistency ────────────────────────────────────────────────

function checkHomepageConsistency(): void {
  const indexPath = join(DOCS_DIR, 'index.md');
  if (!statSync(indexPath, { throwIfNoEntry: false })?.isFile()) return;

  const content = readFileSync(indexPath, 'utf-8');
  const patterns = discoverPatterns();

  // Extract pattern slugs from homepage links
  const homeSlugs = new Set<string>();
  const linkRe = /\/patterns\/([^/'"\s)]+)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(content)) !== null) {
    const slug = m[1]!.replace(/\/index$/, '').replace(/\/$/, '');
    if (slug) homeSlugs.add(slug);
  }

  // Only warn if homepage has pattern links but is missing some
  if (homeSlugs.size > 0) {
    for (const pf of patterns) {
      if (!homeSlugs.has(pf.slug)) {
        report({
          file: indexPath,
          severity: 'warning',
          message: `Pattern "${pf.slug}" not listed on homepage`,
          rule: 'R3',
        });
      }
    }
  }

  if (verbose) {
    console.log(`  ✓ R3: ${homeSlugs.size} patterns found on homepage, ${patterns.length} total`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('check-relations: Verifying pattern relationship integrity...\n');

  checkBidirectionalRelations();
  checkSidebarConsistency();
  checkHomepageConsistency();

  process.exit(summarize('check-relations'));
}

main();
