# Task: Companion Screen Compiler
ID: FEATURE-COMPANION-SCREEN-COMPILER
Type: feature
Scope: backend
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned
Tracking: #1236
Issues: #1239

## 1. Business goal

In order to generate companion screens automatically from what the parent display shows,
As a system administrator,
I want the backend to look at the space the parent display shows and compile one companion screen for each domain
the panel deck shows for that space, without manual configuration.

## 2. Context

- Decision D8 in `EPIC-COMPANION-DISPLAY` applies. The panel is space/deck based: the "pages and tiles" input of the
  original spec only describes user dashboard pages now.
- Each display shows one space: `DisplayEntity.spaceId` (`apps/backend/src/modules/displays/entities/displays.entity.ts`).
  `homeMode` (`HomeMode.AUTO_SPACE | EXPLICIT`) and `HomeResolutionService` only choose the start page. The
  compiler does not need them, because the panel sends `nav` for the active deck item when it connects.
- The panel builds the deck in `apps/panel/lib/modules/deck/services/deck_builder.dart` / `system_views_builder.dart`.
  For **room** spaces it shows a system view plus domain views (`DomainType`: lights, climate, shading, media,
  sensors, energy), each gated by a count (light targets, climate targets, covers targets, media bindings, sensor
  readings, energy devices). Other space types (master, entry, signage) show only their system view. A security
  view and user dashboard pages (`DashboardPageItem`) follow.
- Backend sources for the same counts, in `apps/backend/src/plugins/spaces-home-control/services/`:
  `space-lighting-role.service.ts`, `space-climate-role.service.ts`, `space-covers-role.service.ts`,
  `space-media-activity-binding.service.ts` / `derived-media-endpoint.service.ts`, `space-sensor-role.service.ts`,
  and the lighting/climate/covers targets endpoints in `controllers/spaces-domain.controller.ts`.
- Domain names: the backend uses `lighting`/`covers` and the panel uses `lights`/`shading`. Companion screen keys use
  the backend names.
- Scenes: `scenes_module_scenes.primary_space_id`. The panel room overview shows them as quick scenes.
- Depends on #1238 (companion device with `display_id`).

## 3. Scope

**In scope**
- `ScreenCompilerService` in `apps/backend/src/plugins/devices-companion/services/screen-compiler.service.ts`
- Input resolution: companion → display → space (and space type) → domain availability → screens
- Screen keys and types: `overview`, `lighting`, `climate`, `covers`, `media`, `sensors`, `energy`, plus a built-in `idle`
- Target lists for long-press cycling (lighting roles, covers roles)
- Structure hash (sha256 over the ordered `key:type` list plus hardware profile, LED ring count and protocol version)
- `GET /api/v1/plugins/devices-companion/devices/:id/screens` → `DevicesCompanionPluginResScreens`
  (`screens`, `structure_hash`, `deployed_build_hash`, `up_to_date`)
- Recompute on read; listeners mark "update available" (via a WebSocket event) when display/space/role/scene changes alter the structure hash

**Out of scope**
- User-defined screens or ordering
- ESPHome YAML (#1242)
- Live values (pushed by the panel at runtime, #1250)
- Dashboard pages (pages-tiles/pages-cards) and the security view: v1 maps them to `idle`

## 4. Acceptance criteria

- [ ] Room space with lighting targets → `lighting` `arc_slider` (brightness 0-100 %, step 5, click `toggle`, `targets` = "all" + assigned lighting roles)
- [ ] Room space with climate targets → `climate` `arc_slider` (setpoint; min/max/step from climate state; unit from the display's `temperature_unit` or the system default; click `cycle_mode` over the supported `ClimateMode` values)
- [ ] Room space with covers targets → `covers` `arc_slider` (position 0-100 %, click `open_close`, `targets` = "all" + covers roles)
- [ ] Room space with media bindings → `media` `arc_slider` (volume of the active activity's volume endpoint, click `play_pause`)
- [ ] Room space with sensor roles → `sensors` `status_display`; with energy devices → `energy` `status_display`
- [ ] Every space type gets `overview` first: `mode_selector` over scenes with `primary_space_id` = the space when any exist, otherwise `status_display`
- [ ] Non-room spaces (master, entry, signage_info_panel) compile to `overview` only; a display without a space compiles to `[]` (plus `idle`) and the response says why
- [ ] Order follows the deck: overview, lighting, climate, covers, media, sensors, energy; `idle` is always present and not counted in the order
- [ ] Output is deterministic: same input gives the same screens and the same `structure_hash`. Labels, ranges, options and target names are **not** part of the hash
- [ ] The endpoint follows CLAUDE.md conventions (`@ApiOperation` with `operationId: 'get-devices-companion-plugin-device-screens'`, `*ResponseModel`)
- [ ] Unit tests cover every mapping rule, gating counts, non-room spaces, the no-space case, ordering and hash stability

## 5. Example scenarios

### Scenario: Room with lighting, climate and scenes

Given display "Living Room Panel" shows room "Living Room"
And the room has lighting roles Main and Ambient, one thermostat, and scenes Movie, Relax, Work
When the compiler runs
Then it returns:
  - `overview`: mode_selector (Movie, Relax, Work)
  - `lighting`: arc_slider (targets: All, Main, Ambient)
  - `climate`: arc_slider (setpoint, click cycles heat/cool/auto/off as supported)
  - `idle`
And `structure_hash` changes only if a domain appears/disappears, not if a scene is renamed

### Scenario: Master display

Given the display shows a master space
When the compiler runs
Then it returns `overview` and `idle` only

## 6. Technical constraints

- Pure, side-effect-free compile function over a gathered input snapshot; data gathering in a separate method (easy to test)
- Reuse spaces-home-control services; do not duplicate their target/role queries in SQL
- No external calls; fast enough to run on every `GET`
- The screen DTO/model lives in the plugin (`models/companion-screen.model.ts`, schema `DevicesCompanionPluginDataScreen`)

## 7. Implementation hints

```typescript
type CompanionScreenType = 'arc_slider' | 'mode_selector' | 'status_display' | 'binary_toggle' | 'idle';

interface CompanionScreen {
	key: 'overview' | 'lighting' | 'climate' | 'covers' | 'media' | 'sensors' | 'energy' | 'idle';
	type: CompanionScreenType;
	label: string;
	icon: string;
	clickAction: 'toggle' | 'cycle_mode' | 'open_close' | 'play_pause' | 'activate' | 'none';
	range?: { min: number; max: number; step: number; unit: string };
	targets?: Array<{ id: string; label: string }>; // 'all' first; long-press cycles
	options?: Array<{ id: string; label: string; icon?: string }>; // mode_selector
}
```

- `binary_toggle` is reserved for a lighting space whose lights are all on/off only (no brightness); decide in #1244 whether v1 emits it
- Panel ↔ screen mapping (used by #1250): `DomainType.lights → lighting`, `shading → covers`, system view → `overview`, other deck items → `idle`

## 8. AI instructions

- Read this file and the epic's Decisions section; read the deck builder and the spaces-home-control role services before coding; start with a short plan (max 10 steps).
- Follow `CLAUDE.md`; PR title e.g. `feat(backend): compile companion screens from the display's space domains`.
- For each acceptance criterion, implement it or explain why it is skipped.
