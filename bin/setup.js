#!/usr/bin/env node

/**
 * @viacoremedia/bug-reporter setup CLI
 * 
 * Usage:
 *   npx bug-reporter-setup "System Name"
 * 
 * Copies bug reporter source into your project (like shadcn does)
 * and handles all dependencies automatically.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Helpers ──
const ok = (msg) => console.log(`   \x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => console.log(`   \x1b[33m⚠\x1b[0m ${msg}`);
const fail = (msg) => { console.error(`   \x1b[31m✗\x1b[0m ${msg}`); process.exit(1); };
const log = (msg) => console.log(`   ${msg}`);
const run = (cmd) => execSync(cmd, { cwd: process.cwd(), stdio: 'inherit' });

const systemName = process.argv[2];

if (!systemName) {
  console.error('\x1b[31m✗ Usage: npx bug-reporter-setup "System Name"\x1b[0m');
  console.error('  Example: npx bug-reporter-setup "Precision ERP"');
  process.exit(1);
}

console.log(`\n\x1b[36m🐛 Bug Reporter Setup\x1b[0m`);
console.log(`   System: \x1b[1m${systemName}\x1b[0m\n`);

const cwd = process.cwd();
const srcDir = path.join(cwd, 'src');
const pkgPath = path.join(cwd, 'package.json');

if (!fs.existsSync(srcDir)) fail('No src/ directory found. Run this from your client/ (frontend) folder.');
if (!fs.existsSync(pkgPath)) fail('No package.json found. Run this from your client/ (frontend) folder.');

// Find the package source files
const pkgSrcDir = path.join(cwd, 'node_modules', '@viacoremedia', 'bug-reporter', 'src');
if (!fs.existsSync(pkgSrcDir)) fail('@viacoremedia/bug-reporter not installed. Run: npm install @viacoremedia/bug-reporter');

// ══════════════════════════════════════════════
// STEP 1: Tailwind CSS
// ══════════════════════════════════════════════
console.log('\x1b[36m── Step 1: Tailwind CSS ──\x1b[0m');

const hasTailwindConfig = fs.existsSync(path.join(cwd, 'tailwind.config.js')) || 
                           fs.existsSync(path.join(cwd, 'tailwind.config.ts'));
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const hasTailwindDep = pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss;

if (hasTailwindConfig || hasTailwindDep) {
  ok('Tailwind CSS already configured');
} else {
  log('Installing Tailwind CSS...');
  try {
    run('npm install -D tailwindcss @tailwindcss/vite');
    
    // Add @tailwindcss/vite plugin
    const viteConfig = findFile(cwd, ['vite.config.ts', 'vite.config.js']);
    if (viteConfig) {
      let vc = fs.readFileSync(viteConfig, 'utf-8');
      if (!vc.includes('@tailwindcss/vite')) {
        vc = `import tailwindcss from '@tailwindcss/vite';\n` + vc;
        vc = vc.replace(/plugins:\s*\[/, 'plugins: [tailwindcss(), ');
        fs.writeFileSync(viteConfig, vc, 'utf-8');
      }
    }

    // Add @import "tailwindcss" to CSS
    const cssFiles = ['index.css', 'App.css', 'globals.css', 'styles.css'];
    for (const f of cssFiles) {
      const p = path.join(srcDir, f);
      if (fs.existsSync(p)) {
        let css = fs.readFileSync(p, 'utf-8');
        if (!css.includes('@import "tailwindcss"') && !css.includes("@import 'tailwindcss'") && !css.includes('@tailwind')) {
          css = '@import "tailwindcss";\n\n' + css;
          fs.writeFileSync(p, css, 'utf-8');
        }
        break;
      }
    }
    ok('Tailwind CSS configured');
  } catch (err) {
    fail('Failed to install Tailwind CSS: ' + err.message);
  }
}

// Ensure index.css is imported in main.tsx (shadcn writes CSS vars there)
const mainTsx = findFile(srcDir, ['main.tsx', 'main.jsx', 'main.ts']);
if (mainTsx) {
  let mainContent = fs.readFileSync(mainTsx, 'utf-8');
  if (!mainContent.includes('index.css')) {
    // Add import at top, after other imports
    const importRegex = /^import\s+.*?['"][^'"]+['"];?\s*$/gm;
    let lastImportEnd = 0;
    let m;
    while ((m = importRegex.exec(mainContent)) !== null) {
      lastImportEnd = m.index + m[0].length;
    }
    if (lastImportEnd > 0) {
      mainContent = mainContent.slice(0, lastImportEnd) + "\nimport './index.css';" + mainContent.slice(lastImportEnd);
    } else {
      mainContent = "import './index.css';\n" + mainContent;
    }
    fs.writeFileSync(mainTsx, mainContent, 'utf-8');
    ok('Added index.css import to main.tsx');
  } else {
    ok('index.css already imported');
  }
}

// ══════════════════════════════════════════════
// STEP 2: Path alias + utils
// ══════════════════════════════════════════════
console.log('\x1b[36m── Step 2: Path alias & utilities ──\x1b[0m');

const viteConfigPath = findFile(cwd, ['vite.config.ts', 'vite.config.js']);
if (viteConfigPath) {
  let vc = fs.readFileSync(viteConfigPath, 'utf-8');
  if (vc.includes('"@"') || vc.includes("'@'")) {
    ok('@ alias already configured');
  } else {
    if (!vc.includes('import path')) {
      vc = `import path from "path";\n` + vc;
    }
    if (vc.includes('resolve:')) {
      vc = vc.replace(/resolve:\s*\{/, 'resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },');
    } else {
      // Insert resolve block before the last closing brace(s)
      // Handles: }))  OR  })  OR  }); etc.
      const resolveBlock = '  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },\n  },\n';
      // Find the last } that closes the config object
      const lastBrace = vc.lastIndexOf('}');
      if (lastBrace > -1) {
        vc = vc.slice(0, lastBrace) + resolveBlock + vc.slice(lastBrace);
      }
    }
    fs.writeFileSync(viteConfigPath, vc, 'utf-8');
    ok('Added @ path alias to vite config');
  }
}

// tsconfig path alias
const tsconfigPath = findFile(cwd, ['tsconfig.json', 'tsconfig.app.json']);
if (tsconfigPath) {
  try {
    let tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    const co = tsconfig.compilerOptions || {};
    if (!co.paths?.['@/*']) {
      co.baseUrl = co.baseUrl || '.';
      co.paths = { ...(co.paths || {}), '@/*': ['./src/*'] };
      tsconfig.compilerOptions = co;
      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf-8');
      ok('Added @/* path to ' + path.basename(tsconfigPath));
    } else {
      ok('@ path already in tsconfig');
    }
  } catch (e) { /* skip if tsconfig can't be parsed */ }
}

// cn() utility
const libDir = path.join(srcDir, 'lib');
const utilsPath = path.join(libDir, 'utils.ts');
if (fs.existsSync(utilsPath) && fs.readFileSync(utilsPath, 'utf-8').includes('cn(')) {
  ok('cn() utility exists');
} else {
  fs.mkdirSync(libDir, { recursive: true });
  const cnCode = `import { type ClassValue, clsx } from "clsx";\nimport { twMerge } from "tailwind-merge";\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n`;
  if (fs.existsSync(utilsPath)) {
    fs.appendFileSync(utilsPath, '\n' + cnCode, 'utf-8');
  } else {
    fs.writeFileSync(utilsPath, cnCode, 'utf-8');
  }
  run('npm install clsx tailwind-merge');
  ok('Created cn() utility');
}

// ══════════════════════════════════════════════
// STEP 3: shadcn/ui components
// ══════════════════════════════════════════════
console.log('\x1b[36m── Step 3: UI Components ──\x1b[0m');

const REQUIRED_COMPONENTS = ['button', 'input', 'textarea', 'label', 'radio-group', 'slider', 'popover'];
const uiDir = path.join(srcDir, 'components', 'ui');

if (!fs.existsSync(path.join(cwd, 'components.json'))) {
  log('Initializing shadcn/ui...');
  try {
    run('npx -y shadcn@latest init --yes --defaults');
    ok('shadcn/ui initialized');
  } catch (err) {
    // Create manually if init fails
    fs.mkdirSync(uiDir, { recursive: true });
    const componentsJson = {
      "$schema": "https://ui.shadcn.com/schema.json",
      "style": "default", "rsc": false, "tsx": true,
      "tailwind": { "config": "tailwind.config.js", "css": "src/index.css", "baseColor": "neutral", "cssVariables": true },
      "aliases": { "components": "@/components", "utils": "@/lib/utils" }
    };
    fs.writeFileSync(path.join(cwd, 'components.json'), JSON.stringify(componentsJson, null, 2) + '\n');
    ok('Created components.json manually');
  }
}

const missing = [];
fs.mkdirSync(uiDir, { recursive: true });
for (const comp of REQUIRED_COMPONENTS) {
  if (!fs.existsSync(path.join(uiDir, `${comp}.tsx`))) missing.push(comp);
}

if (missing.length > 0) {
  log(`Installing: ${missing.join(', ')}...`);
  try {
    run(`npx -y shadcn@latest add ${missing.join(' ')} --yes`);
    ok('All UI components installed');
  } catch (err) {
    warn(`Try manually: npx shadcn@latest add ${missing.join(' ')}`);
  }
} else {
  ok('All required components present');
}

// ══════════════════════════════════════════════
// STEP 4: Copy bug reporter source into project
// ══════════════════════════════════════════════
console.log('\x1b[36m── Step 4: Copy BugReporter files ──\x1b[0m');

const destDir = path.join(srcDir, 'components', 'BugReporter');
fs.mkdirSync(destDir, { recursive: true });

const filesToCopy = [
  'BugReporter.tsx',
  'BugReportModal.tsx',
  'AnnotationEditor.tsx',
  'RouteTracker.tsx',
  'types.ts',
  'index.ts',
];

for (const file of filesToCopy) {
  const srcFile = path.join(pkgSrcDir, file);
  const destFile = path.join(destDir, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
  }
}

// Create config.ts with the system name
const configContent = `// ============================================\n// BUG REPORTER CONFIGURATION\n// Generated by @viacoremedia/bug-reporter setup\n// ============================================\n\nexport const SYSTEM_NAME = "${systemName}";\nexport const BUG_REPORTER_API_URL = "https://bug-reporter-tau.vercel.app";\n`;
fs.writeFileSync(path.join(destDir, 'config.ts'), configContent, 'utf-8');

// Update BugReporter.tsx to use config file instead of props for systemName
let bugReporterSrc = fs.readFileSync(path.join(destDir, 'BugReporter.tsx'), 'utf-8');
// Replace the props-based config import with the local config
if (!bugReporterSrc.includes('./config')) {
  bugReporterSrc = `import { SYSTEM_NAME, BUG_REPORTER_API_URL } from './config';\n` + bugReporterSrc;
}

// Update index.ts to just export from the component
const indexContent = `export { BugReporter } from './BugReporter';\nexport { BugReportModal } from './BugReportModal';\nexport { RouteTracker, getBufferedLogs } from './RouteTracker';\nexport { AnnotationEditor } from './AnnotationEditor';\nexport type { BugReporterConfig, BugReporterUser, Severity, ReportType } from './types';\n`;
fs.writeFileSync(path.join(destDir, 'index.ts'), indexContent, 'utf-8');

ok(`Copied ${filesToCopy.length} files to src/components/BugReporter/`);
ok(`Config: systemName = "${systemName}"`);

// ══════════════════════════════════════════════
// STEP 5: Patch App.tsx
// ══════════════════════════════════════════════
console.log('\x1b[36m── Step 5: Add to App ──\x1b[0m');

const candidates = ['App.tsx', 'app.tsx', 'App.jsx', 'app.jsx', 'main.tsx', 'main.jsx', 'pages/index.tsx', 'pages/Index.tsx'];
let targetFile = null;
for (const c of candidates) {
  const p = path.join(srcDir, c);
  if (fs.existsSync(p)) { targetFile = p; break; }
}

if (!targetFile) {
  warn('Could not find App.tsx — add manually:');
  log(`  import { BugReporter } from '@/components/BugReporter';`);
  log(`  <BugReporter />`);
} else {
  let content = fs.readFileSync(targetFile, 'utf-8');

  if (content.includes('BugReporter')) {
    ok('BugReporter already imported — skipping');
  } else {
    // Use local import (not from node_modules!)
    const importLine = `import { BugReporter } from '@/components/BugReporter';`;

    // Add import after last import
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

    // Inject <BugReporter /> before closing </> or </Fragment>
    const closingPatterns = [
      { pattern: /(\s*)<\/>/g, tag: '</>' },
      { pattern: /(\s*)<\/Fragment>/g, tag: '</Fragment>' },
    ];

    let added = false;
    for (const { pattern, tag } of closingPatterns) {
      const matches = [...content.matchAll(pattern)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const before = content.slice(0, lastMatch.index);
        const after = content.slice(lastMatch.index + lastMatch[0].length);
        const indent = lastMatch[1] || '    ';
        content = before + `${indent}  {/* Bug Reporter */}\n${indent}  <BugReporter />\n${indent}${tag}` + after;
        added = true;
        break;
      }
    }

    fs.writeFileSync(targetFile, content, 'utf-8');
    ok('Import added');
    if (added) ok('<BugReporter /> injected');
    else warn('Could not auto-inject — add <BugReporter /> to your JSX manually');
  }
}

console.log(`\n\x1b[32m✅ Setup complete!\x1b[0m Run your dev server to see the 🐛 icon.`);
console.log(`   Config: src/components/BugReporter/config.ts\n`);

// ── Utility ──
function findFile(dir, names) {
  for (const name of names) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
