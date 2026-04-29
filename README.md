# @viacoremedia/bug-reporter

Drop-in bug reporter & feature request widget for ViacoreMedia projects.

## Installation

```bash
npm install @viacoremedia/bug-reporter
```

## Usage

```tsx
import { BugReporter } from '@viacoremedia/bug-reporter';

// Minimal — just needs the system name
<BugReporter systemName="Map" />

// With user context
<BugReporter 
  systemName="Map" 
  user={{ name: "Josh", email: "josh@viacore.com", role: "admin" }} 
/>
```

## Features

- 🐛 Bug reports & 💡 Feature requests
- 📸 Native screenshot capture (getDisplayMedia) + html2canvas fallback
- ✏️ Full annotation editor (pen, arrow, rectangle, text)
- 📋 Auto-captures console logs, page URL, viewport, browser info
- 👤 Optional user identity attachment
- 🔄 Auto-registers system on first load

## Peer Dependencies

This package expects your project to have:
- React 18+
- react-router-dom 6+
- lucide-react
- html2canvas
- shadcn/ui components: Button, Input, Textarea, Label, RadioGroup, Slider, Popover

## Config

| Prop | Required | Default | Description |
|------|----------|---------|-------------|
| `systemName` | ✅ | — | Unique name for this system |
| `user` | ❌ | `null` | User context to attach to reports |
| `apiUrl` | ❌ | `https://bug-reporter-tau.vercel.app` | Bug reporter API URL |
| `contact` | ❌ | `joshua@viacoremedia.com` | Contact email for registration |
