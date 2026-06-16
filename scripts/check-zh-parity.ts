/**
 * check-zh-parity.ts — EN/ZH bilingual content parity check.
 *
 * Validates:
 * - P1: Code block count matches between EN and ZH
 * - P2: Code block content is byte-identical
 * - P3: Code block language labels match
 * - P4: Production Proof links are identical
 * - P5: More Production Uses links are identical
 * - P6: Related Patterns row count matches (warning)
 * - P7: Mermaid diagram participant count matches (warning)
 *
 * Usage:
 *   tsx scripts/check-zh-parity.ts
 *   tsx scripts/check-zh-parity.ts --pattern circuit-breaker
 *   tsx scripts/check-zh-parity.ts --verbose
 */

import { readFileSync } from 'node:fs';
import {
  discoverPatterns,
  discoverCaseStudies,
  discoverByProject,
  extractCodeBlocks,
  extractSections,
  extractGitHubLinks,
  report,
  summarize,
  type PatternFile,
} from './lib/patterns.js';

const args = process.argv.slice(2);
const filterPattern = args.find((_, i, a) => a[i - 1] === '--pattern') || '';
const verbose = args.includes('--verbose');

// ─── Mermaid Block Extraction ────────────────────────────────────────────────

function extractMermaidBlocks(content: string): string[] {
  const blocks: string[] = [];
  const re = /```mermaid\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    blocks.push(m[1]!);
  }
  return blocks;
}

function countMermaidParticipants(block: string): number {
  // Count participants, actors, nodes in various diagram types
  const participantLines = block.split('\n').filter(
    (line) => /^\s*(participant|actor|subgraph)\s/.test(line) || /^\s*\w+[[({|]/.test(line), // flowchart nodes
  );
  return participantLines.length;
}

// ─── Check Functions ─────────────────────────────────────────────────────────

function checkParity(pf: PatternFile): void {
  if (!pf.hasZh) {
    report({
      file: pf.enPath,
      severity: 'error',
      message: `Missing ZH translation: docs/zh/patterns/${pf.slug}/index.md`,
      rule: 'P0',
    });
    return;
  }

  const enContent = readFileSync(pf.enPath, 'utf-8');
  const zhContent = readFileSync(pf.zhPath, 'utf-8');

  // P1-P3: Code blocks
  const enBlocks = extractCodeBlocks(enContent);
  const zhBlocks = extractCodeBlocks(zhContent);

  if (enBlocks.length !== zhBlocks.length) {
    report({
      file: pf.zhPath,
      severity: 'error',
      message: `Code block count mismatch: EN=${enBlocks.length}, ZH=${zhBlocks.length}`,
      rule: 'P1',
    });
  } else {
    for (let i = 0; i < enBlocks.length; i++) {
      const en = enBlocks[i]!;
      const zh = zhBlocks[i]!;
      if (en.language !== zh.language) {
        report({
          file: pf.zhPath,
          line: zh.startLine,
          severity: 'error',
          message: `Block ${i + 1} language mismatch: EN=${en.language}, ZH=${zh.language}`,
          rule: 'P3',
        });
      } else if (en.content !== zh.content) {
        report({
          file: pf.zhPath,
          line: zh.startLine,
          severity: 'error',
          message: `Block ${i + 1} [${en.language}] content differs from EN`,
          rule: 'P2',
        });
      }
    }
  }

  // P4: Production Proof links
  const enSections = extractSections(enContent);
  const zhSections = extractSections(zhContent);

  const enProof = enSections.find((s) => s.heading === 'Production Proof');
  const zhProof = zhSections.find((s) => s.heading === '生产验证');

  if (enProof && zhProof) {
    const enLinks = new Set(extractGitHubLinks(enProof.content).map((l) => l.url));
    const zhLinks = new Set(extractGitHubLinks(zhProof.content).map((l) => l.url));

    for (const url of enLinks) {
      if (!zhLinks.has(url)) {
        report({
          file: pf.zhPath,
          severity: 'error',
          message: `Production Proof link missing in ZH: ${url.slice(0, 80)}...`,
          rule: 'P4',
        });
      }
    }
    for (const url of zhLinks) {
      if (!enLinks.has(url)) {
        report({
          file: pf.zhPath,
          severity: 'error',
          message: `Production Proof link in ZH not found in EN: ${url.slice(0, 80)}...`,
          rule: 'P4',
        });
      }
    }
  }

  // P5: More Production Uses links
  const enMore = enSections.find((s) => s.heading === 'More Production Uses');
  const zhMore = zhSections.find((s) => s.heading === '更多生产案例');

  if (enMore && zhMore) {
    const enLinks = new Set(extractGitHubLinks(enMore.content).map((l) => l.url));
    const zhLinks = new Set(extractGitHubLinks(zhMore.content).map((l) => l.url));

    for (const url of enLinks) {
      if (!zhLinks.has(url)) {
        report({
          file: pf.zhPath,
          severity: 'error',
          message: `More Production Uses link missing in ZH: ${url.slice(0, 80)}...`,
          rule: 'P5',
        });
      }
    }
  }

  // P6: Related Patterns row count (warning)
  const enRelated = enSections.find((s) => s.heading === 'Related Patterns');
  const zhRelated = zhSections.find((s) => s.heading === '相关模式');

  if (enRelated && zhRelated) {
    const enRows = (enRelated.content.match(/^\|[^-]/gm) || []).length;
    const zhRows = (zhRelated.content.match(/^\|[^-]/gm) || []).length;
    if (enRows !== zhRows) {
      report({
        file: pf.zhPath,
        severity: 'warning',
        message: `Related Patterns row count mismatch: EN=${enRows}, ZH=${zhRows}`,
        rule: 'P6',
      });
    }
  }

  // P7: Mermaid participant count (warning)
  const enMermaid = extractMermaidBlocks(enContent);
  const zhMermaid = extractMermaidBlocks(zhContent);

  if (enMermaid.length === zhMermaid.length) {
    for (let i = 0; i < enMermaid.length; i++) {
      const enCount = countMermaidParticipants(enMermaid[i]!);
      const zhCount = countMermaidParticipants(zhMermaid[i]!);
      if (enCount !== zhCount) {
        report({
          file: pf.zhPath,
          severity: 'warning',
          message: `Mermaid diagram #${i + 1} participant count mismatch: EN=${enCount}, ZH=${zhCount}`,
          rule: 'P7',
        });
      }
    }
  }

  if (verbose) {
    console.log(`  ✓ ${pf.slug}: EN/ZH parity OK`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('check-zh-parity: Verifying EN/ZH content parity...\n');

  const patterns = discoverPatterns();
  const caseStudies = discoverCaseStudies();
  const byProject = discoverByProject();
  const all = [...patterns, ...caseStudies, ...byProject];
  const filtered = filterPattern ? all.filter((p) => p.slug === filterPattern) : all;

  if (filtered.length === 0) {
    console.error(`No patterns found${filterPattern ? ` matching "${filterPattern}"` : ''}`);
    process.exit(1);
  }

  console.log(
    `Checking ${patterns.length} pattern(s) + ${caseStudies.length} case study(ies) + ${byProject.length} by-project page(s)...\n`,
  );

  for (const pf of filtered) {
    checkParity(pf);
  }

  process.exit(summarize('check-zh-parity'));
}

main();
