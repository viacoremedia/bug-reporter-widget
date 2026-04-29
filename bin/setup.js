#!/usr/bin/env node

/**
 * @viacoremedia/bug-reporter setup CLI
 * 
 * Usage:
 *   npx bug-reporter-setup "System Name"
 * 
 * Handles EVERYTHING automatically:
 *   1. Tailwind CSS — installs + configures if missing
 *   2. shadcn/ui — initializes if missing
 *   3. Path alias — adds @ alias to vite.config if missing
 *   4. cn() utility — creates src/lib/utils.ts if missing
 *   5. shadcn components — installs all required components
 *   6. App.tsx — adds BugReporter import + component
 *   7. Auth — auto-detects useAuth() and wires up user context
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Helpers ──
const log = (msg) => console.log(`   ${msg}`);
const ok = (msg) => console.log(`   \x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => console.log(`   \x1b[33m⚠\x1b[0m ${msg}`);
const fail = (msg) => { console.error(`   \x1b[31m✗\x1b[0m ${msg}`); process.exit(1); };
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

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

// ══════════════════════════════════════════════
// STEP 1: Tailwind CSS
// ══════════════════════════════════════════════
console.log('\x1b[36m── Step 1: Tailwind CSS ──\x1b[0m');

const hasTailwindConfig = fs.existsSync(path.join(cwd, 'tailwind.config.js')) || 
                           fs.existsSync(path.join(cwd, 'tailwind.config.ts'));
const hasTailwindDep = pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss;

if (hasTailwindConfig && hasTailwindDep) {
  ok('Tailwind CSS already configured');
} else {
  log('Installing Tailwind CSS...');
  try {
    run('npm install -D tailwindcss @tailwindcss/vite');
    
    // Check if tailwind config exists, create if not
    if (!hasTailwindConfig) {
      // For Vite projects with @tailwindcss/vite plugin, we just need the CSS import
      // Check if using v4 (plugin-based) or v3 (config-based)
      const tailwindPkg = path.join(cwd, 'node_modules', 'tailwindcss', 'package.json');
      let twVersion = 3;
      if (fs.existsSync(tailwindPkg)) {
        const twPkgJson = JSON.parse(fs.readFileSync(tailwindPkg, 'utf-8'));
        twVersion = parseInt(twPkgJson.version.split('.')[0]);
      }

      if (twVersion >= 4) {
        // Tailwind v4 — uses CSS-based config, no tailwind.config needed
        // Just ensure @import "tailwindcss" is in the main CSS
        const cssFiles = ['index.css', 'App.css', 'globals.css', 'styles.css'];
        let mainCss = null;
        for (const f of cssFiles) {
          const p = path.join(srcDir, f);
          if (fs.existsSync(p)) { mainCss = p; break; }
        }
        if (mainCss) {
          let css = fs.readFileSync(mainCss, 'utf-8');
          if (!css.includes('@import "tailwindcss"') && !css.includes("@import 'tailwindcss'") && !css.includes('@tailwind')) {
            css = '@import "tailwindcss";\n\n' + css;
            fs.writeFileSync(mainCss, css, 'utf-8');
            ok('Added @import "tailwindcss" to ' + path.basename(mainCss));
          }
        }

        // Add @tailwindcss/vite plugin to vite.config
        const viteConfig = findFile(cwd, ['vite.config.ts', 'vite.config.js']);
        if (viteConfig) {
          let vc = fs.readFileSync(viteConfig, 'utf-8');
          if (!vc.includes('@tailwindcss/vite')) {
            vc = `import tailwindcss from '@tailwindcss/vite';\n` + vc;
            // Add to plugins array
            vc = vc.replace(/plugins:\s*\[/, 'plugins: [tailwindcss(), ');
            fs.writeFileSync(viteConfig, vc, 'utf-8');
            ok('Added @tailwindcss/vite plugin to vite config');
          }
        }
      } else {
        // Tailwind v3 — needs config file
        run('npm install -D postcss autoprefixer');
        run('npx tailwindcss init -p');
        
        // Update content paths
        const twConfig = path.join(cwd, 'tailwind.config.js');
        if (fs.existsSync(twConfig)) {
          let cfg = fs.readFileSync(twConfig, 'utf-8');
          cfg = cfg.replace(/content:\s*\[\]/, 'content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"]');
          fs.writeFileSync(twConfig, cfg, 'utf-8');
        }

        // Add directives to CSS
        const cssFiles = ['index.css', 'App.css', 'globals.css', 'styles.css'];
        let mainCss = null;
        for (const f of cssFiles) {
          const p = path.join(srcDir, f);
          if (fs.existsSync(p)) { mainCss = p; break; }
        }
        if (mainCss) {
          let css = fs.readFileSync(mainCss, 'utf-8');
          if (!css.includes('@tailwind')) {
            css = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n' + css;
            fs.writeFileSync(mainCss, css, 'utf-8');
          }
        }
      }
    }
    ok('Tailwind CSS configured');
  } catch (err) {
    fail('Failed to install Tailwind CSS: ' + err.message);
  }
}

// ══════════════════════════════════════════════
// STEP 2: Path alias (@/ -> src/)
// ══════════════════════════════════════════════
console.log('\x1b[36m── Step 2: Path alias ──\x1b[0m');

const viteConfigPath = findFile(cwd, ['vite.config.ts', 'vite.config.js']);
if (viteConfigPath) {
  let vc = fs.readFileSync(viteConfigPath, 'utf-8');
  if (vc.includes('"@"') || vc.includes("'@'")) {
    ok('@ alias already configured in vite config');
  } else {
    // Add path import and alias
    if (!vc.includes('import path')) {
      vc = `import path from "path";\n` + vc;
    }
    
    // Add resolve.alias
    if (vc.includes('resolve:')) {
      // resolve block exists, add alias inside
      vc = vc.replace(/resolve:\s*\{/, 'resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },');
    } else {
      // No resolve block, add before closing of defineConfig
      vc = vc.replace(/}\)\);?\s*$/, '  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },\n  },\n}));');
    }
    
    fs.writeFileSync(viteConfigPath, vc, 'utf-8');
    ok('Added @ path alias to vite config');
  }

  // Also check tsconfig for path alias
  const tsconfigPath = findFile(cwd, ['tsconfig.json', 'tsconfig.app.json']);
  if (tsconfigPath) {
    let tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    const co = tsconfig.compilerOptions || {};
    const paths = co.paths || {};
    if (!paths['@/*']) {
      co.baseUrl = co.baseUrl || '.';
      co.paths = { ...paths, '@/*': ['./src/*'] };
      tsconfig.compilerOptions = co;
      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf-8');
      ok('Added @/* path to ' + path.basename(tsconfigPath));
    } else {
      ok('@ path already in tsconfig');
    }
  }
} else {
  warn('No vite.config found — skipping alias setup');
}

// ══════════════════════════════════════════════
// STEP 3: cn() utility (src/lib/utils.ts)
// ══════════════════════════════════════════════
console.log('\x1b[36m── Step 3: Utilities ──\x1b[0m');

const libDir = path.join(srcDir, 'lib');
const utilsPath = path.join(libDir, 'utils.ts');

if (fs.existsSync(utilsPath)) {
  const utilsContent = fs.readFileSync(utilsPath, 'utf-8');
  if (utilsContent.includes('cn(')) {
    ok('cn() utility already exists');
  } else {
    // Append cn to existing utils
    const cnCode = `\nimport { type ClassValue, clsx } from "clsx";\nimport { twMerge } from "tailwind-merge";\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n`;
    fs.appendFileSync(utilsPath, cnCode, 'utf-8');
    run('npm install clsx tailwind-merge');
    ok('Added cn() to existing utils.ts');
  }
} else {
  // Create lib dir and utils.ts
  fs.mkdirSync(libDir, { recursive: true });
  const cnCode = `import { type ClassValue, clsx } from "clsx";\nimport { twMerge } from "tailwind-merge";\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n`;
  fs.writeFileSync(utilsPath, cnCode, 'utf-8');
  run('npm install clsx tailwind-merge');
  ok('Created src/lib/utils.ts with cn()');
}

// ══════════════════════════════════════════════
// STEP 4: shadcn/ui components
// ══════════════════════════════════════════════
console.log('\x1b[36m── Step 4: UI Components ──\x1b[0m');

const REQUIRED_COMPONENTS = ['button', 'input', 'textarea', 'label', 'radio-group', 'slider', 'popover'];

const uiDir = path.join(srcDir, 'components', 'ui');

// Check if shadcn is initialized (has components.json)
const hasComponentsJson = fs.existsSync(path.join(cwd, 'components.json'));

if (!hasComponentsJson) {
  log('Initializing shadcn/ui...');
  try {
    run('npx -y shadcn@latest init --yes --defaults');
    ok('shadcn/ui initialized');
  } catch (err) {
    // If init fails, create the components.json manually
    warn('shadcn init failed, creating config manually...');
    const componentsJson = {
      "$schema": "https://ui.shadcn.com/schema.json",
      "style": "default",
      "rsc": false,
      "tsx": true,
      "tailwind": { "config": "tailwind.config.js", "css": "src/index.css", "baseColor": "neutral", "cssVariables": true },
      "aliases": { "components": "@/components", "utils": "@/lib/utils" }
    };
    fs.writeFileSync(path.join(cwd, 'components.json'), JSON.stringify(componentsJson, null, 2) + '\n');
    fs.mkdirSync(uiDir, { recursive: true });
    ok('Created components.json manually');
  }
}

// Install missing components
const missing = [];
if (fs.existsSync(uiDir)) {
  for (const comp of REQUIRED_COMPONENTS) {
    if (!fs.existsSync(path.join(uiDir, `${comp}.tsx`))) {
      missing.push(comp);
    }
  }
} else {
  missing.push(...REQUIRED_COMPONENTS);
}

if (missing.length > 0) {
  log(`Installing: ${missing.join(', ')}...`);
  try {
    run(`npx -y shadcn@latest add ${missing.join(' ')} --yes`);
    ok('All UI components installed');
  } catch (err) {
    warn(`Some components failed. Try manually: npx shadcn@latest add ${missing.join(' ')}`);
  }
} else {
  ok('All required components present');
}

// ══════════════════════════════════════════════
// STEP 5: Patch App.tsx
// ══════════════════════════════════════════════
console.log('\x1b[36m── Step 5: Add BugReporter ──\x1b[0m');

const candidates = ['App.tsx', 'app.tsx', 'App.jsx', 'app.jsx', 'main.tsx', 'main.jsx', 'pages/index.tsx', 'pages/Index.tsx'];
let targetFile = null;
for (const c of candidates) {
  const p = path.join(srcDir, c);
  if (fs.existsSync(p)) { targetFile = p; break; }
}

if (!targetFile) {
  warn('Could not find App.tsx — add manually:');
  log(`  import { BugReporter } from '@viacoremedia/bug-reporter';`);
  log(`  <BugReporter systemName="${systemName}" />`);
} else {
  const relPath = path.relative(cwd, targetFile);
  log(`Found: ${relPath}`);

  let content = fs.readFileSync(targetFile, 'utf-8');

  if (content.includes('@viacoremedia/bug-reporter')) {
    ok('BugReporter already imported — skipping');
  } else {
    // Detect auth
    const hasUseAuth = content.includes('useAuth');
    log(`Auth detected: ${hasUseAuth ? 'yes' : 'no'}`);

    // Build import
    const importLine = `import { BugReporter } from '@viacoremedia/bug-reporter';`;

    // Build JSX
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

    // Inject component before closing </> or </Fragment>
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
        content = before + `${indent}  {/* Bug Reporter */}\n${indent}  ${componentJsx}\n${indent}${tag}` + after;
        added = true;
        break;
      }
    }

    fs.writeFileSync(targetFile, content, 'utf-8');
    ok('Import added');
    if (added) ok('<BugReporter /> injected');
    else warn('Could not auto-inject — add the component manually to your JSX');
  }
}

console.log(`\n\x1b[32m✅ Setup complete!\x1b[0m Run your dev server to see the 🐛 icon.\n`);

// ── Utility ──
function findFile(dir, names) {
  for (const name of names) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
