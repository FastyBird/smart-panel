# Dev Testing App — Design Spec

## Overview

A reusable, lightweight React web app for hardware testing the Smart Panel before each major release. Testers configure their available devices and integrations upfront, then work through a customized test matrix with pass/fail/skip tracking per test, per device, per orientation.

## Goals

- **Reusable**: Run before every major release, not a one-off tool
- **Customizable**: Testers select their devices and integrations; irrelevant tests are hidden
- **Zero infrastructure**: Runs locally in a browser, no backend required
- **Trackable**: Progress persists across sessions, results exportable

## Tech Stack

| Aspect | Choice |
|--------|--------|
| Location | `apps/testing/` in the monorepo |
| Framework | Vite + React + TypeScript |
| Styling | Tailwind CSS |
| Theme | Dark terminal style |
| Test data | YAML config file (`test-plan.yaml`) |
| Persistence | Browser localStorage |
| Export | JSON and Markdown |

## App Flow

Three screens in a linear flow:

```
Setup Wizard → Test Execution → Results Summary
```

### Screen 1 — Setup Wizard

A short form to configure the test session:

1. **Release version** — text input (e.g., `v1.0.0`)
2. **Tester name** — text input
3. **Device selection** — checkboxes from predefined device list
4. **Configuration per device** — for each selected device, pick roles (backend only, panel only, all-in-one). Options constrained by device capabilities.
5. **Integrations available** — checkboxes: Home Assistant, Shelly, Zigbee2MQTT, WLED, OpenAI, Anthropic, ElevenLabs

Hitting "Start Testing" generates the customized test matrix and navigates to the execution screen.

### Screen 2 — Test Execution

The main working screen. Dark terminal aesthetic with:

**Top bar**: Release version, tester name, global progress counters (pass/fail/skip/pending), Results and Export buttons.

**Device tabs**: One tab per selected configuration (e.g., "C2: RPi Zero 2 — Panel Only") with per-device progress badge.

**Priority tabs** (below device tabs): Smoke | P0 | P1 | P2 | P3 | P4

**Test list**: Flat list of tests for the active device + priority. Each row shows:
- Test ID and description (click to expand pass criteria)
- **Landscape** status button: cycles `—` → `PASS` → `FAIL` → `SKIP` → `—`
- **Portrait** status button: same cycle (hidden for backend-only configs, hidden when test has `orientations: false`)
- **Notes** pencil icon: toggles inline text input. Auto-opens when status is set to FAIL.

Tests that don't apply (missing integration, wrong role) are auto-hidden.

**Bottom bar**: Progress bar for current priority section.

### Screen 3 — Results Summary

Accessible anytime via the "Results" button:

- **Release readiness verdict**: prominent READY (green) or NOT READY (red) banner based on the Definition of Release-Ready criteria
- **Per-device breakdown table**: total/pass/fail/skip/pending per configuration
- **Blocker list**: all P0 and P1 failures with device, test ID, orientation, and notes
- **Export JSON**: full session data for archiving or future tooling
- **Export Markdown**: human-readable summary for GitHub release issues, structured as:
  ```markdown
  # Release Testing Report — v1.0.0
  **Tester:** Adam | **Date:** 2026-03-19 | **Verdict:** NOT READY

  ## Summary
  | Config | Pass | Fail | Skip | Pending |
  |--------|------|------|------|---------|
  | C2: RPi Zero 2 — Panel | 35 | 3 | 2 | 2 |
  | ... |

  ## Blockers
  - **P0.2** (C2, portrait): Onboarding crashes on room select
  - ...

  ## Known Limitations
  - P4.7: Buddy voice not tested (no speaker on device)
  ```
- **Reset**: clears session (with confirmation dialog), returns to setup

## Release Readiness Criteria

Computed from results, matching the hardware testing plan spec:

- All P0 tests pass on all configurations
- All P1 tests pass (or documented as known limitations)
- All P2 tests pass on at least one panel + backend combination (P2.10 multi-panel requires two panels)
- No P3 blocker (memory leak, crash after soak)
- P4 failures acceptable as known limitations

## YAML Test Plan Structure

The test plan lives at `apps/testing/test-plan.yaml`. This is the single source of truth — the app reads it and generates the UI.

### Loading Strategy

The YAML file is fetched at runtime via `fetch('/test-plan.yaml')` (served as a static asset by Vite). This means changes to the test plan take effect on page reload without rebuilding the app. Vite's `public/` directory or a custom plugin can serve the file; the simplest approach is placing `test-plan.yaml` in `public/` and fetching it in `useTestPlan.ts`.

```yaml
version: 1                        # Schema version — increment when structure changes

devices:
  - id: rpi5
    name: "Raspberry Pi 5"
    roles: [backend]
    display: null

  - id: rpi-zero-2
    name: "RPi Zero 2W + Waveshare 7\""
    roles: [panel, all-in-one]
    display:
      resolution: "1024x600"
      size: "7\""
      ppi: 170

  - id: android-8
    name: "Android 8\" Display"
    roles: [panel]
    display:
      resolution: "1280x800"
      size: "8\""
      ppi: 189

  - id: reterminal
    name: "Seeed reTerminal CM4"
    roles: [panel, all-in-one]
    display:
      resolution: "1280x720"
      size: "5\""
      ppi: 294

integrations:
  - id: home-assistant
    name: "Home Assistant"
  - id: shelly
    name: "Shelly (Gen1/Gen2+)"
  - id: zigbee2mqtt
    name: "Zigbee2MQTT"
  - id: wled
    name: "WLED"
  - id: openai
    name: "OpenAI API"
  - id: anthropic
    name: "Anthropic API"
  - id: elevenlabs
    name: "ElevenLabs"

phases:
  - id: smoke
    name: "Phase 1 — Smoke Tests"
    tests:
      - id: smoke.1
        name: "App launches"
        criteria: "App launches on display, no crash"
        roles: [panel, all-in-one]
        orientations: false
      - id: smoke.2
        name: "mDNS discovery"
        criteria: "App finds backend, shows in gateway list"
        roles: [panel]
        orientations: false
      - id: smoke.3
        name: "Connect and pair"
        criteria: "Selects backend, picks a room, reaches dashboard"
        roles: [panel, all-in-one]
        orientations: false
      - id: smoke.4
        name: "Touch input"
        criteria: "Tap on tiles/navigation responds correctly"
        roles: [panel, all-in-one]
        orientations: false
      - id: smoke.5
        name: "Backend service running"
        criteria: "systemctl status smart-panel-backend shows active"
        roles: [backend, all-in-one]
        orientations: false
      - id: smoke.6
        name: "Backend health endpoint"
        criteria: "GET /api/system/health returns 200"
        roles: [backend, all-in-one]
        orientations: false
      - id: smoke.7
        name: "Admin UI loads"
        criteria: "Browser on LAN opens admin, login page renders"
        roles: [backend, all-in-one]
        orientations: false
      - id: smoke.8
        name: "mDNS advertised"
        criteria: "Panel device can discover backend via mDNS"
        roles: [backend]
        orientations: false
      - id: smoke.9
        name: "Memory check"
        criteria: "swap < 100MB, no active swap thrashing in vmstat 1 5"
        roles: [all-in-one]
        orientations: false
      # Smoke tests use role-based filtering (not device-specific).
      # Per-configuration tests from the hardware plan (1.1-6.5)
      # are mapped to role-generic equivalents above.

  - id: p0
    name: "P0 — Must Work"
    tests:
      - id: p0.1
        name: "Cold boot to dashboard"
        criteria: "App reaches dashboard within 60 seconds"
        roles: [panel, all-in-one]
        orientations: true
      # ...

  - id: p1
    name: "P1 — Visual Quality"
    tests:
      - id: p1.1
        name: "Card grid layout"
        criteria: "Cards fill screen properly, no overflow, no clipping"
        roles: [panel, all-in-one]
        orientations: true
      # ...

  - id: p2
    name: "P2 — Core Flows"
    tests:
      - id: p2.1
        name: "Light control"
        criteria: "Toggle light on/off from tile — state changes, tile updates in real-time"
        roles: [panel, all-in-one]
        orientations: false
      # ...

  - id: p3
    name: "P3 — Performance"
    tests:
      - id: p3.1
        name: "Cold start timing"
        criteria: "Time from flutter-pi command (RPi) or app icon tap (Android) to dashboard. RPi Zero 2: < 15s, Android/reTerminal: < 10s"
        roles: [panel, all-in-one]
        orientations: false
      # ...

  - id: p4
    name: "P4 — Integration & Extras"
    tests:
      - id: p4.2
        name: "Shelly control"
        criteria: "Discover and control a Shelly device — device appears, on/off works"
        roles: [panel, all-in-one]
        orientations: false
        requires: [shelly]
      - id: p4.6
        name: "Buddy chat (OpenAI)"
        criteria: "Open Buddy, send text message — response received, displayed correctly"
        roles: [panel, all-in-one]
        orientations: false
        requires: [openai]
      # ...
```

### YAML Schema Rules

- **`version`**: Integer at the YAML root. Increment when the structure changes. The app stores this in the session; on resume, if versions differ, warn the tester that the test plan has changed.
- **`roles`**: Array of `backend | panel | all-in-one`. Test is shown only for configurations matching a listed role.
- **`orientations`**: Boolean. When `true`, the test row shows separate L and P status buttons. When `false`, a single status button.
- **`requires`**: Optional array of integration IDs. Test is hidden if the tester didn't select that integration.
- **Phase `id`** maps 1:1 to the priority tab labels: `smoke`, `p0`, `p1`, `p2`, `p3`, `p4`.

## Data Model

### TestSession (localStorage)

```typescript
interface TestSession {
  id: string;                    // UUID
  version: string;               // e.g., "v1.0.0"
  tester: string;
  startedAt: string;             // ISO timestamp

  configurations: Array<{
    id: string;                  // e.g., "rpi-zero-2--panel"
    deviceId: string;
    role: "backend" | "panel" | "all-in-one";
  }>;
  integrations: string[];        // selected integration IDs

  testPlanVersion: number;         // from YAML `version` field — for staleness detection

  // Keyed by "configId::testId::orientation"
  // orientation is "landscape", "portrait", or "single" (when orientations: false)
  // e.g., "rpi-zero-2--panel::p1.1::landscape"
  // e.g., "rpi-zero-2--panel::p2.1::single"
  results: Record<string, TestResult>;
}

interface TestResult {
  status: "pending" | "pass" | "fail" | "skip";
  notes: string;
  updatedAt: string;             // ISO timestamp
}
```

### localStorage Strategy

- Key: `smart-panel-test-session`
- Auto-saves on every status change (debounced 500ms) plus `beforeunload` flush to prevent data loss
- On app load, if a session exists, show a modal: "Resume session (v1.0.0, started Mar 19) or Start Fresh?" If the YAML `version` has changed since the saved session, warn: "Test plan has been updated since this session was saved. Some results may not match current tests."
- Export dumps the full `TestSession` as a timestamped JSON file

## Component Architecture

```
apps/testing/
├── src/
│   ├── App.tsx                    # Router between 3 screens
│   ├── main.tsx                   # Entry point
│   │
│   ├── components/
│   │   ├── SetupWizard.tsx        # Screen 1 — form with device/integration selection
│   │   ├── TestExecution.tsx      # Screen 2 — main testing interface
│   │   ├── ResultsSummary.tsx     # Screen 3 — pass/fail breakdown + export
│   │   ├── DeviceTabs.tsx         # Config tab bar
│   │   ├── PriorityTabs.tsx       # Phase/priority tab bar
│   │   ├── TestRow.tsx            # Single test row with L/P buttons + notes
│   │   ├── StatusButton.tsx       # Cycles: pending → pass → fail → skip
│   │   └── ProgressBar.tsx        # Overall and per-section progress
│   │
│   ├── hooks/
│   │   ├── useTestPlan.ts         # Loads and parses YAML, filters by selection
│   │   └── useSession.ts          # localStorage read/write with auto-save
│   │
│   ├── types.ts                   # TypeScript interfaces
│   └── utils.ts                   # Export helpers, readiness verdict computation
│
├── test-plan.yaml                 # Test definitions (source of truth)
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

**8 components, 2 hooks, 2 utility files.** No state management library — `useState` + React context is sufficient.

## UI Design

### Theme

Dark terminal style (`#0f172a` background, `#e2e8f0` text). Monospace feel for data, system-ui for labels. Color coding:
- Pass: green (`#22c55e`)
- Fail: red (`#ef4444`)
- Skip: amber (`#f59e0b`)
- Pending: slate (`#475569`)

### Key Interactions

- **Status button click**: cycles through `—` → `PASS` → `FAIL` → `SKIP` → `—` (the `—` display state maps to the `pending` status in the data model)
- **Test name click**: expands/collapses pass criteria
- **Pencil icon click**: toggles inline notes input
- **Notes auto-show**: when a test is marked FAIL (encourages documenting failures)
- **Auto-save**: every change persists to localStorage (debounced 500ms)

### Readiness Verdict Logic

The `utils.ts` `computeReadiness()` function evaluates the release readiness criteria. Special cases:
- **P2.10 (multi-panel sync)**: This test requires two panels by definition. The verdict logic counts it as passing if it passes on *any* configuration, rather than requiring it on a specific one.
- **P4 tests**: Failures do not block release readiness. They are reported as known limitations.

### Error States & Edge Cases

- **YAML parse error**: Show a full-screen error message with the parse error details. The app cannot function without a valid test plan.
- **Empty test list**: If all tests in a priority tab are filtered out for the active device (e.g., P1 on a backend-only config), show "No tests applicable for this configuration" and disable the tab badge counter.
- **Empty integrations**: If no integrations are selected, all `requires`-gated tests are hidden. Phase tabs with no remaining tests show the empty state above.
- **Form validation**: "Start Testing" button is disabled until release version is filled, tester name is filled, and at least one device+role is selected.
- **Reset confirmation**: The Reset button on the Results screen shows a confirmation dialog: "This will permanently delete all test results for this session. Export first if needed."
- **Concurrent tabs**: Not supported. A note in the UI footer: "Use one browser tab per session."

### Monorepo Integration

- **Package name**: `@fastybird/smart-panel-testing`
- **Node engine**: `>= 24` (matching project guidelines)
- **Root scripts**: Add `testing:dev` and `testing:build` to root `package.json`
- **Not included in `bootstrap`**: This is a developer tool, not part of the production build chain
- **Target**: Desktop browsers, minimum 1024px width

## Future Enhancements (out of scope for v1)

- **Dynamic device definition**: Allow testers to add custom devices with name, resolution, and roles instead of only selecting from predefined list
- **Backend persistence**: Optional server service for sharing results across team members
- **Photo attachments**: Ability to attach screenshot/photo evidence to test results
- **Historical comparison**: Compare results across releases to track regression trends
- **CI integration**: Generate release readiness report as part of CI pipeline
