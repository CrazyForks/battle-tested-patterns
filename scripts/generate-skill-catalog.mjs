// Generates the pattern catalog block inside
// plugins/pattern-skills/skills/adopt-pattern/SKILL.md.
//
// Source of truth: the "46 Patterns at a Glance" table in README.md (category
// + symptom cue + slug) enriched with each pattern doc's frontmatter
// (difficulty + one-liner description). Run after adding or editing a pattern
// so the adopt-pattern skill's router never drifts from the docs:
//
//   node scripts/generate-skill-catalog.mjs           # rewrite the block
//   node scripts/generate-skill-catalog.mjs --check    # CI: fail if stale
//
// The catalog is written between the CATALOG:START / CATALOG:END markers.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const readmePath = join(repoRoot, 'README.md');
const skillPath = join(
  repoRoot,
  'plugins',
  'pattern-skills',
  'skills',
  'adopt-pattern',
  'SKILL.md',
);

const START = '<!-- CATALOG:START -->';
const END = '<!-- CATALOG:END -->';

// Doc links point at the GitHub source markdown (not the Pages domain): stable
// across a future custom domain or a failed site deploy, and consistent with
// the project's "precise source links → GitHub" house style.
const DOC_BASE = 'https://github.com/Totoro-jam/battle-tested-patterns/blob/main/docs/patterns';

/** Pull `description` and `difficulty` out of a pattern doc's YAML frontmatter. */
function readFrontmatter(slug) {
  const docPath = join(repoRoot, 'docs', 'patterns', slug, 'index.md');
  if (!existsSync(docPath)) return { description: '', difficulty: '' };
  const fm = readFileSync(docPath, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const block = fm ? fm[1] : '';
  const field = (name) => {
    const m = block.match(new RegExp(`^${name}:\\s*(.*?)\\s*$`, 'm'));
    if (!m) return '';
    // Strip a single matching pair of surrounding quotes (YAML uses '' or "").
    return m[1].replace(/^(['"])(.*)\1$/, '$2').trim();
  };
  return { description: field('description'), difficulty: field('difficulty') };
}

/**
 * Parse the "46 Patterns at a Glance" section of the README into ordered
 * categories. Category headers look like `**🧠 Data Structures**`; entries
 * look like `- [Name](.../patterns/<slug>/) — <cue>`.
 */
function parseReadme() {
  const md = readFileSync(readmePath, 'utf8');
  const start = md.indexOf('## 46 Patterns at a Glance');
  const end = md.indexOf('## The Gap This Fills');
  if (start === -1 || end === -1) {
    throw new Error('Could not locate the glance table in README.md');
  }
  const section = md.slice(start, end);

  const categories = [];
  let current = null;
  for (const line of section.split('\n')) {
    const header = line.match(/^\*\*(.+?)\*\*\s*$/);
    if (header) {
      const label = header[1].trim();
      if (/Proven In/i.test(label)) {
        current = null; // not a pattern category
        continue;
      }
      current = { label, patterns: [] };
      categories.push(current);
      continue;
    }
    const item = line.match(
      /^-\s*\[(.+?)\]\((https?:\/\/.*?\/patterns\/([\w-]+)\/?)\)\s*—\s*(.+?)\s*$/,
    );
    if (item && current) {
      const [, name, url, slug, cue] = item;
      current.patterns.push({ name, slug, url, cue, ...readFrontmatter(slug) });
    }
  }
  return categories.filter((c) => c.patterns.length > 0);
}

/** Render the catalog markdown grouped by category. */
function renderCatalog(categories) {
  const total = categories.reduce((n, c) => n + c.patterns.length, 0);
  const out = [
    START,
    '',
    `_${total} patterns. Match the developer's problem to a row, then fetch only that pattern's doc URL._`,
    '',
  ];
  for (const cat of categories) {
    out.push(`### ${cat.label}`, '');
    out.push('| Pattern | Reach for it when | Level | Doc URL |');
    out.push('| --- | --- | --- | --- |');
    for (const p of cat.patterns) {
      const blurb = p.description || p.cue;
      // Angle-bracket the URL: an autolink keeps the raw URL visible for the
      // agent while satisfying markdownlint MD034 (no bare URLs).
      const doc = `${DOC_BASE}/${p.slug}/index.md`;
      out.push(`| **${p.name}** | ${p.cue} — ${blurb} | ${p.difficulty || '—'} | <${doc}> |`);
    }
    out.push('');
  }
  out.push(END);
  return out.join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  const categories = parseReadme();
  const catalog = renderCatalog(categories);

  const skill = readFileSync(skillPath, 'utf8');
  const startIdx = skill.indexOf(START);
  const endIdx = skill.indexOf(END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Missing ${START} / ${END} markers in ${skillPath}`);
  }
  const next = skill.slice(0, startIdx) + catalog + skill.slice(endIdx + END.length);

  if (check) {
    if (next !== skill) {
      console.error('SKILL.md catalog is stale. Run: node scripts/generate-skill-catalog.mjs');
      process.exit(1);
    }
    console.log('SKILL.md catalog is up to date.');
    return;
  }

  writeFileSync(skillPath, next);
  const total = categories.reduce((n, c) => n + c.patterns.length, 0);
  console.log(`Wrote ${total} patterns across ${categories.length} categories to ${skillPath}`);
}

main();
