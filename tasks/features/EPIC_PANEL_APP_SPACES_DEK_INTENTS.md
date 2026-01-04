# Task: Refactor Panel App to Spaces + Deck + Intents architecture
ID: EPIC-PANEL-SPACES-DECK-INTENTS
Type: feature
Scope: panel
Size: large
Parent: (none)
Status: implemented

## 1. Business goal

In order to make the Panel App usable immediately after running the Spaces wizard and configuring Displays,
As a Smart Panel user,
I want the Panel App to automatically present meaningful “system views” (Room/Master/Entry) and still allow optional custom dashboard pages, with an intent-driven interaction layer.

## 2. Context

- Backend/Admin now provide:
  - **Spaces** (Room/Zone), with parent zone (“Floor”), device assignments, display assignments.
  - **Displays** include: `displayRole` (room/master/entry), `roomId` (only for Room role), and `homeMode` (auto/explicit) + optional `homePageId`.
  - **Dashboard pages** exist (tiles/cards/device detail), ordered, and can be global (displayId = null) or per-display.
  - **Scenes** exist (space-scoped optional), and can be triggered.
- Previous Panel App behavior (pre-spaces era):
  - App loads pages (global + per-display), orders by page order, user swipes: `[page1] <-> ... <-> [pageN]`.
- New desired behavior (B1 agreed):
  - Keep the dashboard “deck” intact and predictable; **do not generate extra pages from devices**.
  - Introduce **system views** (one “overview view” depending on display role) that sit *before* the dashboard deck.
  - `homeMode` determines which view/page is shown first at startup, without changing what is included in the deck.
- Constraints:
  - No legacy code paths; no “first page legacy” behavior.
  - Backward compatibility is not required; breaking changes are allowed.
  - No feature flags needed.
  - Tests expected for new logic.

## 3. Scope

**In scope**

- Implement the new Panel App navigation model:
  - `deck = systemViews[] + dashboardPages[]`
  - Start item determined by display settings (`homeMode` + `homePageId`) and display role.
- Implement the three system views:
  - Room overview (for Room displays)
  - Master overview (whole-house)
  - Entry overview (house modes / security / quick actions)
- Integrate Spaces + Displays + Dashboard pages + Scenes into one coherent UX and data flow.
- Define and implement an “Intents” layer (commands from UI and voice later) that routes actions to devices/scenes/pages consistently.

**Out of scope**

- Voice wake word / speech recognition / TTS.
- Automations (conditions, triggers); scenes remain manual presets.
- Reworking Admin/Backend modules (only consume their APIs).

## 4. Acceptance criteria

- [x] Panel App builds the deck as `systemViews[] + dashboardPages[]` for any display.
- [x] System views are role-dependent (Room/Master/Entry) and exactly one system view is included per display.
- [x] `homeMode=auto` starts on the system view; `homeMode=explicit` starts on the chosen dashboard page (or a safe fallback).
- [x] The set and order of dashboard pages matches existing backend ordering rules (global + per-display).
- [x] No "legacy first page" logic remains anywhere in Panel App.
- [x] Core navigation, state hydration, and intent routing are covered by tests.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Room display, homeMode auto
Given a display with role "Room" and roomId "Living Room"  
And homeMode is "auto"  
When the Panel App starts  
Then it shows the Room system overview first  
And the user can swipe to dashboard pages afterwards.

### Scenario: Master display, homeMode explicit
Given a display with role "Master"  
And homeMode is "explicit" with homePageId = "Energy dashboard"  
When the Panel App starts  
Then it starts on "Energy dashboard"  
And swiping left shows the Master system overview.

## 6. Technical constraints

- Follow the existing module/service structure in the Panel App.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Treat “deck building” as pure logic: deterministic inputs -> deterministic deck output.
- Keep system view as a special “page type” or “view model” so it can live next to dashboard pages without hacks.
- Intents should not depend on UI widgets; UI calls intents, intents call services.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Define Panel App domain models for Spaces, Displays, Pages, and Deck items
ID: FEATURE-PANEL-DECK-DOMAIN-MODELS
Type: feature
Scope: panel
Size: medium
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to assemble and render a predictable navigation deck,
As a developer,
I want explicit, typed domain models for deck items, display settings, and system views.

## 2. Context

- Display settings now include `displayRole`, `roomId`, `homeMode`, `homePageId`.
- System view must be exactly one item and must coexist with dashboard pages in a single deck.

## 3. Scope

**In scope**

- Define domain types:
  - `DisplayRole = ROOM | MASTER | ENTRY`
  - `HomeMode = AUTO | EXPLICIT`
  - `DeckItem` union:
    - `SystemViewItem` (role-specific)
    - `DashboardPageItem` (existing page types)
- Define mapping from backend DTOs to domain models.

**Out of scope**

- Rendering widgets/layout.
- Intents.

## 4. Acceptance criteria

- [x] Domain models exist and compile.
- [x] Mapping functions exist from API DTOs to domain models.
- [x] `DeckItem` supports stable `id` and `type` for navigation and testing.

## 6. Technical constraints

- No new dependencies.
- Do not modify generated API models; wrap/convert them.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Implement Deck Builder (system view + dashboard pages) as pure deterministic logic
ID: FEATURE-PANEL-DECK-BUILDER
Type: feature
Scope: panel
Size: large
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to keep navigation predictable and testable,
As a developer,
I want a pure “deck builder” that deterministically produces the deck order and the initial index.

## 2. Context

- Agreed model: `deck = systemViews[] + dashboardPages[]` with exactly one system view.
- homeMode behavior (B1):
  - `AUTO`: start on system view.
  - `EXPLICIT`: start on the selected dashboard page, but keep system view in deck.

## 3. Scope

**In scope**

- Implement `buildDeck(display, spaces, pages) -> { deckItems, startIndex }`
- Rules:
  1) Always include exactly one system view item based on `displayRole`.
  2) Dashboard pages = global pages + per-display pages, ordered by `order` ascending (consistent with current panel logic).
  3) If `homeMode=AUTO` => `startIndex` = index(system view).
  4) If `homeMode=EXPLICIT`:
     - Find the page with `id == homePageId` among dashboard pages.
     - If found: `startIndex` = index(that page) in deck.
     - If not found: fallback to system view (safe and predictable).
  5) Never duplicate dashboard pages; if both global and per-display share ids, dedupe by id (prefer per-display instance).

**Out of scope**

- UI navigation/animation.
- Loading from API (handled by hydration task).
- Intents.

## 4. Acceptance criteria

- [x] Unit tests cover all rules above (including explicit missing page fallback).
- [x] Deck builder has no side effects and no UI dependencies.
- [x] Deck order is stable for the same input data.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Explicit page exists
Given a Room display with homeMode explicit and homePageId "p2"  
And dashboard pages are [p1, p2, p3]  
When buildDeck runs  
Then deck is [roomSystemView, p1, p2, p3]  
And startIndex points to p2.

## 6. Technical constraints

- Tests are required (unit tests, no golden screenshots needed).
- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Implement App Hydration pipeline (load display, spaces, pages, scenes)
ID: FEATURE-PANEL-HYDRATION-PIPELINE
Type: feature
Scope: panel
Size: large
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to build the deck and allow system views to work,
As the Panel App,
I want to reliably hydrate state from backend APIs (display + spaces + assignments + pages + scenes) with clear error handling.

## 2. Context

- Panel needs display identity and its settings.
- Spaces are required for Room system view (room name, icon, assignments).
- Pages required for dashboard portion of deck.
- Scenes required for system views “quick actions” and for intents.

## 3. Scope

**In scope**

- Define a boot sequence:
  1) Resolve current display identity.
  2) Fetch display settings.
  3) Fetch spaces (rooms/zones) + assignments needed for system views.
  4) Fetch dashboard pages (global + per-display).
  5) Fetch scenes (at least those relevant to display role / selected space; may fetch all for MVP).
  6) Build deck via deck builder and navigate to `startIndex`.
- Implement error handling states:
  - “No display registered” state
  - “Cannot fetch config” state (retry)
  - “Display misconfigured” state (e.g., Room role but missing roomId) with clear message.

**Out of scope**

- Advanced caching/ETag optimizations.
- Offline mode.

## 4. Acceptance criteria

- [x] On cold start with valid backend: state hydrates and deck is built.
- [x] If displayRole=Room and roomId missing: app shows a clear configuration error view.
- [x] Retry action exists for transient failures.
- [x] Tests cover at least: happy path + Room missing roomId + API error retry.

## 6. Technical constraints

- Reuse existing API client/services.
- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Remove legacy “first page” and any pre-spaces navigation assumptions
ID: TECH-PANEL-REMOVE-LEGACY-NAV
Type: technical
Scope: panel
Size: medium
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to prevent divergent behavior and future bugs,
As a maintainer,
I want all legacy navigation logic removed so only the new deck model exists.

## 2. Context

- We explicitly do not want legacy behavior.
- The app previously started on the first dashboard page implicitly.

## 3. Scope

**In scope**

- Remove:
  - Any “first page” / “startIndex=0” assumptions
  - Any code paths building navigation solely from pages
- Replace with:
  - Deck builder output (deckItems + startIndex)

**Out of scope**

- UI redesign.

## 4. Acceptance criteria

- [x] No code references or fallback logic for "legacy first page".
- [x] App start index is always derived from deck builder.
- [x] Tests updated to new behavior.

## 6. Technical constraints

- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Create System View – Room Overview
ID: FEATURE-PANEL-SYSTEMVIEW-ROOM
Type: feature
Scope: panel
Size: large
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to make a room display immediately useful,
As a user with a Room display,
I want a room-centric overview showing key info and quick actions for that room.

## 2. Context

- Room displays have `roomId` configured.
- Admin assigns devices to rooms; device categories are available (lighting, thermostat, etc.).
- Scenes can be space-scoped.

## 3. Scope

**In scope**

- Room overview view model and UI:
  - Header: room name, icon
  - Summary tiles: counts (lights, climate devices, sensors, media) derived from assigned devices
  - Quick actions: show scenes related to the room (space-scoped + generic “room” scenes)
  - Optional: “recent activity” based on latest property updates (if already available via WS)
- Must be read-only regarding configuration (no admin actions).

**Out of scope**

- Dedicated per-category control pages (lights page, climate page). Not part of B1.
- Advanced analytics.

## 4. Acceptance criteria

- [x] Room system view renders for Room role displays.
- [x] If room has no devices: view shows "empty state" with guidance (assign devices in Admin).
- [x] Scenes list shows only enabled scenes relevant to this room (or whole home if you decide to include).
- [x] Unit/widget actions route through intents (no direct service calls from UI).

## 6. Technical constraints

- Reuse existing device/category data and scene APIs.
- Keep UI consistent with current panel design system.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Create System View – Master Overview
ID: FEATURE-PANEL-SYSTEMVIEW-MASTER
Type: feature
Scope: panel
Size: large
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to have a whole-house display,
As a user with a Master display,
I want a high-level overview across rooms and quick global actions.

## 2. Context

- Spaces module supports multiple rooms and zones.
- Scenes can be global or space-scoped.

## 3. Scope

**In scope**

- Master overview view model and UI:
  - Summary counts: rooms, connected devices, alerts (if available), scenes
  - Room list cards: each room status (online/offline devices, temperature if known)
  - Quick actions: global scenes (“Away”, “Home”, “Night”, etc.) and pinned scenes
- Navigation affordance:
  - Tap a room card -> intent “navigate to room context” (for now may open a dashboard page, or show a room detail overlay if exists)

**Out of scope**

- Full room drilldown pages beyond navigation intent.
- Complex sorting/filtering.

## 4. Acceptance criteria

- [x] Master system view renders for Master role displays.
- [x] Rooms list is built from spaces of type Room.
- [x] Quick actions trigger scenes via intents.

## 6. Technical constraints

- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Create System View – Entry Overview
ID: FEATURE-PANEL-SYSTEMVIEW-ENTRY
Type: feature
Scope: panel
Size: large
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to have an entry/foyer display that supports "house mode" actions,
As a user with an Entry display,
I want quick access to common scenes and security-related status.

## 2. Context

- Display role includes Entry.
- Scenes include categories like AWAY/HOME/SECURITY.

## 3. Scope

**In scope**

- Entry overview view model and UI:
  - Primary actions: “Home”, “Away”, “Night”, “Movie” (based on available scenes)
  - Security status panel (if devices include lock/alarm/camera categories; show counts and basic status)
  - Optional: doorbell/camera quick access if present
- All actions go through intents.

**Out of scope**

- Implementing full security subsystem.
- Camera streaming.

## 4. Acceptance criteria

- [x] Entry system view renders for Entry role displays.
- [x] Scene shortcuts show only scenes available/enabled.
- [x] If no security devices exist, security panel shows a compact empty state.

## 6. Technical constraints

- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Implement Intents layer (navigation + device control + scene trigger)
ID: FEATURE-PANEL-INTENTS-CORE
Type: feature
Scope: panel
Size: large
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to unify UI actions and future voice control,
As a developer,
I want a single “intents” API that the UI calls, which routes to the correct services (devices, scenes, navigation).

## 2. Context

- UI currently may call services directly.
- We want future “AI assistant” without rewriting UI logic.

## 3. Scope

**In scope**

- Define intents:
  - `NavigateToDeckItem(id)`
  - `NavigateHome()` (go to startIndex item)
  - `ActivateScene(sceneId)`
  - `SetDeviceProperty(deviceId, channelId, propertyId, value)`
  - `ToggleDevice(deviceId)` (if capability exists)
  - `SetRoomContext(roomId)` (optional; can be a no-op for now)
- Implement an `IntentsService` that:
  - Validates inputs (e.g., can the device be controlled)
  - Calls underlying services (ScenesService, DevicesService, Navigator)
  - Emits events for UI feedback (success/failure)

**Out of scope**

- Natural language parsing. (That can be layered later.)
- Automations engine.

## 4. Acceptance criteria

- [x] UI uses intents for system view actions (scenes, device toggles).
- [x] Intents have unit tests (routing and validation).
- [x] Failures are surfaced in a consistent way (snackbar/toast or error state).

## 6. Technical constraints

- No new dependencies.
- Avoid circular dependencies between UI and intents.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Integrate deck navigation UI with the new deck model
ID: FEATURE-PANEL-DECK-NAVIGATION-UI
Type: feature
Scope: panel
Size: large
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to keep the swipe experience but support system views,
As a user,
I want to swipe through the deck items seamlessly, regardless of whether they are system views or dashboard pages.

## 2. Context

- Pre-spaces: swipe between pages.
- Now: deck includes system view(s) + pages.

## 3. Scope

**In scope**

- Update navigator/router to consume `deckItems` list.
- Ensure:
  - Swipe left/right works across boundary between system view and first dashboard page.
  - Programmatic navigation to a specific deck item (for explicit start and intents).
- Display a consistent page indicator if used.

**Out of scope**

- New gestures beyond existing ones.

## 4. Acceptance criteria

- [x] Deck is rendered from `deckItems` (not from pages directly).
- [x] Swiping works across the full deck.
- [x] `NavigateToDeckItem` intent navigates correctly.

## 6. Technical constraints

- No new dependencies.
- Maintain current performance.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Implement Panel App configuration validation for Display Role and Home Mode
ID: FEATURE-PANEL-DISPLAY-CONFIG-VALIDATION
Type: feature
Scope: panel
Size: medium
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to prevent confusing blank screens,
As a user,
I want the panel to clearly report configuration issues (e.g., Room display without room assigned).

## 2. Context

- Admin hides room select when display role != Room.
- Still possible the backend holds an invalid state during setup.

## 3. Scope

**In scope**

- Validate:
  - Room role requires `roomId`.
  - Explicit home mode requires `homePageId` to resolve to a dashboard page (else fallback + warning).
- Implement a configuration error view with:
  - Short explanation
  - Suggested fix (configure in Admin > Displays)

## 4. Acceptance criteria

- [x] Missing `roomId` for Room role shows error view.
- [x] Invalid `homePageId` falls back to system view and shows a non-blocking warning.
- [x] Tests cover validations.

## 6. Technical constraints

- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Wire real-time updates for system views (devices/spaces/scenes) via WebSocket
ID: FEATURE-PANEL-REALTIME-SYSTEMVIEWS
Type: feature
Scope: panel
Size: medium
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to keep system views accurate without manual refresh,
As a user,
I want device states and relevant counts to update live.

## 2. Context

- Backend supports WebSocket updates for property values.
- System views rely on counts and statuses.

## 3. Scope

**In scope**

- Subscribe to property updates and update:
  - Room device status
  - Master room summaries
  - Entry security panel status
- Ensure updates do not trigger expensive full re-renders.

**Out of scope**

- Historical charts.

## 4. Acceptance criteria

- [x] When a device value changes, the relevant system view updates without restart.
- [x] No significant performance regressions (avoid full hydration per update).
- [x] Tests cover the update reducer logic (unit tests).

## 6. Technical constraints

- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Add support for Scenes invocation from Panel App system views
ID: FEATURE-PANEL-SCENES-INTEGRATION
Type: feature
Scope: panel
Size: medium
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to provide "one tap" multi-device actions,
As a user,
I want to trigger scenes from system views.

## 2. Context

- Scenes are manual presets; no conditions.
- Scenes may be associated with a space (Whole home / room / zone).

## 3. Scope

**In scope**

- Fetch scenes during hydration (or on demand).
- Determine relevance:
  - Room view: scenes with `spaceId == roomId` plus “Whole home”.
  - Master/Entry: prefer “Whole home” and categories (Home/Away/Night/Security).
- Trigger scenes via intents.

**Out of scope**

- Scene editing in Panel App.

## 4. Acceptance criteria

- [x] Scene buttons appear in system views according to relevance rules.
- [x] Triggering a scene shows progress + success/failure feedback.
- [x] Tests cover relevance filtering rules.

## 6. Technical constraints

- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Align Dashboard Page rendering with DeckItem abstraction
ID: FEATURE-PANEL-DASHBOARD-PAGES-AS-DECKITEM
Type: feature
Scope: panel
Size: medium
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to avoid duplicating rendering pipelines,
As a developer,
I want existing page rendering to work unchanged, but mounted through the deck item router.

## 2. Context

- Dashboard module pages include multiple page types.
- We do not want to redesign page rendering.

## 3. Scope

**In scope**

- Adapt router/rendering so that:
  - `DashboardPageItem` delegates to existing page renderer.
  - Page order and display filtering remain identical to current behavior.

**Out of scope**

- Reworking page editor or page types.

## 4. Acceptance criteria

- [x] All existing page types render correctly inside the deck.
- [x] Global + per-display filtering still works.
- [x] Tests (or smoke tests) confirm no regressions.

## 6. Technical constraints

- Do not modify generated code.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Implement integration tests / smoke harness for the deck startup matrix
ID: TEST-PANEL-DECK-STARTUP-MATRIX
Type: technical
Scope: panel
Size: medium
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to prevent regressions across display roles and home modes,
As a maintainer,
I want a test matrix that verifies startup behavior for key combinations.

## 2. Context

- Matrix dimensions:
  - role: Room / Master / Entry
  - homeMode: auto / explicit
  - explicit page exists vs missing
  - roomId present vs missing (Room role)

## 3. Scope

**In scope**

- Add tests that assert:
  - deck composition
  - startIndex selection
  - error state behavior

**Out of scope**

- Screenshot/golden tests.

## 4. Acceptance criteria

- [x] Tests cover at least 8 core combinations.
- [x] Tests are stable and deterministic.

## 6. Technical constraints

- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.



---

# Task: Update Panel App documentation (developer-facing) for Spaces + Deck + System Views + Intents
ID: CHORE-PANEL-DOCS-SPACES-DECK-INTENTS
Type: chore
Scope: panel
Size: small
Parent: EPIC-PANEL-SPACES-DECK-INTENTS
Status: implemented

## 1. Business goal

In order to keep development scalable,
As a developer,
I want clear internal documentation describing the new navigation and intents architecture.

## 2. Context

- Multiple moving parts: spaces, display roles, home mode, deck builder, intents.
- Without docs, future contributors will reintroduce legacy patterns.

## 3. Scope

**In scope**

- Add a short markdown doc covering:
  - Deck model
  - Startup rules
  - System view responsibilities
  - Intents API and usage guidelines

**Out of scope**

- End-user documentation.

## 4. Acceptance criteria

- [x] Doc exists and matches implemented behavior.
- [x] Includes examples for each display role and home mode.

## 6. Technical constraints

- Keep doc close to code (e.g., `/apps/panel/docs/` or similar).

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
