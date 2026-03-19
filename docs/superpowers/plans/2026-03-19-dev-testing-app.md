# Dev Testing App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable React testing app at `apps/testing/` that lets testers configure their hardware setup, then track pass/fail/skip results per test, per device, per orientation.

**Architecture:** Vite + React + Tailwind single-page app with 3 screens (Setup → Execution → Results). YAML test plan loaded at runtime defines all tests. localStorage persists session state. No backend required.

**Tech Stack:** Vite 6, React 19, TypeScript, Tailwind CSS 4, js-yaml

**Spec:** `docs/superpowers/specs/2026-03-19-dev-testing-app-design.md`
**Hardware test plan:** `docs/superpowers/specs/2026-03-19-hardware-testing-plan-design.md`

---

## File Map

```
apps/testing/
├── public/
│   └── test-plan.yaml              # Complete test plan (all phases, all tests)
├── src/
│   ├── main.tsx                     # React entry point
│   ├── App.tsx                      # Screen router (setup → execution → results)
│   ├── types.ts                     # All TypeScript interfaces
│   ├── utils.ts                     # Export helpers, readiness verdict, key builders
│   ├── components/
│   │   ├── SetupWizard.tsx          # Screen 1: device/integration selection form
│   │   ├── TestExecution.tsx        # Screen 2: main testing interface
│   │   ├── ResultsSummary.tsx       # Screen 3: verdict + breakdown + export
│   │   ├── DeviceTabs.tsx           # Configuration tab bar with progress badges
│   │   ├── PriorityTabs.tsx         # Phase/priority tab bar
│   │   ├── TestRow.tsx              # Single test with status buttons + notes
│   │   ├── StatusButton.tsx         # Clickable status cycle button
│   │   └── ProgressBar.tsx          # Colored progress bar
│   └── hooks/
│       ├── useTestPlan.ts           # Fetch + parse YAML, filter by selection
│       └── useSession.ts            # localStorage CRUD with debounced auto-save
├── index.html                       # HTML entry
├── package.json                     # Package config
├── vite.config.ts                   # Vite config
├── postcss.config.js                # PostCSS for Tailwind
└── tsconfig.json                    # TypeScript config
```

---

### Task 1: Scaffold Vite + React + Tailwind Project

**Files:**
- Create: `apps/testing/package.json`
- Create: `apps/testing/vite.config.ts`
- Create: `apps/testing/tsconfig.json`
- Create: `apps/testing/postcss.config.js`
- Create: `apps/testing/index.html`
- Create: `apps/testing/src/main.tsx`
- Create: `apps/testing/src/App.tsx`
- Modify: `package.json` (root — add `testing:dev` and `testing:build` scripts)

- [ ] **Step 1: Create `apps/testing/package.json`**

```json
{
  "name": "@fastybird/smart-panel-testing",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.0",
    "@types/js-yaml": "^4.0.9",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.5.0",
    "tailwindcss": "^4.1.0",
    "postcss": "^8.5.0",
    "typescript": "^5.8.0",
    "vite": "^6.3.0"
  },
  "engines": {
    "node": ">=24"
  }
}
```

- [ ] **Step 2: Create `apps/testing/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 3: Create `apps/testing/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `apps/testing/postcss.config.js`**

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 5: Create `apps/testing/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Smart Panel — Dev Testing</title>
  </head>
  <body class="bg-panel-bg text-panel-text min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `apps/testing/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Create `apps/testing/src/index.css`**

Tailwind v4 uses CSS-based theme configuration via `@theme` directive. No `tailwind.config.ts` needed.

```css
@import 'tailwindcss';

@theme {
  --color-panel-bg: #0f172a;
  --color-panel-surface: #1e293b;
  --color-panel-border: #334155;
  --color-panel-text: #e2e8f0;
  --color-panel-muted: #94a3b8;
  --color-panel-dim: #64748b;
  --color-panel-subtle: #475569;

  --color-status-pass: #22c55e;
  --color-status-pass-bg: #14532d;
  --color-status-fail: #ef4444;
  --color-status-fail-bg: #450a0a;
  --color-status-skip: #f59e0b;
  --color-status-skip-bg: #78350f;

  --font-mono: 'SF Mono', Monaco, Consolas, monospace;
}
```

- [ ] **Step 8: Create placeholder `apps/testing/src/App.tsx`**

```tsx
export default function App() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-2xl font-mono text-blue-400">Smart Panel Testing</h1>
    </div>
  );
}
```

- [ ] **Step 9: Add root scripts to `package.json`**

Add to the root `package.json` `scripts` object:
```json
"testing:dev": "pnpm --filter @fastybird/smart-panel-testing dev",
"testing:build": "pnpm --filter @fastybird/smart-panel-testing build"
```

- [ ] **Step 10: Install dependencies and verify**

Run: `cd apps/testing && pnpm install`
Then: `pnpm run testing:dev`
Expected: Vite dev server starts, browser shows "Smart Panel Testing" on dark background.

- [ ] **Step 11: Commit**

```bash
git add apps/testing/ package.json pnpm-lock.yaml
git commit -m "feat(testing): scaffold Vite + React + Tailwind testing app"
```

---

### Task 2: Types and Data Model

**Files:**
- Create: `apps/testing/src/types.ts`

- [ ] **Step 1: Create `apps/testing/src/types.ts`**

```typescript
// ── YAML Test Plan types ──

export interface TestPlanYaml {
  version: number;
  devices: DeviceDefinition[];
  integrations: IntegrationDefinition[];
  phases: PhaseDefinition[];
}

export interface DeviceDefinition {
  id: string;
  name: string;
  roles: Role[];
  display: DisplayInfo | null;
}

export interface DisplayInfo {
  resolution: string;
  size: string;
  ppi: number;
}

export interface IntegrationDefinition {
  id: string;
  name: string;
}

export interface PhaseDefinition {
  id: string;
  name: string;
  tests: TestDefinition[];
}

export interface TestDefinition {
  id: string;
  name: string;
  criteria: string;
  roles: Role[];
  orientations: boolean;
  requires?: string[];
}

export type Role = 'backend' | 'panel' | 'all-in-one';

// ── Session types ──

export interface DeviceConfiguration {
  id: string;       // e.g., "rpi-zero-2--panel"
  deviceId: string;
  role: Role;
}

export interface TestSession {
  id: string;
  version: string;
  tester: string;
  startedAt: string;
  testPlanVersion: number;
  configurations: DeviceConfiguration[];
  integrations: string[];
  results: Record<string, TestResult>;
}

export interface TestResult {
  status: Status;
  notes: string;
  updatedAt: string;
}

export type Status = 'pending' | 'pass' | 'fail' | 'skip';

export type Orientation = 'landscape' | 'portrait' | 'single';

// ── UI state types ──

export type Screen = 'setup' | 'execution' | 'results';

export interface ReadinessVerdict {
  ready: boolean;
  reasons: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/testing/src/types.ts
git commit -m "feat(testing): add TypeScript type definitions"
```

---

### Task 3: Complete YAML Test Plan

**Files:**
- Create: `apps/testing/public/test-plan.yaml`

This file contains ALL tests from both the hardware testing plan spec and the dev testing app spec. It is the single source of truth.

- [ ] **Step 1: Create `apps/testing/public/test-plan.yaml`**

Build the complete YAML file by transcribing every test from `docs/superpowers/specs/2026-03-19-hardware-testing-plan-design.md`. Include all phases (smoke, p0, p1, p2, p3, p4) with every test, its criteria, roles, orientations flag, and requires field where applicable.

The smoke phase tests should be the role-generic versions from the dev testing app spec (smoke.1–smoke.9).

For phases p0–p4, transcribe directly from the hardware testing plan tables:
- P0: tests p0.1–p0.10
- P1: tests p1.1–p1.16
- P2: tests p2.1–p2.18
- P3: tests p3.1–p3.9
- P4: tests p4.1–p4.12

Set `requires` on P4 tests that need integrations:
- p4.2: `[shelly]`
- p4.3: `[zigbee2mqtt]`
- p4.4: `[wled]`
- p4.5: `[home-assistant]`
- p4.6: `[openai]`
- p4.7: `[openai, elevenlabs]`
- p4.8: `[anthropic]`

Set `roles` based on what the test applies to (most P0-P3 tests are `[panel, all-in-one]`, backend-specific tests like smoke.5-smoke.8 are `[backend]` or `[backend, all-in-one]`).

Set `orientations: true` for all P1 tests (visual quality) and p0.1. All other tests get `orientations: false`.

- [ ] **Step 2: Verify YAML parses correctly**

Run: `node -e "const yaml = require('js-yaml'); const fs = require('fs'); const d = yaml.load(fs.readFileSync('apps/testing/public/test-plan.yaml','utf8')); console.log(d.phases.map(p => p.id + ': ' + p.tests.length + ' tests').join('\n'));"`

Expected output showing test counts per phase.

- [ ] **Step 3: Commit**

```bash
git add apps/testing/public/test-plan.yaml
git commit -m "feat(testing): add complete YAML test plan with all phases"
```

---

### Task 4: Utility Functions

**Files:**
- Create: `apps/testing/src/utils.ts`

- [ ] **Step 1: Create `apps/testing/src/utils.ts`**

```typescript
import type {
  DeviceConfiguration,
  Orientation,
  PhaseDefinition,
  ReadinessVerdict,
  Status,
  TestDefinition,
  TestSession,
} from './types';

// ── Result key builders ──

export function buildResultKey(
  configId: string,
  testId: string,
  orientation: Orientation,
): string {
  return `${configId}::${testId}::${orientation}`;
}

export function buildConfigId(deviceId: string, role: string): string {
  return `${deviceId}--${role}`;
}

// ── Status cycle ──

const STATUS_CYCLE: Status[] = ['pending', 'pass', 'fail', 'skip'];

export function nextStatus(current: Status): Status {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

// ── Filtering ──

export function getTestsForConfig(
  phase: PhaseDefinition,
  config: DeviceConfiguration,
  selectedIntegrations: string[],
): TestDefinition[] {
  return phase.tests.filter((test) => {
    if (!test.roles.includes(config.role)) return false;
    if (test.requires && !test.requires.every((r) => selectedIntegrations.includes(r)))
      return false;
    return true;
  });
}

// ── Counting ──

export function countResults(
  results: Record<string, { status: Status }>,
  filterPrefix?: string,
): { total: number; pass: number; fail: number; skip: number; pending: number } {
  const entries = filterPrefix
    ? Object.entries(results).filter(([k]) => k.startsWith(filterPrefix + '::'))
    : Object.entries(results);

  const counts = { total: 0, pass: 0, fail: 0, skip: 0, pending: 0 };
  for (const [, r] of entries) {
    counts.total++;
    counts[r.status]++;
  }
  return counts;
}

// ── Readiness verdict ──

export function computeReadiness(
  session: TestSession,
  phases: PhaseDefinition[],
): ReadinessVerdict {
  const reasons: string[] = [];

  const getPhaseResults = (phaseId: string) =>
    Object.entries(session.results).filter(([k]) => {
      const testId = k.split('::')[1];
      return testId.startsWith(phaseId + '.');
    });

  // Smoke: all must pass (blocker if any fail)
  const smokeResults = getPhaseResults('smoke');
  const smokeFailures = smokeResults.filter(([, r]) => r.status === 'fail');
  if (smokeFailures.length > 0) {
    reasons.push(`${smokeFailures.length} smoke test(s) failed — must all pass before Phase 2`);
  }

  // P0: all must pass on all configs
  const p0Results = getPhaseResults('p0');
  const p0Failures = p0Results.filter(([, r]) => r.status === 'fail');
  if (p0Failures.length > 0) {
    reasons.push(`${p0Failures.length} P0 test(s) failed — must all pass`);
  }
  const p0Pending = p0Results.filter(([, r]) => r.status === 'pending');
  if (p0Pending.length > 0) {
    reasons.push(`${p0Pending.length} P0 test(s) still pending`);
  }

  // P1: all must pass
  const p1Results = getPhaseResults('p1');
  const p1Failures = p1Results.filter(([, r]) => r.status === 'fail');
  if (p1Failures.length > 0) {
    reasons.push(`${p1Failures.length} P1 visual test(s) failed`);
  }

  // P2: must pass on at least one config (except p2.10 which passes on any)
  const p2Phase = phases.find((p) => p.id === 'p2');
  if (p2Phase) {
    for (const test of p2Phase.tests) {
      const testResults = Object.entries(session.results).filter(([k]) =>
        k.split('::')[1] === test.id,
      );
      if (testResults.length === 0) continue;
      const hasPass = testResults.some(([, r]) => r.status === 'pass');
      if (!hasPass) {
        const allSkipped = testResults.every(
          ([, r]) => r.status === 'skip' || r.status === 'pending',
        );
        if (!allSkipped) {
          reasons.push(`${test.id} (${test.name}) failed on all tested configs`);
        }
      }
    }
  }

  // P3: no blocker (fail on soak or memory)
  const p3Results = getPhaseResults('p3');
  const p3Blockers = p3Results.filter(
    ([k, r]) => r.status === 'fail' && (k.includes('p3.3') || k.includes('p3.9')),
  );
  if (p3Blockers.length > 0) {
    reasons.push(`P3 blocker: memory leak or soak test failure`);
  }

  return { ready: reasons.length === 0, reasons };
}

// ── Export ──

export function exportAsJson(session: TestSession): void {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-results-${session.version}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsMarkdown(
  session: TestSession,
  phases: PhaseDefinition[],
): void {
  const verdict = computeReadiness(session, phases);
  const date = new Date().toISOString().slice(0, 10);

  let md = `# Release Testing Report — ${session.version}\n`;
  md += `**Tester:** ${session.tester} | **Date:** ${date} | **Verdict:** ${verdict.ready ? 'READY' : 'NOT READY'}\n\n`;

  // Summary table
  md += `## Summary\n`;
  md += `| Config | Pass | Fail | Skip | Pending |\n`;
  md += `|--------|------|------|------|--------|\n`;
  for (const config of session.configurations) {
    const counts = countResults(session.results, config.id);
    md += `| ${config.id} | ${counts.pass} | ${counts.fail} | ${counts.skip} | ${counts.pending} |\n`;
  }

  // Blockers
  const failures = Object.entries(session.results).filter(
    ([k, r]) => r.status === 'fail' && (k.includes('::p0.') || k.includes('::p1.')),
  );
  if (failures.length > 0) {
    md += `\n## Blockers\n`;
    for (const [key, result] of failures) {
      const [configId, testId, orientation] = key.split('::');
      const orientLabel = orientation === 'single' ? '' : `, ${orientation}`;
      const note = result.notes ? `: ${result.notes}` : '';
      md += `- **${testId}** (${configId}${orientLabel})${note}\n`;
    }
  }

  // Known limitations (P4 failures + skips)
  const limitations = Object.entries(session.results).filter(
    ([k, r]) =>
      (r.status === 'fail' || r.status === 'skip') && k.includes('::p4.'),
  );
  if (limitations.length > 0) {
    md += `\n## Known Limitations\n`;
    for (const [key, result] of limitations) {
      const testId = key.split('::')[1];
      const note = result.notes ? `: ${result.notes}` : '';
      md += `- ${testId}${note}\n`;
    }
  }

  if (!verdict.ready) {
    md += `\n## Release Blockers\n`;
    for (const reason of verdict.reasons) {
      md += `- ${reason}\n`;
    }
  }

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-report-${session.version}-${date}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/testing/src/utils.ts
git commit -m "feat(testing): add utility functions for status cycle, filtering, export"
```

---

### Task 5: useTestPlan Hook

**Files:**
- Create: `apps/testing/src/hooks/useTestPlan.ts`

- [ ] **Step 1: Create `apps/testing/src/hooks/useTestPlan.ts`**

```typescript
import { useEffect, useState } from 'react';
import yaml from 'js-yaml';
import type { TestPlanYaml } from '../types';

interface UseTestPlanResult {
  testPlan: TestPlanYaml | null;
  loading: boolean;
  error: string | null;
}

export function useTestPlan(): UseTestPlanResult {
  const [testPlan, setTestPlan] = useState<TestPlanYaml | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/test-plan.yaml')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load test plan: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const parsed = yaml.load(text) as TestPlanYaml;
        if (!parsed.version || !parsed.phases) {
          throw new Error('Invalid test plan: missing version or phases');
        }
        setTestPlan(parsed);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { testPlan, loading, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/testing/src/hooks/useTestPlan.ts
git commit -m "feat(testing): add useTestPlan hook for YAML loading"
```

---

### Task 6: useSession Hook

**Files:**
- Create: `apps/testing/src/hooks/useSession.ts`

- [ ] **Step 1: Create `apps/testing/src/hooks/useSession.ts`**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Orientation, Status, TestSession } from '../types';
import { buildResultKey } from '../utils';

const STORAGE_KEY = 'smart-panel-test-session';
const DEBOUNCE_MS = 500;

export function useSession() {
  // Synchronous init from localStorage — avoids race condition with useEffect
  const [session, setSession] = useState<TestSession | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
    }
    return null;
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref to current session for the beforeunload handler
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Debounced save
  const save = useCallback((updated: TestSession) => {
    setSession(updated);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }, DEBOUNCE_MS);
  }, []);

  // Flush on unload to prevent data loss from debounce window
  useEffect(() => {
    const flush = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        const current = sessionRef.current;
        if (current) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        }
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  const startSession = useCallback(
    (newSession: TestSession) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
    },
    [],
  );

  const updateResult = useCallback(
    (configId: string, testId: string, orientation: Orientation, status: Status) => {
      if (!session) return;
      const key = buildResultKey(configId, testId, orientation);
      const updated: TestSession = {
        ...session,
        results: {
          ...session.results,
          [key]: {
            status,
            notes: session.results[key]?.notes ?? '',
            updatedAt: new Date().toISOString(),
          },
        },
      };
      save(updated);
    },
    [session, save],
  );

  const updateNotes = useCallback(
    (configId: string, testId: string, orientation: Orientation, notes: string) => {
      if (!session) return;
      const key = buildResultKey(configId, testId, orientation);
      const existing = session.results[key] ?? {
        status: 'pending' as const,
        notes: '',
        updatedAt: new Date().toISOString(),
      };
      const updated: TestSession = {
        ...session,
        results: {
          ...session.results,
          [key]: { ...existing, notes, updatedAt: new Date().toISOString() },
        },
      };
      save(updated);
    },
    [session, save],
  );

  const resetSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  return {
    session,
    hasExistingSession: session !== null,
    startSession,
    updateResult,
    updateNotes,
    resetSession,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/testing/src/hooks/useSession.ts
git commit -m "feat(testing): add useSession hook with debounced localStorage"
```

---

### Task 7: StatusButton and ProgressBar Components

**Files:**
- Create: `apps/testing/src/components/StatusButton.tsx`
- Create: `apps/testing/src/components/ProgressBar.tsx`

- [ ] **Step 1: Create `apps/testing/src/components/StatusButton.tsx`**

```tsx
import type { Status } from '../types';

const STATUS_DISPLAY: Record<Status, { label: string; className: string }> = {
  pending: {
    label: '—',
    className: 'bg-panel-surface text-panel-subtle border border-panel-border',
  },
  pass: { label: 'PASS', className: 'bg-status-pass-bg text-status-pass' },
  fail: { label: 'FAIL', className: 'bg-status-fail-bg text-status-fail' },
  skip: { label: 'SKIP', className: 'bg-status-skip-bg text-status-skip' },
};

interface StatusButtonProps {
  status: Status;
  onClick: () => void;
  label?: string;
}

export function StatusButton({ status, onClick, label }: StatusButtonProps) {
  const display = STATUS_DISPLAY[status];
  return (
    <div className="flex items-center gap-1">
      {label && <span className="text-[9px] text-panel-dim w-2.5">{label}</span>}
      <button
        onClick={onClick}
        className={`px-2 py-0.5 rounded text-[10px] font-mono min-w-[40px] text-center cursor-pointer ${display.className}`}
      >
        {display.label}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/testing/src/components/ProgressBar.tsx`**

```tsx
interface ProgressBarProps {
  pass: number;
  fail: number;
  skip: number;
  total: number;
  label?: string;
}

export function ProgressBar({ pass, fail, skip, total, label }: ProgressBarProps) {
  const done = pass + fail + skip;
  const pctPass = total > 0 ? (pass / total) * 100 : 0;
  const pctFail = total > 0 ? (fail / total) * 100 : 0;
  const pctSkip = total > 0 ? (skip / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-[11px] text-panel-dim">{label}</span>}
      <div className="flex-1 bg-panel-border rounded h-1">
        <div className="flex h-1 rounded overflow-hidden">
          {pctPass > 0 && (
            <div className="bg-status-pass" style={{ width: `${pctPass}%` }} />
          )}
          {pctFail > 0 && (
            <div className="bg-status-fail" style={{ width: `${pctFail}%` }} />
          )}
          {pctSkip > 0 && (
            <div className="bg-status-skip" style={{ width: `${pctSkip}%` }} />
          )}
        </div>
      </div>
      <span className="text-[11px] text-panel-dim">
        {done}/{total}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/testing/src/components/StatusButton.tsx apps/testing/src/components/ProgressBar.tsx
git commit -m "feat(testing): add StatusButton and ProgressBar components"
```

---

### Task 8: TestRow Component

**Files:**
- Create: `apps/testing/src/components/TestRow.tsx`

- [ ] **Step 1: Create `apps/testing/src/components/TestRow.tsx`**

```tsx
import { useState } from 'react';
import type { Orientation, Status } from '../types';
import { nextStatus } from '../utils';
import { StatusButton } from './StatusButton';

interface TestRowProps {
  testId: string;
  name: string;
  criteria: string;
  orientations: boolean;
  results: Record<Orientation, { status: Status; notes: string }>;
  onStatusChange: (orientation: Orientation, status: Status) => void;
  onNotesChange: (orientation: Orientation, notes: string) => void;
}

export function TestRow({
  testId,
  name,
  criteria,
  orientations,
  results,
  onStatusChange,
  onNotesChange,
}: TestRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const hasFailure = orientations
    ? results.landscape.status === 'fail' || results.portrait.status === 'fail'
    : results.single.status === 'fail';

  const hasNotes = orientations
    ? results.landscape.notes || results.portrait.notes
    : results.single.notes;

  const shouldShowNotes = showNotes || hasFailure;

  return (
    <div className="border-b border-panel-surface">
      <div className="flex items-center py-1.5 gap-2">
        <span className="text-panel-subtle w-[42px] text-[11px] font-mono">{testId}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left text-[12px] text-panel-muted hover:text-panel-text cursor-pointer truncate"
          title={criteria}
        >
          {name} {expanded ? '▲' : '▼'}
        </button>

        {orientations ? (
          <>
            <StatusButton
              label="L"
              status={results.landscape.status}
              onClick={() =>
                onStatusChange('landscape', nextStatus(results.landscape.status))
              }
            />
            <StatusButton
              label="P"
              status={results.portrait.status}
              onClick={() =>
                onStatusChange('portrait', nextStatus(results.portrait.status))
              }
            />
          </>
        ) : (
          <StatusButton
            status={results.single.status}
            onClick={() =>
              onStatusChange('single', nextStatus(results.single.status))
            }
          />
        )}

        <button
          onClick={() => setShowNotes(!showNotes)}
          className={`w-4 text-center text-[10px] cursor-pointer ${hasNotes ? 'text-status-skip' : 'text-panel-border'}`}
          title={hasNotes ? 'Has notes' : 'Add note'}
        >
          ✎
        </button>
      </div>

      {expanded && (
        <div className="pl-[50px] pb-2 text-[11px] text-panel-dim border-l-2 border-panel-border ml-[18px]">
          Pass criteria: {criteria}
        </div>
      )}

      {shouldShowNotes && (
        <div className="pl-[50px] pb-2">
          {orientations ? (
            <div className="space-y-1">
              {results.landscape.status === 'fail' || showNotes ? (
                <input
                  type="text"
                  placeholder="Landscape notes..."
                  value={results.landscape.notes}
                  onChange={(e) => onNotesChange('landscape', e.target.value)}
                  className="w-full bg-panel-bg border border-panel-border rounded px-2 py-1 text-[11px] text-status-skip placeholder:text-panel-subtle"
                />
              ) : null}
              {results.portrait.status === 'fail' || showNotes ? (
                <input
                  type="text"
                  placeholder="Portrait notes..."
                  value={results.portrait.notes}
                  onChange={(e) => onNotesChange('portrait', e.target.value)}
                  className="w-full bg-panel-bg border border-panel-border rounded px-2 py-1 text-[11px] text-status-skip placeholder:text-panel-subtle"
                />
              ) : null}
            </div>
          ) : (
            <input
              type="text"
              placeholder="Notes..."
              value={results.single.notes}
              onChange={(e) => onNotesChange('single', e.target.value)}
              className="w-full bg-panel-bg border border-panel-border rounded px-2 py-1 text-[11px] text-status-skip placeholder:text-panel-subtle"
            />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/testing/src/components/TestRow.tsx
git commit -m "feat(testing): add TestRow component with status buttons and notes"
```

---

### Task 9: DeviceTabs and PriorityTabs Components

**Files:**
- Create: `apps/testing/src/components/DeviceTabs.tsx`
- Create: `apps/testing/src/components/PriorityTabs.tsx`

- [ ] **Step 1: Create `apps/testing/src/components/DeviceTabs.tsx`**

```tsx
import type { DeviceConfiguration } from '../types';

interface DeviceTabsProps {
  configurations: DeviceConfiguration[];
  activeConfigId: string;
  onSelect: (configId: string) => void;
  getProgress: (configId: string) => { done: number; total: number };
}

export function DeviceTabs({
  configurations,
  activeConfigId,
  onSelect,
  getProgress,
}: DeviceTabsProps) {
  return (
    <div className="flex gap-0 border-b border-panel-border px-4 bg-panel-surface overflow-x-auto">
      {configurations.map((config) => {
        const isActive = config.id === activeConfigId;
        const progress = getProgress(config.id);
        const allDone = progress.done === progress.total && progress.total > 0;
        return (
          <button
            key={config.id}
            onClick={() => onSelect(config.id)}
            className={`px-4 py-2 text-[12px] cursor-pointer whitespace-nowrap ${
              isActive
                ? 'text-panel-text border-b-2 border-blue-500'
                : 'text-panel-dim hover:text-panel-muted'
            }`}
          >
            {config.id.replace('--', ' — ')}
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                allDone
                  ? 'bg-status-pass-bg text-status-pass'
                  : 'bg-panel-surface text-panel-dim'
              }`}
            >
              {progress.done}/{progress.total}
              {allDone ? ' ✓' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/testing/src/components/PriorityTabs.tsx`**

```tsx
interface PriorityTabsProps {
  phases: Array<{ id: string; name: string }>;
  activePhaseId: string;
  onSelect: (phaseId: string) => void;
  getTestCount: (phaseId: string) => number;
}

export function PriorityTabs({
  phases,
  activePhaseId,
  onSelect,
  getTestCount,
}: PriorityTabsProps) {
  return (
    <div className="flex gap-0 border-b border-panel-border px-4 bg-panel-bg">
      {phases.map((phase) => {
        const isActive = phase.id === activePhaseId;
        const count = getTestCount(phase.id);
        const shortName = phase.name.split('—')[1]?.trim() ?? phase.name;
        return (
          <button
            key={phase.id}
            onClick={() => onSelect(phase.id)}
            disabled={count === 0}
            className={`px-3 py-1.5 text-[11px] cursor-pointer ${
              isActive
                ? 'text-panel-text border-b-2 border-amber-500 font-semibold'
                : count === 0
                  ? 'text-panel-border cursor-not-allowed'
                  : 'text-panel-dim hover:text-panel-muted'
            }`}
          >
            {shortName}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/testing/src/components/DeviceTabs.tsx apps/testing/src/components/PriorityTabs.tsx
git commit -m "feat(testing): add DeviceTabs and PriorityTabs components"
```

---

### Task 10: SetupWizard Screen

**Files:**
- Create: `apps/testing/src/components/SetupWizard.tsx`

- [ ] **Step 1: Create `apps/testing/src/components/SetupWizard.tsx`**

This is the largest single component. It renders:
- Release version and tester name text inputs
- Device checkboxes with role selectors (constrained by device's allowed roles)
- Integration checkboxes
- A "Start Testing" button (disabled until form is valid: version + tester + at least one config)

When "Start Testing" is clicked:
1. Build `configurations` array from selected devices + roles using `buildConfigId()`
2. Build `integrations` array from selected integration IDs
3. Initialize `results` map: for each config × each applicable test × each orientation, create a `pending` entry
4. Create a `TestSession` with a UUID (`crypto.randomUUID()`), current ISO timestamp, and the YAML's `version` field
5. Call `startSession()` from useSession
6. Navigate to execution screen

The component receives `testPlan` and `onStart` as props.

- [ ] **Step 2: Commit**

```bash
git add apps/testing/src/components/SetupWizard.tsx
git commit -m "feat(testing): add SetupWizard screen with device and integration selection"
```

---

### Task 11: TestExecution Screen

**Files:**
- Create: `apps/testing/src/components/TestExecution.tsx`

- [ ] **Step 1: Create `apps/testing/src/components/TestExecution.tsx`**

This screen composes DeviceTabs, PriorityTabs, TestRow, and ProgressBar.

State:
- `activeConfigId`: string (first config by default)
- `activePhaseId`: string (`'smoke'` by default)

The component:
1. Renders the top bar with session info and global counts
2. Renders DeviceTabs for switching between configurations
3. Renders PriorityTabs for switching between phases
4. Filters tests using `getTestsForConfig()` for the active config + phase
5. For each test, renders a TestRow with the results from the session
6. If no tests match, shows "No tests applicable for this configuration"
7. Renders ProgressBar at the bottom for the current phase

Props: `session`, `testPlan`, `updateResult`, `updateNotes`, `onViewResults`, `onExportJson`, `onExportMarkdown`

- [ ] **Step 2: Commit**

```bash
git add apps/testing/src/components/TestExecution.tsx
git commit -m "feat(testing): add TestExecution screen with device and priority tabs"
```

---

### Task 12: ResultsSummary Screen

**Files:**
- Create: `apps/testing/src/components/ResultsSummary.tsx`

- [ ] **Step 1: Create `apps/testing/src/components/ResultsSummary.tsx`**

This screen shows:
1. Release readiness verdict banner (READY green / NOT READY red) using `computeReadiness()`
2. Per-configuration summary table using `countResults()` with config prefix filter
3. Blocker list: P0 and P1 failures with config, test ID, orientation, notes
4. Export JSON button calling `exportAsJson()`
5. Export Markdown button calling `exportAsMarkdown()`
6. Reset button with `window.confirm()` dialog, then `resetSession()`
7. "Back to Testing" button to return to execution screen

Props: `session`, `testPlan`, `onBack`, `onReset`

- [ ] **Step 2: Commit**

```bash
git add apps/testing/src/components/ResultsSummary.tsx
git commit -m "feat(testing): add ResultsSummary screen with verdict and export"
```

---

### Task 13: App Router and Integration

**Files:**
- Modify: `apps/testing/src/App.tsx`

- [ ] **Step 1: Update `apps/testing/src/App.tsx`**

```tsx
import { useState } from 'react';
import type { Screen } from './types';
import { useTestPlan } from './hooks/useTestPlan';
import { useSession } from './hooks/useSession';
import { SetupWizard } from './components/SetupWizard';
import { TestExecution } from './components/TestExecution';
import { ResultsSummary } from './components/ResultsSummary';
import { exportAsJson, exportAsMarkdown } from './utils';

export default function App() {
  const { testPlan, loading, error } = useTestPlan();
  const {
    session,
    hasExistingSession,
    startSession,
    updateResult,
    updateNotes,
    resetSession,
  } = useSession();

  const [screen, setScreen] = useState<Screen>(
    hasExistingSession ? 'execution' : 'setup',
  );

  // Handle resume prompt
  const [showResume, setShowResume] = useState(hasExistingSession);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-panel-muted font-mono">Loading test plan...</span>
      </div>
    );
  }

  if (error || !testPlan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-status-fail text-xl font-mono mb-2">
            Failed to load test plan
          </h1>
          <p className="text-panel-dim text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Resume dialog
  if (showResume && session) {
    const versionMismatch = session.testPlanVersion !== testPlan.version;
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-panel-surface border border-panel-border rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-mono text-panel-text mb-2">
            Existing session found
          </h2>
          <p className="text-panel-muted text-sm mb-1">
            {session.version} — started{' '}
            {new Date(session.startedAt).toLocaleDateString()}
          </p>
          <p className="text-panel-muted text-sm mb-4">
            Tester: {session.tester}
          </p>
          {versionMismatch && (
            <p className="text-status-skip text-xs mb-4">
              ⚠ Test plan has been updated since this session was saved. Some
              results may not match current tests.
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowResume(false);
                setScreen('execution');
              }}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm cursor-pointer hover:bg-blue-500"
            >
              Resume
            </button>
            <button
              onClick={() => {
                resetSession();
                setShowResume(false);
                setScreen('setup');
              }}
              className="flex-1 bg-panel-border text-panel-muted px-4 py-2 rounded text-sm cursor-pointer hover:bg-panel-subtle"
            >
              Start Fresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'setup') {
    return (
      <SetupWizard
        testPlan={testPlan}
        onStart={(newSession) => {
          startSession(newSession);
          setScreen('execution');
        }}
      />
    );
  }

  if (!session) {
    setScreen('setup');
    return null;
  }

  if (screen === 'results') {
    return (
      <ResultsSummary
        session={session}
        testPlan={testPlan}
        onBack={() => setScreen('execution')}
        onReset={() => {
          if (
            window.confirm(
              'This will permanently delete all test results for this session. Export first if needed.',
            )
          ) {
            resetSession();
            setScreen('setup');
          }
        }}
      />
    );
  }

  return (
    <TestExecution
      session={session}
      testPlan={testPlan}
      updateResult={updateResult}
      updateNotes={updateNotes}
      onViewResults={() => setScreen('results')}
      onExportJson={() => exportAsJson(session)}
      onExportMarkdown={() => exportAsMarkdown(session, testPlan.phases)}
    />
  );
}
```

- [ ] **Step 2: Verify the full app works**

Run: `pnpm run testing:dev`
Expected: App loads, shows setup wizard (or resume dialog if session exists), can complete the full flow: setup → execution → results → export.

- [ ] **Step 3: Commit**

```bash
git add apps/testing/src/App.tsx
git commit -m "feat(testing): wire up App router with resume dialog and all screens"
```

---

### Task 14: End-to-End Smoke Test

- [ ] **Step 1: Manual smoke test**

1. Run `pnpm run testing:dev`
2. Fill in setup: version "v1.0.0-test", tester "Dev", select RPi 5 (backend) + Android 8" (panel)
3. Select Shelly and OpenAI integrations
4. Click "Start Testing"
5. Verify device tabs show both configs
6. Navigate through priority tabs — verify tests are filtered correctly
7. Click status buttons — verify they cycle through states
8. Mark one test as FAIL — verify notes input auto-opens
9. Type a note — verify it persists
10. Click "Results" — verify verdict, breakdown table, blockers
11. Export JSON — verify file downloads with correct data
12. Export Markdown — verify file downloads with formatted report
13. Refresh the page — verify resume dialog appears
14. Click Resume — verify all results are preserved
15. Click Reset — verify confirmation dialog, then clean start

- [ ] **Step 2: Fix any issues found during smoke test**

- [ ] **Step 3: Final commit**

```bash
git add -A apps/testing/
git commit -m "feat(testing): complete dev testing app v1"
```
