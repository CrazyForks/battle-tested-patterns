import fs from 'fs';
import path from 'path';

const enDir = 'docs/patterns';
const zhDir = 'docs/zh/patterns';

function extractCodeBlocks(content) {
  const blocks = {};
  const regex = /```(\w+) \[(\w+)\]\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks[match[2]] = { lang: match[1], label: match[2], code: match[3] };
  }
  return blocks;
}

function findCodeGroupEnd(content) {
  const start = content.indexOf('::: code-group');
  if (start === -1) return { start: -1, end: -1 };

  // Find the matching ::: that closes the code-group
  // It's a line that's just ":::" (possibly with whitespace)
  const lines = content.slice(start).split('\n');
  let depth = 0;
  let pos = start;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0) {
      // This is "::: code-group"
      depth = 1;
      pos += line.length + 1;
      continue;
    }
    if (line.match(/^:::\s*$/)) {
      depth--;
      if (depth === 0) {
        return { start, end: pos };
      }
    } else if (line.match(/^:::/)) {
      depth++;
    }
    pos += line.length + 1;
  }
  return { start, end: -1 };
}

let totalFixed = 0;

const slugs = fs.readdirSync(enDir).filter(f => {
  const fp = path.join(enDir, f, 'index.md');
  return fs.existsSync(fp);
});

for (const slug of slugs) {
  const enPath = path.join(enDir, slug, 'index.md');
  const zhPath = path.join(zhDir, slug, 'index.md');
  if (!fs.existsSync(zhPath)) continue;

  const enContent = fs.readFileSync(enPath, 'utf8');
  const zhContent = fs.readFileSync(zhPath, 'utf8');

  const enBlocks = extractCodeBlocks(enContent);
  const zhBlocks = extractCodeBlocks(zhContent);

  const enLangs = Object.keys(enBlocks);
  const zhLangs = Object.keys(zhBlocks);
  const missing = enLangs.filter(l => !zhLangs.includes(l));

  if (missing.length === 0) continue;

  // Find the closing ::: of the code-group in ZH
  const { end: codeGroupEndPos } = findCodeGroupEnd(zhContent);
  if (codeGroupEndPos === -1) {
    console.log(`SKIP ${slug}: could not find code-group end`);
    continue;
  }

  // Insert missing blocks before the closing :::
  let insertions = '';
  for (const lang of missing) {
    const block = enBlocks[lang];
    insertions += `\n\`\`\`${block.lang} [${block.label}]\n${block.code}\`\`\`\n`;
  }

  const newZhContent = zhContent.slice(0, codeGroupEndPos) + insertions + zhContent.slice(codeGroupEndPos);
  fs.writeFileSync(zhPath, newZhContent);
  console.log(`${slug}: added ${missing.join(', ')}`);
  totalFixed++;
}

console.log(`\nFixed ${totalFixed} files.`);
