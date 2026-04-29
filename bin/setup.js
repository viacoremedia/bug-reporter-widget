#!/usr/bin/env node

/**
 * @viacoremedia/bug-reporter setup CLI
 * 
 * Usage:
 *   npx bug-reporter-setup "System Name"
 * 
 * Automatically:
 *   1. Finds your App.tsx (or main layout)
 *   2. Adds the BugReporter import
 *   3. Adds <BugReporter systemName="X" /> before the closing fragment/div
 *   4. Detects useAuth and wires up user context if available
 */

const fs = require('fs');
const path = require('path');

const systemName = process.argv[2];

if (!systemName) {
  console.error('\x1b[31m✗ Usage: npx bug-reporter-setup "System Name"\x1b[0m');
  console.error('  Example: npx bug-reporter-setup "Precision ERP"');
  process.exit(1);
}

console.log(`\n\x1b[36m🐛 Bug Reporter Setup\x1b[0m`);
console.log(`   System: \x1b[1m${systemName}\x1b[0m\n`);

// ── Find the target file ──
const srcDir = path.resolve(process.cwd(), 'src');

if (!fs.existsSync(srcDir)) {
  console.error('\x1b[31m✗ No src/ directory found. Run this from your project root.\x1b[0m');
  process.exit(1);
}

// Search order: App.tsx > main.tsx > App.jsx > main.jsx
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
if (content.includes('@viacoremedia/bug-reporter') || content.includes('BugReporter')) {
  console.log('\x1b[33m⚠ BugReporter already imported in this file. Skipping.\x1b[0m\n');
  process.exit(0);
}

// ── Detect auth context ──
const hasAuth = content.includes('useAuth') || content.includes('AuthContext') || content.includes('AuthProvider');
const hasUseAuth = content.includes('useAuth');

console.log(`   Auth detected: ${hasAuth ? '\x1b[32myes\x1b[0m' : '\x1b[90mno\x1b[0m'}`);

// ── Build the import line ──
const importLine = `import { BugReporter } from '@viacoremedia/bug-reporter';`;

// ── Build the component JSX ──
let componentJsx;
if (hasUseAuth) {
  // If useAuth is already imported and used, wire it up
  // Try to find what variable the auth user is stored in
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
// Find the last import statement and add after it
const importRegex = /^import\s+.*?['"][^'"]+['"];?\s*$/gm;
let lastImportEnd = 0;
let match;
while ((match = importRegex.exec(content)) !== null) {
  lastImportEnd = match.index + match[0].length;
}

if (lastImportEnd > 0) {
  content = content.slice(0, lastImportEnd) + '\n' + importLine + content.slice(lastImportEnd);
} else {
  // No imports found, add at top
  content = importLine + '\n' + content;
}

// ── Add the component ──
// Strategy: Find the last </> or </div> or </Fragment> before the final return's closing
// and insert the BugReporter just before it
const closingPatterns = [
  { pattern: /(\s*)<\/>/g, replacement: `$1  {/* Bug Reporter */}\n$1  ${componentJsx}\n$1</>` },
  { pattern: /(\s*)<\/Fragment>/g, replacement: `$1  {/* Bug Reporter */}\n$1  ${componentJsx}\n$1</Fragment>` },
];

let componentAdded = false;

for (const { pattern, replacement } of closingPatterns) {
  const matches = [...content.matchAll(pattern)];
  if (matches.length > 0) {
    // Replace the LAST occurrence (the outermost return)
    const lastMatch = matches[matches.length - 1];
    const before = content.slice(0, lastMatch.index);
    const after = content.slice(lastMatch.index + lastMatch[0].length);
    const indent = lastMatch[1] || '    ';
    content = before + `${indent}  {/* Bug Reporter */}\n${indent}  ${componentJsx}\n${indent}<${lastMatch[0].includes('Fragment') ? '/Fragment' : '/'}>`  + after;
    componentAdded = true;
    break;
  }
}

if (!componentAdded) {
  // Fallback: couldn't auto-inject, tell user
  console.log('\x1b[33m⚠ Could not auto-inject component. Add manually:\x1b[0m');
  console.log(`    ${componentJsx}\n`);
} 

// ── Write the file ──
fs.writeFileSync(targetFile, content, 'utf-8');

console.log(`\n\x1b[32m✓ Import added\x1b[0m`);
if (componentAdded) {
  console.log(`\x1b[32m✓ <BugReporter /> added\x1b[0m`);
}
console.log(`\n\x1b[32m✅ Done!\x1b[0m Bug reporter is ready. Run your dev server to see the 🐛 icon.\n`);
