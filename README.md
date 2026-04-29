# @viacoremedia/bug-reporter

Drop-in bug reporter & feature request widget for any ViacoreMedia React project. Renders a floating bug icon that opens a full-featured reporting modal with screenshot capture, annotation tools, and automatic context collection.

Reports are sent to the [Bug Reporter Server](https://github.com/viacoremedia/bug-reporter) API.

## Installation

This package is hosted on **GitHub Packages**, not the public npm registry.

### 1. Configure your project's `.npmrc`

Create or update `.npmrc` in your project root (next to `package.json`):

```
@viacoremedia:registry=https://npm.pkg.github.com
```

### 2. Authenticate (one-time)

Generate a [GitHub PAT](https://github.com/settings/tokens) with `read:packages` scope, then:

```bash
npm login --scope=@viacoremedia --registry=https://npm.pkg.github.com
```

### 3. Install

```bash
npm install @viacoremedia/bug-reporter html2canvas
```

## Usage

```tsx
import { BugReporter } from '@viacoremedia/bug-reporter';

// Minimal — just the system name
<BugReporter systemName="Precision ERP" />

// With user context from your auth system
const { user } = useAuth();

<BugReporter
  systemName="Map"
  user={{
    name: user.name,
    email: user.email,
    role: user.role,
    id: user.id,
  }}
/>
```

> **Note:** Must be rendered inside a `<BrowserRouter>` (or any react-router-dom Router) since the RouteTracker uses `useLocation()`.

## Features

| Feature | Description |
|---|---|
| 🐛 Bug / 💡 Feature toggle | Users can submit bug reports or feature requests from the same modal |
| 📸 Screenshot capture | Native tab capture via `getDisplayMedia`, with `html2canvas` fallback |
| ✏️ Annotation editor | Draw on screenshots with pen, arrow, rectangle, and text tools |
| 📋 Auto-context | Captures current page URL, viewport size, browser info, and last 50 console logs |
| 👤 User identity | Optional — attaches reporter name, email, role to the report |
| 🔄 Auto-registration | Registers the system with the API on first page load (idempotent) |
| 🎨 Theme-aware | Uses the host app's shadcn/ui components so it matches your design system |

## Props

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `systemName` | `string` | ✅ | — | Unique identifier for this system (e.g. `"Map"`, `"Precision ERP"`) |
| `user` | `BugReporterUser` | ❌ | `undefined` | User context to attach to reports |
| `apiUrl` | `string` | ❌ | `https://bug-reporter-tau.vercel.app` | Bug reporter API URL |
| `contact` | `string` | ❌ | `joshua@viacoremedia.com` | Contact email sent during auto-registration |

### `BugReporterUser`

```ts
interface BugReporterUser {
  name?: string;
  email?: string;
  role?: string;
  id?: string;
}
```

## Peer Dependencies

This package ships raw TypeScript/TSX source and relies on the host app's bundler (Vite) to compile it. Your project must have:

| Dependency | Why |
|---|---|
| `react` ≥ 18 | Core framework |
| `react-dom` ≥ 18 | DOM rendering |
| `react-router-dom` ≥ 6 | `RouteTracker` uses `useLocation()` |
| `lucide-react` | Icons (Bug, Camera, Pencil, X, etc.) |
| `html2canvas` ≥ 1.4 | Fallback screenshot capture |
| shadcn/ui: `Button`, `Input`, `Textarea`, `Label`, `RadioGroup`, `Slider`, `Popover` | UI primitives (resolved from the host app's `@/components/ui/`) |

## Architecture

```
Host App (Vite)
  └─ @viacoremedia/bug-reporter (raw TSX source)
       ├─ BugReporter.tsx        ← Floating button + auto-register
       ├─ BugReportModal.tsx     ← Full modal (title, desc, severity, capture)
       ├─ AnnotationEditor.tsx   ← Canvas drawing tools
       ├─ RouteTracker.tsx       ← Console log interceptor + route tracking
       ├─ types.ts               ← Shared TypeScript types
       └─ index.ts               ← Public exports
            │
            ▼  (HTTP POST)
  bug-reporter-tau.vercel.app    ← Bug Reporter Server API
```

The package imports `@/components/ui/*` and `@/lib/utils` — these resolve to the **host app's** shadcn components via Vite's `@` alias, so the widget automatically inherits your app's theme.

## Exports

```ts
// Components
export { BugReporter } from './BugReporter';
export { BugReportModal } from './BugReportModal';
export { RouteTracker, getBufferedLogs } from './RouteTracker';
export { AnnotationEditor } from './AnnotationEditor';

// Types
export type { BugReporterConfig, BugReporterUser, Severity, ReportType } from './types';
```

## Related

- **Server:** [viacoremedia/bug-reporter](https://github.com/viacoremedia/bug-reporter) — Express + MongoDB API deployed to Vercel
- **Widget:** [viacoremedia/bug-reporter-widget](https://github.com/viacoremedia/bug-reporter-widget) — This package
