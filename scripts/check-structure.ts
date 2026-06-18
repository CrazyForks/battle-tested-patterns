/**
 * check-structure.ts — Pattern document structure completeness check.
 *
 * Validates:
 * - S1: Frontmatter completeness (title, description, difficulty for patterns)
 * - S2: Required sections (10 mandatory sections per pattern)
 * - S3: Code-group tab order (TypeScript > Rust > Go > Python)
 * - S4: Property Table existence in Core Idea
 * - S5: Production Proof link quality (≥2 links with #L)
 * - S6: No #L1 file-level links in Production Proof
 * - S7: Challenge Questions format (:::details syntax)
 * - S8: Real-World Analogy section existence
 *
 * Case studies (docs/case-studies/) use a lighter skeleton (C1–C5):
 * - C1: Frontmatter (title, description)
 * - C2: Required sections (Production Proof, Takeaways, Further Reading, Study These Patterns)
 * - C3: A "The Problem … Solves" framing section
 * - C4: A "How … Compose" section
 * - C5: ≥2 "Pattern N —" sections
 *
 * Usage:
 *   tsx scripts/check-structure.ts              # Check all patterns
 *   tsx scripts/check-structure.ts --pattern circuit-breaker  # Check one
 *   tsx scripts/check-structure.ts --verbose    # Show passing checks too
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOCS_DIR,
  discoverPatterns,
  discoverCaseStudies,
  findMarkdownFiles,
  parseFrontmatter,
  extractSections,
  extractGitHubLinks,
  report,
  summarize,
  type PatternFile,
} from './lib/patterns.js';

const args = process.argv.slice(2);
const filterPattern = args.find((_, i, a) => a[i - 1] === '--pattern') || '';
const verbose = args.includes('--verbose');

// ─── Required Sections ───────────────────────────────────────────────────────

const REQUIRED_SECTIONS_EN = [
  'One Liner',
  'Core Idea',
  'Production Proof',
  'Implementation',
  'Exercises',
  'When to Use',
  'When NOT to Use',
  'More Production Uses',
  'Related Patterns',
  'Challenge Questions',
];

const REQUIRED_SECTIONS_ZH = [
  '一句话',
  '核心思想',
  '生产验证',
  '实现',
  '练习',
  '何时使用',
  '何时不用',
  '更多生产案例',
  '相关模式',
  '挑战题',
];

const LANG_ORDER = ['TypeScript', 'Rust', 'Go', 'Python'];

// ─── Check Functions ─────────────────────────────────────────────────────────

function checkPatternStructure(pf: PatternFile): void {
  const files = [{ path: pf.enPath, lang: 'en' }];
  if (pf.hasZh) files.push({ path: pf.zhPath, lang: 'zh' });

  for (const { path, lang } of files) {
    const content = readFileSync(path, 'utf-8');
    const requiredSections = lang === 'en' ? REQUIRED_SECTIONS_EN : REQUIRED_SECTIONS_ZH;

    // S1: Frontmatter
    const fm = parseFrontmatter(content);
    if (!fm) {
      report({ file: path, severity: 'error', message: 'Missing frontmatter', rule: 'S1' });
    } else {
      for (const field of ['title', 'description', 'difficulty']) {
        if (!fm.fields.has(field)) {
          report({
            file: path,
            severity: 'error',
            message: `Missing frontmatter field: ${field}`,
            rule: 'S1',
          });
        }
      }
    }

    // S2: Required sections
    const sections = extractSections(content);
    const headings = new Set(sections.map((s) => s.heading));
    for (const required of requiredSections) {
      if (!headings.has(required)) {
        report({
          file: path,
          severity: 'error',
          message: `Missing required section: "${required}"`,
          rule: 'S2',
        });
      }
    }

    // S3: Code-group tab order
    const codeGroupRe = /::: code-group\n([\s\S]*?)\n:::/g;
    let groupMatch: RegExpExecArray | null;
    let groupIdx = 0;
    while ((groupMatch = codeGroupRe.exec(content)) !== null) {
      groupIdx++;
      const groupContent = groupMatch[1]!;
      const tabLabels = [...groupContent.matchAll(/```\w+\s+\[(\w+)\]/g)].map((m) => m[1]!);
      const present = LANG_ORDER.filter((l) => tabLabels.includes(l));
      const actual = tabLabels.filter((l) => LANG_ORDER.includes(l));
      if (actual.length > 0 && JSON.stringify(actual) !== JSON.stringify(present)) {
        report({
          file: path,
          severity: 'error',
          message: `Code-group #${groupIdx} tab order is [${actual.join(', ')}], expected [${present.join(', ')}]`,
          rule: 'S3',
        });
      }
    }

    // S4: Property Table in Core Idea (warning)
    const coreIdea = sections.find((s) => s.heading === 'Core Idea' || s.heading === '核心思想');
    if (coreIdea) {
      const hasTable = /\|.*\|.*\|/.test(coreIdea.content) && /\|[-:]+\|/.test(coreIdea.content);
      if (!hasTable) {
        report({
          file: path,
          severity: 'warning',
          message: 'Core Idea section has no Property Table',
          rule: 'S4',
        });
      }
    }

    // S5 & S6: Production Proof link quality
    const proofSection = sections.find(
      (s) => s.heading === 'Production Proof' || s.heading === '生产验证',
    );
    if (proofSection) {
      const links = extractGitHubLinks(proofSection.content, proofSection.startLine);
      const linksWithL = links.filter((l) => l.hasLineNumber && !l.isL1Only);
      if (linksWithL.length < 2) {
        report({
          file: path,
          severity: 'error',
          message: `Production Proof has only ${linksWithL.length} link(s) with line numbers (minimum 2)`,
          rule: 'S5',
        });
      }
      // S6: #L1 links
      const l1Links = links.filter((l) => l.isL1Only);
      for (const l of l1Links) {
        report({
          file: path,
          line: l.line,
          severity: 'error',
          message: `#L1 file-level link in Production Proof: ${l.url.slice(0, 80)}...`,
          rule: 'S6',
        });
      }
    }

    // S7: Challenge Questions format (warning)
    const challengeSection = sections.find(
      (s) => s.heading === 'Challenge Questions' || s.heading === '挑战问题',
    );
    if (challengeSection) {
      const detailsCount = (challengeSection.content.match(/^::: details/gm) || []).length;
      if (detailsCount < 3) {
        report({
          file: path,
          severity: 'warning',
          message: `Challenge Questions has only ${detailsCount} :::details blocks (expected ≥3)`,
          rule: 'S7',
        });
      }
    }

    // S8: Real-World Analogy (warning, EN only)
    if (lang === 'en') {
      const hasAnalogy = headings.has('Real-World Analogy');
      if (!hasAnalogy) {
        report({
          file: path,
          severity: 'warning',
          message: 'Missing "Real-World Analogy" section',
          rule: 'S8',
        });
      }
    } else {
      const hasAnalogy = headings.has('现实类比');
      if (!hasAnalogy) {
        report({
          file: path,
          severity: 'warning',
          message: 'Missing "现实类比" section',
          rule: 'S8',
        });
      }
    }

    if (verbose) {
      console.log(`  ✓ ${pf.slug} (${lang})`);
    }
  }
}

// ─── Case Study Structure ────────────────────────────────────────────────────
//
// Case studies (docs/case-studies/<slug>.md) follow the SOP 15 shape, which is
// looser than the pattern template. We enforce a lightweight skeleton so every
// study keeps the evidence-driven structure the existing five established.

const CASE_REQUIRED_SECTIONS_EN = [
  'Production Proof',
  'Takeaways',
  'Further Reading',
  'Study These Patterns',
];
const CASE_REQUIRED_SECTIONS_ZH = ['生产验证', '要点', '延伸阅读', '延伸学习这些模式'];

function checkCaseStudyStructure(cs: PatternFile): void {
  const files = [{ path: cs.enPath, lang: 'en' }];
  if (cs.hasZh) files.push({ path: cs.zhPath, lang: 'zh' });

  for (const { path, lang } of files) {
    const content = readFileSync(path, 'utf-8');
    const isEn = lang === 'en';

    // C1: Frontmatter (title + description; difficulty is not required here)
    const fm = parseFrontmatter(content);
    if (!fm) {
      report({ file: path, severity: 'error', message: 'Missing frontmatter', rule: 'C1' });
    } else {
      for (const field of ['title', 'description']) {
        if (!fm.fields.has(field)) {
          report({
            file: path,
            severity: 'error',
            message: `Missing frontmatter field: ${field}`,
            rule: 'C1',
          });
        }
      }
    }

    const sections = extractSections(content);
    const headings = sections.map((s) => s.heading);
    const headingSet = new Set(headings);

    // C2: Exact-match required sections
    const required = isEn ? CASE_REQUIRED_SECTIONS_EN : CASE_REQUIRED_SECTIONS_ZH;
    for (const r of required) {
      if (!headingSet.has(r)) {
        report({
          file: path,
          severity: 'error',
          message: `Missing required section: "${r}"`,
          rule: 'C2',
        });
      }
    }

    // C3: A problem-framing section (title varies by project)
    const hasProblem = isEn
      ? headings.some((h) => h.startsWith('The Problem'))
      : headings.some((h) => h.endsWith('解决的问题'));
    if (!hasProblem) {
      report({
        file: path,
        severity: 'error',
        message: isEn
          ? 'Missing a "The Problem … Solves" framing section'
          : '缺少「… 解决的问题」开篇章节',
        rule: 'C3',
      });
    }

    // C4: A composition section (the core of a multi-pattern study)
    const hasCompose = isEn
      ? headings.some((h) => h.includes('Compose'))
      : headings.some((h) => h.includes('如何组合'));
    if (!hasCompose) {
      report({
        file: path,
        severity: 'error',
        message: isEn ? 'Missing a "How … Compose" section' : '缺少「… 如何组合」章节',
        rule: 'C4',
      });
    }

    // C5: At least two per-pattern sections (a study composes ≥2 patterns)
    const patternSections = isEn
      ? headings.filter((h) => /^Pattern\s+\d+\s+[—-]/.test(h))
      : headings.filter((h) => /^模式\s*\d+\s*[—-]/.test(h));
    if (patternSections.length < 2) {
      report({
        file: path,
        severity: 'error',
        message: `A case study must compose ≥2 patterns; found ${patternSections.length} "Pattern N —" section(s)`,
        rule: 'C5',
      });
    }

    if (verbose) {
      console.log(`  ✓ ${cs.slug} (${lang})`);
    }
  }
}

function checkGuideFrontmatter(): void {
  const guideDirs = [
    join(DOCS_DIR, 'guide'),
    join(DOCS_DIR, 'zh/guide'),
    join(DOCS_DIR, 'by-project'),
    join(DOCS_DIR, 'zh/by-project'),
  ];

  for (const dir of guideDirs) {
    for (const file of findMarkdownFiles(dir)) {
      const content = readFileSync(file, 'utf-8');
      const fm = parseFrontmatter(content);
      if (!fm) {
        report({ file, severity: 'error', message: 'Missing frontmatter', rule: 'S1b' });
        continue;
      }
      for (const field of ['title', 'description']) {
        if (!fm.fields.has(field)) {
          report({
            file,
            severity: 'error',
            message: `Missing frontmatter field: ${field}`,
            rule: 'S1b',
          });
        }
      }
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('check-structure: Verifying document structure completeness...\n');

  const patterns = discoverPatterns();
  const filtered = filterPattern ? patterns.filter((p) => p.slug === filterPattern) : patterns;

  if (filtered.length === 0) {
    console.error(`No patterns found${filterPattern ? ` matching "${filterPattern}"` : ''}`);
    process.exit(1);
  }

  console.log(`Checking ${filtered.length} pattern(s)...\n`);

  for (const pf of filtered) {
    checkPatternStructure(pf);
  }

  // Case studies (skip when filtering to a single pattern)
  if (!filterPattern) {
    const caseStudies = discoverCaseStudies();
    if (caseStudies.length > 0) {
      console.log(`Checking ${caseStudies.length} case study(ies)...\n`);
      for (const cs of caseStudies) {
        checkCaseStudyStructure(cs);
      }
    }
  }

  // Also check guide/by-project frontmatter
  checkGuideFrontmatter();

  process.exit(summarize('check-structure'));
}

main();
