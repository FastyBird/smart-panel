# Task: Panel system pages for Room role (Overview + Domains + Quick Scenes)
ID: FEATURE-PANEL-ROOM-SYSTEM-PAGES
Type: feature
Scope: panel
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to make the panel usable immediately after running Spaces/Displays setup (without manual dashboard page configuration),
As a Smart Panel user,
I want the panel app to automatically generate high-quality "system pages" for a Room display: a Room Overview and domain pages (Lights/Climate/Sensors), including Quick Scenes.

## 2. Context

- Panel app is now refactored into **modules + plugins** (mirrors backend/admin structure).
- Displays now support:
  - `displayRole`: `room | master | entry`
  - `homePageMode`: `auto | explicit` (legacy `first page` is not allowed)
  - `roomId` (assigned room; previously `spaceId`)
- Spaces module in backend/admin provides Rooms/Zones and device assignments:
  - devices contain `room_id` (and possibly `zone_ids`)
- Scenes module exists (manual presets; no conditions/automations).
- Constraints:
  - No legacy behavior / feature flags.
  - Backward compatibility not required; non-production.
  - Do not introduce new dependencies unless really needed.
  - Do not modify generated code.
  - Tests are expected for new logic.

## 3. Scope

**In scope**

- Room system pages:
  - Room Overview page
  - Domain pages: Lights, Climate, Sensors
  - Quick Scenes section on Room Overview
- Deterministic system-deck composition for Room role:
  - `deck = systemViews[] + dashboardPages[]`
- Accurate device loading by room context (fix current "devices not loaded" issue).
- UX rules:
  - Hide domain tiles if count is 0
  - Header uses the assigned room's icon/name and shows basic status chips

**Out of scope**

- Media domain page (explicitly excluded for this iteration).
- Master/Entry roles (handled in a separate epic).
- Advanced intents/suggestions engine (only minimal hooks/slots if necessary).
- New dashboard page types.

## 4. Acceptance criteria

- [x] With `displayRole=room` and `roomId` set, the panel shows a **Room Overview** system page first when `homePageMode=auto`.
- [x] Room Overview header displays room icon + room name (not static "Room").
- [x] Room Overview shows **only** domain tiles for domains with device count > 0 (Lights/Climate/Sensors).
- [x] Tapping a domain tile navigates to the corresponding domain system page (deterministic index).
- [x] Domain pages load devices filtered by the assigned room and render meaningful MVP UI (no "landing-only" placeholder when devices exist).
- [x] Room Overview shows **Quick Scenes** (up to 4), filtered for room first then whole-home fallback; tapping executes the scene.
- [x] If the room has no devices at all, show a clean empty state with guidance (no crash).
- [x] No media page is rendered anywhere in the Room system views.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Room display with lights + sensors, no climate
Given a display with role "Room" and assigned room "Living Room"  
And the Living Room has 3 lighting devices and 2 sensors and 0 climate devices  
When the panel starts with Home Page Mode "Auto"  
Then the deck starts on "Living Room Overview"  
And the overview shows tiles: Lights, Sensors  
And the overview does not show a Climate tile  
And tapping "Lights" opens the Lights domain page  
And tapping "Sensors" opens the Sensors domain page  

### Scenario: Quick Scenes are shown and executable
Given the Living Room has 2 scenes assigned to it  
And there are 3 whole-home scenes  
When the Living Room Overview is displayed  
Then up to 4 scenes are shown prioritizing room scenes first  
When the user taps a scene tile  
Then the scene is executed and the UI shows success/failure feedback  

## 6. Technical constraints

- Follow the existing module / plugin structure in the panel app.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic (unit tests for deck building, room context aggregation, and filtering).

## 7. Implementation hints (optional)

- Create/extend a `Deck` (or `deck` module) as the single place that:
  - computes `systemViews[]` from display role + config
  - appends `dashboardPages[]` from dashboard module
  - provides an index map: `{ domain: pageIndex }`
- Create a `RoomContext` service/class responsible for:
  - loading room details
  - loading devices for that room (and optionally zone inheritance if already supported)
  - aggregating per-domain counts and header chips
  - loading scenes for that room + fallback
- Prefer composition:
  - domain modules render their own pages using devices from `RoomContext`

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Implement RoomContext loader and aggregation
ID: FEATURE-PANEL-ROOM-CONTEXT
Type: technical
Scope: panel
Size: medium
Parent: FEATURE-PANEL-ROOM-SYSTEM-PAGES
Status: done

## 1. Business goal

In order to render accurate system pages for a Room display,
As a panel system,
I want a single, tested RoomContext source of truth that loads room metadata, devices, scenes, and aggregates domain counts/status.

## 2. Context

- Devices now include `room_id` (and possibly `zone_ids`).
- Display includes `roomId`.
- Current bug: devices are not loaded/filtered correctly by room.

## 3. Scope

**In scope**

- `RoomContext` (or equivalent) API:
  - `load(roomId)` returning:
    - room details (name, icon/category)
    - devices list filtered for room
    - per-domain groups: lights/climate/sensors
    - aggregates: counts per domain, lightsOn/total, primaryTemperature (if available)
    - scenes: room-first then whole-home fallback
- Caching policy (if needed) consistent with current panel app patterns.
- Unit tests for grouping/aggregation logic.

**Out of scope**

- Complex inheritance rules if not already supported (e.g., zone -> room cascading beyond existing backend semantics).
- Any intent engine.

## 4. Acceptance criteria

- [x] `RoomContext.load(roomId)` returns room metadata and device groups (lights/climate/sensors) based on device categories/capabilities.
- [x] Domain counts match the filtered device lists.
- [x] `lightsOn/total` is computed from device state when available; if not available, safely falls back (no crash).
- [x] `primaryTemperature` is derived from the best available sensor/override; if missing, returns null and UI handles it.
- [x] Scenes are loaded with priority: room scenes first; fallback includes whole-home scenes.
- [ ] Unit tests cover: filtering, grouping, counts, and scene selection ordering.

## 6. Technical constraints

- No new dependencies unless unavoidable.
- Do not modify generated code.
- Add tests.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Build deterministic system deck for Room role
ID: FEATURE-PANEL-DECK-ROOM-BUILDER
Type: technical
Scope: panel
Size: medium
Parent: FEATURE-PANEL-ROOM-SYSTEM-PAGES
Status: done

## 1. Business goal

In order to make navigation predictable and support tap-to-domain routing,
As a panel user,
I want the Room deck order to be deterministic and stable across runs.

## 3. Scope

**In scope**

- For `displayRole=room`:
  - `systemViews[] = [RoomOverview] + [Lights?] + [Climate?] + [Sensors?]`
  - A domain page is included only if that domain count > 0.
- Provide index resolution: `getDomainIndex(domain)` for routing.
- Append existing `dashboardPages[]` after system views (unchanged behavior).

**Out of scope**

- Master/Entry deck builders.

## 4. Acceptance criteria

- [x] Given a RoomContext, builder outputs deterministic `systemViews[]` order.
- [x] A domain with 0 devices is excluded from `systemViews[]`.
- [x] `getDomainIndex(domain)` returns correct indices matching the built deck.
- [ ] Unit tests cover multiple combinations (only lights, lights+sensors, all three, none).

## 6. Technical constraints

- No new dependencies.
- Add tests.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Room Overview UI (header + domain tiles + quick scenes)
ID: FEATURE-PANEL-ROOM-OVERVIEW-UI
Type: feature
Scope: panel
Size: large
Parent: FEATURE-PANEL-ROOM-SYSTEM-PAGES
Status: done

## 1. Business goal

In order to provide a "ready-to-use" home screen for a room,
As a user,
I want an overview that shows relevant domains only, gives quick status, and provides one-tap scene execution.

## 2. Context

- Use `RoomContext` as data source.
- Display layout config provides `rows/cols` for adaptive tile sizing.

## 3. Scope

**In scope**

- Header:
  - leading: room icon
  - title: room name
  - right: 1–3 status chips (lights summary, temperature, optional offline count if available)
  - tap on chips opens a lightweight info popover/modal (no navigation)
- Domain tiles grid:
  - show only tiles where domain count > 0
  - tap navigates to corresponding domain page via deck index resolver
  - tile contents: icon + count + label
- Quick Scenes:
  - show if there are scenes (room-first then whole-home)
  - show up to 4 scenes
  - tap executes the scene and shows success/failure feedback
- Empty state:
  - if no devices across all domains, show "No devices assigned" message and a hint.

**Out of scope**

- Fancy animations.
- Media tile/page.

## 4. Acceptance criteria

- [x] Header uses room name/icon from space data.
- [x] Domain tiles are hidden when their count is 0.
- [x] Tap on a domain tile routes to the correct domain page.
- [x] Quick Scenes shows max 4, prioritizing room scenes; tapping runs the scene.
- [x] Empty room shows empty state instead of blank grid or crash.
- [x] Layout adapts to display size; tiles remain readable and touch-friendly.

## 6. Technical constraints

- Reuse existing UI components/styles.
- Avoid new dependencies.
- Add widget tests if existing test harness supports them; otherwise unit test routing logic.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Lights domain page MVP
ID: FEATURE-PANEL-DOMAIN-LIGHTS-PAGE
Type: feature
Scope: panel
Size: medium
Parent: FEATURE-PANEL-ROOM-SYSTEM-PAGES
Status: done

## 1. Business goal

In order to control lights quickly inside a room,
As a user,
I want a lights page that lists lighting devices and supports quick toggle actions.

## 3. Scope

**In scope**

- Render lighting devices from `RoomContext` lights group.
- Provide per-device tile/list item with:
  - name
  - primary state (on/off)
  - tap toggles (if supported)
  - optional long-press or secondary action opens existing device detail (if available)
- Empty state if no lights (but note: deck builder should exclude the page when count=0).

**Out of scope**

- Advanced dimmer/color UI unless already available.

## 4. Acceptance criteria

- [x] Lights page renders when included and shows all lighting devices for the room.
- [x] Toggling a device sends the correct command via existing device control pathways.
- [x] UI updates reflect new state (optimistic or after update event).
- [x] No crashes if a device lacks a supported toggle capability (render as read-only).

## 6. Technical constraints

- Reuse existing device control services.
- Add tests for view model/state transitions if applicable.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Climate domain page MVP
ID: FEATURE-PANEL-DOMAIN-CLIMATE-PAGE
Type: feature
Scope: panel
Size: medium
Parent: FEATURE-PANEL-ROOM-SYSTEM-PAGES
Status: done

## 1. Business goal

In order to manage temperature-related devices quickly,
As a user,
I want a climate page that shows thermostats/heaters and allows basic adjustments where supported.

## 3. Scope

**In scope**

- Render climate devices from `RoomContext` climate group:
  - thermostats, heaters, air conditioners (based on device categories/capabilities)
- For thermostat-like devices:
  - show current temperature (if available) and target setpoint (if available)
  - allow +/- setpoint if supported
- For heater/switch climate:
  - basic on/off toggle
- Empty state logic (page excluded if count=0).

**Out of scope**

- Complex HVAC modes unless already present.

## 4. Acceptance criteria

- [x] Climate page renders correctly when included and lists room climate devices.
- [x] Basic controls work (toggle and/or setpoint where supported).
- [x] Missing capabilities degrade gracefully (read-only UI).
- [x] Unit tests cover device-to-widget mapping decisions.

## 6. Technical constraints

- Reuse existing property control APIs and value subscriptions.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Sensors domain page MVP
ID: FEATURE-PANEL-DOMAIN-SENSORS-PAGE
Type: feature
Scope: panel
Size: medium
Parent: FEATURE-PANEL-ROOM-SYSTEM-PAGES
Status: done

## 1. Business goal

In order to see the room’s current readings at a glance,
As a user,
I want a sensors page that shows key sensor values per device.

## 3. Scope

**In scope**

- Render sensor devices from `RoomContext` sensors group.
- For each sensor:
  - show name
  - show 1–3 primary readings (temp/humidity/illuminance/motion) based on available properties
- Empty state logic (page excluded if count=0).

**Out of scope**

- Historical charts.

## 4. Acceptance criteria

- [x] Sensors page renders correctly when included and lists sensor devices for the room.
- [x] Each sensor shows available readings; missing readings do not break layout.
- [x] Values update when property updates arrive.

## 6. Technical constraints

- Reuse property value subscription mechanisms already used in the panel.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

---

# Task: Quick Scenes execution feedback and error handling
ID: FEATURE-PANEL-QUICK-SCENES-FEEDBACK
Type: technical
Scope: panel
Size: small
Parent: FEATURE-PANEL-ROOM-SYSTEM-PAGES
Status: done

## 1. Business goal

In order to build trust in scene actions,
As a user,
I want clear feedback when a scene execution succeeds or fails.

## 3. Scope

**In scope**

- Visual feedback on scene tile tap:
  - loading state while executing
  - success indication (brief)
  - error message on failure (brief, non-blocking)
- Timeouts and cancellation handling consistent with existing networking patterns.

## 4. Acceptance criteria

- [x] Scene tile shows executing/loading state during the call.
- [x] Success shows a brief confirmation.
- [x] Failure shows a brief error and resets UI state.
- [x] No repeated execution spam on fast taps (basic debouncing while loading).

## 6. Technical constraints

- No new dependencies.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
