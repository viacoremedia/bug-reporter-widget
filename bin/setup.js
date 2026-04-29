#!/usr/bin/env node

/**
 * @viacoremedia/bug-reporter setup CLI
 * 
 * Usage:
 *   npx bug-reporter-setup "System Name"
 * 
 * Automatically:
 *   1. Checks & installs missing shadcn/ui components
 *   2. Finds your App.tsx (or main layout)
 *   3. Adds the BugReporter import
 *   4. Adds <BugReporter systemName="X" /> before the closing fragment/div
 *   5. Detects useAuth and wires up user context if available
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const systemName = process.argv[2];

if (!systemName) {
  console.error('\x1b[31m✗ Usage: npx bug-reporter-setup "System Name"\x1b[0m');
  console.error('  Example: npx bug-reporter-setup "Precision ERP"');
  process.exit(1);
}

console.log(`\n\x1b[36m🐛 Bug Reporter Setup\x1b[0m`);
console.log(`   System: \x1b[1m${systemName}\x1b[0m\n`);

// ── Find src dir ──
const srcDir = path.resolve(process.cwd(), 'src');

if (!fs.existsSync(srcDir)) {
  console.error('\x1b[31m✗ No src/ directory found. Run this from your project root (client/).\x1b[0m');
  process.exit(1);
}

// ── Step 1: Check & install missing shadcn components ──
const REQUIRED_COMPONENTS = [
  'button',
  'input',
  'textarea',
  'label',
  'radio-group',
  'slider',
  'popover',
];

const uiDir = path.join(srcDir, 'components', 'ui');
const missing = [];

if (fs.existsSync(uiDir)) {
  for (const comp of REQUIRED_COMPONENTS) {
    const filePath = path.join(uiDir, `${comp}.tsx`);
    if (!fs.existsSync(filePath)) {
      missing.push(comp);
    }
  }
} else {
  console.error('\x1b[31m✗ No src/components/ui/ directory. Is shadcn/ui initialized?\x1b[0m');
  console.error('  Run: npx shadcn@latest init');
  process.exit(1);
}

if (missing.length > 0) {
  console.log(`   Installing missing shadcn components: \x1b[33m${missing.join(', ')}\x1b[0m`);
  try {
    execSync(`npx shadcn@latest add ${missing.join(' ')} --yes`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    console.log(`\x1b[32m   ✓ Components installed\x1b[0m\n`);
  } catch (err) {
    console.error(`\x1b[31m✗ Failed to install shadcn components. Install manually:\x1b[0m`);
    console.error(`  npx shadcn@latest add ${missing.join(' ')}`);
    process.exit(1);
  }
} else {
  console.log(`   \x1b[32m✓\x1b[0m All required shadcn components present`);
}

// ── Step 2: Check @/lib/utils exists ──
const utilsPath = path.join(srcDir, 'lib', 'utils.ts');
const utilsTsxPath = path.join(srcDir, 'lib', 'utils.tsx');
if (!fs.existsSync(utilsPath) && !fs.existsSync(utilsTsxPath)) {
  console.error('\x1b[31m✗ Missing src/lib/utils.ts (provides the cn() utility).\x1b[0m');
  console.error('  This is auto-created by shadcn init. Run: npx shadcn@latest init');
  process.exit(1);
}

// ── Step 3: Find the target file ──
const candidates = [
  'App.tsx', 'app.tsx',
  'App.jsx', 'app.jsx',
  'main.tsx', 'main.jsx',
  'pages/index.tsx', 'pages/Index.tsx',
];

let targetFile = null;
for (const candidate of candidates) {
  const fullPath = path.join(srcDir, candidate);
  if (fs.existsSync(fullPath)) {
    targetFile = fullPath;
    break;
  }
}

if (!targetFile) {
  console.error('\x1b[31m✗ Could not find App.tsx or main entry file in src/\x1b[0m');
  console.error('  Looked for:', candidates.join(', '));
  console.error('\n  You can manually add to your main component:');
  console.error(`    import { BugReporter } from '@viacoremedia/bug-reporter';`);
  console.error(`    <BugReporter systemName="${systemName}" />`);
  process.exit(1);
}

const relativePath = path.relative(process.cwd(), targetFile);
console.log(`   Found: \x1b[33m${relativePath}\x1b[0m`);

let content = fs.readFileSync(targetFile, 'utf-8');

// ── Check if already installed ──
if (content.includes('@viacoremedia/bug-reporter')) {
  console.log('\x1b[33m⚠ BugReporter already imported in this file. Skipping.\x1b[0m\n');
  process.exit(0);
}

// ── Detect auth context ──
const hasUseAuth = content.includes('useAuth');

console.log(`   Auth detected: ${hasUseAuth ? '\x1b[32myes\x1b[0m' : '\x1b[90mno\x1b[0m'}`);

// ── Build the import line ──
const importLine = `import { BugReporter } from '@viacoremedia/bug-reporter';`;

// ── Build the component JSX ──
let componentJsx;
if (hasUseAuth) {
  const userMatch = content.match(/const\s*\{\s*(?:user|currentUser)\s*(?:[:,}\s])/);
  const userVar = userMatch ? (userMatch[0].includes('currentUser') ? 'currentUser' : 'user') : null;

  if (userVar) {
    componentJsx = `<BugReporter systemName="${systemName}" user={${userVar} ? { name: ${userVar}.name, email: ${userVar}.email, role: ${userVar}.role, id: ${userVar}.id || ${userVar}._id } : undefined} />`;
  } else {
    componentJsx = `<BugReporter systemName="${systemName}" />`;
  }
} else {
  componentJsx = `<BugReporter systemName="${systemName}" />`;
}

// ── Add the import ──
const importRegex = /^import\s+.*?['"][^'"]+['"];?\s*$/gm;
let lastImportEnd = 0;
let match;
while ((match = importRegex.exec(content)) !== null) {
  lastImportEnd = match.index + match[0].length;
}

if (lastImportEnd > 0) {
  content = content.slice(0, lastImportEnd) + '\n' + importLine + content.slice(lastImportEnd);
} else {
  content = importLine + '\n' + content;
}

// ── Add the component ──
const closingPatterns = [
  { pattern: /(\s*)<\/>/g, tag: '</>' },
  { pattern: /(\s*)<\/Fragment>/g, tag: '</Fragment>' },
];

let componentAdded = false;

for (const { pattern, tag } of closingPatterns) {
  const matches = [...content.matchAll(pattern)];
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const before = content.slice(0, lastMatch.index);
    const after = content.slice(lastMatch.index + lastMatch[0].length);
    const indent = lastMatch[1] || '    ';
    content = before + `${indent}  {/* Bug Reporter */}\n${indent}  ${componentJsx}\n${indent}${tag}` + after;
    componentAdded = true;
    break;
  }
}

if (!componentAdded) {
  console.log('\x1b[33m⚠ Could not auto-inject component. Add manually:\x1b[0m');
  console.log(`    ${componentJsx}\n`);
}

// ── Write the file ──
fs.writeFileSync(targetFile, content, 'utf-8');

console.log(`\n\x1b[32m✓ Import added\x1b[0m`);
if (componentAdded) {
  console.log(`\x1b[32m✓ <BugReporter /> injected\x1b[0m`);
}
console.log(`\n\x1b[32m✅ Done!\x1b[0m Bug reporter is ready. Run your dev server to see the 🐛 icon.\n`);
