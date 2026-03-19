# Task: Companion Screen Compiler
ID: FEATURE-COMPANION-SCREEN-COMPILER
Type: feature
Scope: backend
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned

## 1. Business goal

In order to automatically generate appropriate companion display screens based on what the parent display shows,
As a system administrator,
I want the system to inspect a parent display's pages and tiles, then compile a set of companion screens (arc sliders, mode selectors, status displays) without manual configuration.

## 2. Context

- The parent display has pages (Overview, Climate, Lights, Media, etc.) each containing tiles bound to entities
- The compiler maps each page to an appropriate companion screen type based on the domain
- The compiler determines which entity is the "primary" control target per page
- Pages with multiple controllable entities use long-press to cycle between them
- Depends on `FEATURE-COMPANION-BACKEND-PLUGIN` for the companion display entity
- Related: `EPIC-COMPANION-DISPLAY` (parent epic)

## 3. Scope

**In scope**
- Screen compilation service that inspects parent display pages and tiles
- Domain detection (climate, lights, media, covers, scenes, overview)
- Mapping rules: domain → companion screen type with appropriate parameters
- Primary entity selection when multiple entities exist on a page
- Compiled screen data model (type, entity reference, min/max/unit, actions)
- API endpoint to trigger compilation and return compiled screens
- Re-compilation when parent display pages change

**Out of scope**
- Custom screen types defined by users
- Screen ordering customization (follows parent page order)
- ESPHome YAML generation from compiled screens (separate task)

## 4. Acceptance criteria

- [ ] Compiler inspects parent display's pages and detects the domain of each page
- [ ] Climate pages compile to arc_slider screens (temperature, min/max from entity, unit °C/°F)
- [ ] Lights pages compile to arc_slider screens (brightness 0-100%, click = toggle)
- [ ] Media pages compile to arc_slider screens (volume 0-100%, click = play/pause)
- [ ] Covers pages compile to arc_slider screens (position 0-100%, click = open/close)
- [ ] Scene pages compile to mode_selector screens (list of available scenes)
- [ ] Overview/read-only pages compile to status_display screens
- [ ] Pages with multiple controllable entities include a secondaryEntities list for long-press cycling
- [ ] `GET /api/v1/companion-displays/:id/screens` returns compiled screens
- [ ] `POST /api/v1/companion-displays/:id/screens/compile` triggers re-compilation
- [ ] Unit tests cover all domain mapping rules

## 5. Example scenarios

### Scenario: Compile screens for a display with Climate, Lights, and Scenes pages

Given parent display "Living Room Panel" has:
  - Page 0: Overview (weather tile, energy tile)
  - Page 1: Climate (Living Room AC tile, Bedroom AC tile)
  - Page 2: Lights (Ceiling Light tile, Desk Lamp tile, LED Strip tile)
  - Page 3: Scenes (Movie, Relax, Work scenes)
When the screen compiler runs
Then it produces:
  - Screen 0: status_display (Overview - rotate to browse info)
  - Screen 1: arc_slider (Climate - primary: Living Room AC, secondary: [Bedroom AC])
  - Screen 2: arc_slider (Lights - primary: Ceiling Light, secondary: [Desk Lamp, LED Strip])
  - Screen 3: mode_selector (Scenes - options: [Movie, Relax, Work])

## 6. Technical constraints

- Follow the existing service patterns in the backend
- Screen compilation must be deterministic (same input → same output)
- Compiler should be fast (no external API calls, works from local data)
- Domain detection should use existing tile/entity type information
- Tests are expected for all mapping rules

## 7. Implementation hints

### Mapping Rules
```typescript
interface CompanionScreen {
  index: number;
  type: 'arc_slider' | 'mode_selector' | 'status_display' | 'binary_toggle';
  label: string;
  icon: string;
  primaryEntity?: { id: string; property: string; min: number; max: number; unit: string };
  secondaryEntities?: Array<{ id: string; label: string }>;
  clickAction?: 'toggle' | 'cycle_mode' | 'activate' | 'none';
  options?: Array<{ id: string; label: string; icon: string }>; // for mode_selector
}
```

### Domain Detection Heuristic
- Check tile types and bound entity categories
- Climate tiles → climate domain
- Light/dimmer tiles → lights domain
- Media player tiles → media domain
- Cover/blind/curtain tiles → covers domain
- Scene tiles → scenes domain
- Everything else → overview/status

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Examine the existing display, page, and tile data models to understand the input structure.
- Keep changes scoped to backend only.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
