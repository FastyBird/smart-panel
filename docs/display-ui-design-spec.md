# Display UI design specification

> **Status:** approved on 2026-11-21 after the round 1 design pass. Implementation is tracked in
> [`tasks/epics/EPIC-DISPLAY-UI-REDESIGN.md`](../tasks/epics/EPIC-DISPLAY-UI-REDESIGN.md).
>
> **Scope:** the Flutter wall display app (`apps/panel/`) and every panel plugin. The admin has its own spec,
> [`admin-ui-design-spec.md`](admin-ui-design-spec.md); both apps share neutrals, status and domain colours.
>
> **Sources:** the design canvas (43 boards on 15 pages: foundations, every screen at the square, XS, S, M, M+ and L
> sizes in light and dark, and live components with tweaks on the "Parts" page) and the designer's implementation
> handoff. Both are claude.ai artifacts shared with maintainers:
> [design canvas](https://claude.ai/artifact/FQoV2qkzQQoWJ69KKMwxRR),
> [implementation handoff](https://claude.ai/artifact/QuwdMXfeft5sfVn3VaP46L). This file is the repo copy of the
> handoff and is authoritative when they differ. The round 1 brief is archived in
> [`archive/2026-11-21-display-ui-design-brief.md`](archive/2026-11-21-display-ui-design-brief.md).
>
> **Token file:** `apps/panel/lib/core/utils/theme.dart` becomes the source for every value in §2 and §3 (task DR-1).

## How to use this spec

- Read it before any change to a panel screen, shared widget in `apps/panel/lib/core/widgets/`, panel plugin UI or
  theme value.
- It **overrides** layout, colour, sizing and component choices in older documents, including the visual parts of
  [`display-app-design-spec.md`](display-app-design-spec.md) (§3, §4, §16) and feature task files. Those stay valid
  for behaviour: what appears when, data, states and feedback timings.
- The canvas shows how a screen looks; this spec says the rules that produce it. Real panels land between the
  artboards (§4), so build every layout as a function of the effective canvas, never as "on artboard M".
- The boards were built without rendering them. A clipped or overflowing board is a bug in the board, not intent:
  follow the rule in this spec and report the board.
- A state that is not drawn (§11) is composed from the templates in §7. Do not invent a new look for it.
- A screen not yet migrated may still look different. New work follows this spec; a change to an old screen moves it
  onto the redesign when practical.

## 1. Principles

- **Three colour jobs, kept apart.** The **app colour** (FastyBird red) is identity only. The **accent** does the
  interactive work and changes per room. **Status and domain colours** carry meaning and never change.
- **Same product as the admin.** Neutrals, status and domain colours are the admin's values. The display keeps its
  own strengths: the sky panel, large numerals, domain-tinted heroes and glanceability.
- **Density from millimetres.** One design pixel is 0.25–0.33 mm on every supported panel. The layout reads the
  resulting canvas; no rule uses the DPR.
- **One component per job.** One header, one slider, one switch, one list row, one overlay layout, one state template
  set. Stock Material widgets (`AppBar`, `ListTile`, `SwitchListTile`, `FilterChip`, `ActionChip`, `AlertDialog`) are
  not used on screens.
- **Short labels, details behind a tap.** Every status is a short label from §8; anything longer goes behind
  "Details".
- **Flat and cheap.** Cards have a 1 px `border.light` outline in both themes; light mode adds one soft shadow on
  sheets and overlays, dark mode uses surface steps instead. No blur anywhere. At most one translucent layer on screen (the weather card on the sky).
- **No keyboard for everyday control.** Numbers are set with sliders, dials, steppers or presets.
- **Security actions are deliberate.** Disarm and unlock always need a code or a confirmation.

## 2. Colour tokens

These replace the 12-family, 7-step palette in `theme.dart`. Light and dark values for every token.

### Surfaces, text, borders

| Token | Light | Dark | Use |
|---|---|---|---|
| `surface.page` | `#f3f4f6` | `#121315` | Behind cards |
| `surface.card` | `#ffffff` | `#1b1c1f` | Cards, tiles, deck bar and dock |
| `surface.raised` | `#ffffff` | `#232428` | Sheets, drawers, popups, overlay cards |
| `fill.base` | `#eceef1` | `#2a2b30` | Slider track, skeletons, unselected segments |
| `fill.light` | `#f6f7f9` | `#222327` | Buttons inside a card |
| `border.base` | `#dcdfe5` | `#33353a` | Outlined controls, dividers that must be seen |
| `border.light` | `#e8eaee` | `#2a2c30` | Card outline |
| `text.primary` | `#1b1f26` | `#e9eaec` | Values, titles, numerals |
| `text.secondary` | `#5b6270` | `#a2a7af` | Live-state line, units |
| `text.muted` | `#6e7581` | `#8a9099` | Captions, timestamps, on cards and raised surfaces only (4.2:1 on the light page); the smallest grey that passes AA there |
| `text.disabled` | `#8b919b` | `#6b7079` | Disabled, read-only and offline labels, always with an icon |
| `brand.app` | `#d9230f` | `#d9230f` | Logo, wordmark and the loading spinner only |

Text placed directly on `surface.page` uses `text.secondary` or darker.

Dark mode is built for a dark room, not inverted: surfaces step up in lightness with elevation (page, card, raised),
cards get a hairline border instead of a shadow, and every status and domain colour switches to its lighter text
shade.

### Status

The fill is the same in both themes and takes white text. The light ok soft is `#e9f4ea`, one step lighter than
the admin's `#e8f3e9`, which is 4.499:1 under ok text and so misses AA.

| Status | Fill | Text L | Soft L | Border L | Text D | Soft D | Border D | Use |
|---|---|---|---|---|---|---|---|---|
| ok | `#2e7d32` | `#2e7d32` | `#e9f4ea` | `#c5e1c7` | `#6cc070` | `#1d2e1f` | `#2c4a2f` | Confirmed, locked, closed, online |
| warning | `#b25e00` | `#a35600` | `#fdf1e2` | `#f3d3a8` | `#f0a742` | `#33261a` | `#5a4223` | Partial, never confirmed, stale, battery low |
| danger | `#c62828` | `#c62828` | `#fbeaea` | `#f0bcbc` | `#f2706b` | `#3a1f1f` | `#5e2c2c` | Failed, triggered, offline, destructive actions |
| info | `#5b6675` | `#5b6675` | `#eef0f3` | `#d6dae0` | `#a3acb9` | `#272a2f` | `#3a3e45` | Unknown, paused, neutral notices (grey, not blue) |

Danger `#c62828` is visibly cooler and darker than the brand red and always comes with an icon and a label.

### Domains

One colour per domain on nav tabs, room cards, headers and heroes. A domain colour only ever appears together with
its domain icon.

| Domain | Light | Soft L | Dark | Soft D |
|---|---|---|---|---|
| Lights | `#a35600` | `#fdf1e2` | `#f0a742` | `#33261a` |
| Climate | `#0277a8` | `#e3f2fa` | `#4fb3e8` | `#16293a` |
| Shading | `#00796b` | `#e0f2f1` | `#4db6ac` | `#14302d` |
| Media | `#c2185b` | `#fce4ec` | `#f06292` | `#3a1a28` |
| Sensors | `#00838f` | `#e0f7fa` | `#4dd0e1` | `#133236` |
| Energy | `#2e7d32` | `#e9f4ea` | `#6cc070` | `#1d2e1f` |
| Cameras | `#3949ab` | `#e8eaf6` | `#7986cb` | `#1f2340` |

- Media moves from red to magenta, so playing music no longer looks like an alarm.
- Climate on its light soft tint is 4.4:1: use it there for icons only. Text on any soft tile uses `text.primary`.
- A filled control in a domain or status colour (white label) uses the **light** value as its fill in both themes.
  The dark value is for text and icons on dark surfaces; white on it fails AA.
- The thermostat dial uses `#c2571a` (light) and `#f0915a` (dark) for heating, and the Climate colour for cooling.

### Accents

Eight palettes. Each has four steps per theme: **fill** (white text on it), **text** (on a surface), **soft** (tinted
background) and a **pressed** shade derived from fill. All fills pass AA with white text; all text shades pass AA on
the card and on their own soft. **Blue is the default.**

| Accent | Fill L / text L | Soft L | Fill D | Text D | Soft D | Suggested room |
|---|---|---|---|---|---|---|
| Blue | `#2563c9` | `#e9effa` | `#3570d8` | `#8ab4f8` | `#212e48` | default |
| Teal | `#0f766e` | `#e7f1f0` | `#12857c` | `#5fd0c5` | `#193333` | bathroom |
| Sage | `#55702f` | `#eef1ea` | `#5f7d36` | `#b3cf85` | `#2a3124` | garden room |
| Terracotta | `#b04a26` | `#f7ede9` | `#b85230` | `#f2a685` | `#3e2823` | kitchen |
| Rose | `#a3476f` | `#f6edf1` | `#ad4f78` | `#f0a3c2` | `#3b2733` | bedroom |
| Violet | `#6247c4` | `#efedf9` | `#6e54d0` | `#b9a8f7` | `#2d2846` | office |
| Sand | `#7a6248` | `#f2efed` | `#846b50` | `#d9bf9f` | `#322d2a` | living room |
| Graphite | `#4a5261` | `#edeeef` | `#5a6375` | `#b6bfcd` | `#292c32` | hallway |

Amber and red are left out because they are warning and danger; green is replaced by a muted sage so it cannot read as
"ok".

**The accent colours:** primary buttons, the active deck tab and dock item, the selected room mode and arm segment,
selection and focus, switches, slider thumbs and steppers **outside** a domain view, the Buddy button and the screen
saver digits.

**The accent never colours:** status, the domain colours (including sliders and selected quick actions inside a
domain card or view), alert overlays and alarm screens, or the logo.

**Where it is set:** a colour on the space is the default for every panel in that space; each panel can override it
in Settings › Display with a swatch picker that has a "Room default" entry. The space and display fields are backend
work (§10); until they exist the panel stores its own choice locally.

### Sky

The sky panel is a three-stop vertical gradient with one text colour that passes 4.5:1 at every stop. Four of the 40
time-of-day and weather combinations are drawn; the rest are still to define (§11). Until they are, map every
combination onto the nearest drawn one: day with no precipitation → Day clear, day with precipitation or fog → Day
rain, sunrise and sunset → Dusk, night → Night.

| Sky | Gradient stops (top → bottom) | Text | Weather card fill |
|---|---|---|---|
| Day, clear or partly cloudy | `#7fb4ea` `#b9d9f5` `#e4f1fb` | `#10263f` | white 62 % |
| Day, rain | `#9aa5b1` `#c3cad2` `#dde1e6` | `#1b2430` | white 60 % |
| Dusk | `#252b55` `#5a3d6e` `#a85a55` | `#ffffff` | `#141028` 55 % |
| Night | `#0b1026` `#141c3d` `#1d2850` | `#eef1f8` | white 10 % |

The weather card is one flat translucent fill with no blur.

## 3. Type, spacing, radius, motion

### Fonts

| Face | Weights bundled | Use |
|---|---|---|
| Roboto | 400, 500, 700 | Everything with letters in it, and every number below 18 px. Labels use 500. |
| Barlow Semi Condensed | 300, 500 | Numerals of 18 px and larger: card values (500), hero numerals and clocks (300). |

Barlow Semi Condensed (SIL Open Font License) replaces the single-weight DIN 1451, which cannot render the weight 300
the clock and hero numerals need. It is the face the canvas uses. DIN 1451 is removed once nothing references it
(task DR-24). Roboto Medium (500) is added; today only 400 and 700 are bundled.

### Type scale

| Size | Face | Use |
|---|---|---|
| 10 / 500 | Roboto | Caption, status line, unit. The smallest size; the 8 px step is retired. |
| 12 / 500 | Roboto | Body, tile name, chip and button label |
| 14 / 500 | Roboto | List row title, card title on Expanded, header title on Compact |
| 16 / 500 | Roboto | Page header title (Regular) |
| 18 / 500 | Roboto | Page header title (Expanded) |
| 20 / 500 | Roboto | Overlay and sheet title |
| 18–28 / 500 | Barlow | Card value (28 on Expanded) |
| 48–160 / 300 | Barlow | Domain hero numeral, sized from the height left over |
| 48 / 72 / 96 / 300 | Barlow | Sky clock on Compact / Regular / Expanded |

### Spacing, radius, elevation, motion

| Group | Values | Rule |
|---|---|---|
| Spacing | 2, 4, 6, 8, 12, 16, 24, 32 | Adds 6, 12 and 24 to today's scale. Page padding and gaps: **6** Compact, **8** Regular, **12** Expanded. |
| Radius | 4, 6, 8, 12, pill | 4 badges · 6 buttons inside a card and icon tiles · 8 cards, tiles, chips, controls · 12 dock, sheets, drawers, overlays · pill scene and status pills. Cards move from 6 to 8. |
| Elevation | border, one shadow | Cards: 1 px `border.light` in both themes, no shadow. Sheets and overlays: one soft shadow in light, surface steps in dark. |
| Motion | 100, 200, 300 ms | Unchanged. Fades for routes; adjacent deck pages slide. |

## 4. Size system

Density comes from millimetres, the layout reads the resulting canvas, and the size class comes from the canvas's
short side. No rule uses the DPR.

1. **Density.** Take the smallest step of **0.85, 1.0, 1.15, 1.3, 1.5** that makes one design px at least 0.25 mm.
   One design px at density 1.0 is `2 × 25.4 / ppi` mm, so the rule is: the smallest step ≥ `ppi / 203.2`, clamped to
   0.85–1.5.
2. **Effective canvas.** `physical px ÷ 2 ÷ density`. This is what layouts measure.
3. **Class.** Short side **under 340** is **Compact**, **340–479** is **Regular**, **480 and over** is **Expanded**.
   Orientation is a separate axis. A canvas with equal sides under 340 uses the **square** rules.

The scaling formula in code does not change shape: `logical size = design value × (2 / DPR) × density`. Only the
density changes, from a three-value enum picked by DPR to the step above. Widgets that bypass `ScreenService.scale()`
(stock Material widgets) do not scale; the component tasks remove them.

**Where ppi comes from.** No platform channel is needed:

- **flutter-pi** computes `DPR = 10 × px / (width_mm × 38)` from the millimetres the panel reports, so
  `ppi = 96.52 × DPR`. `FB_DISPLAY_DIMENSIONS` keeps working and now has a real effect.
- **Android** reports `DPR = densityDpi / 160`, so `ppi = 160 × DPR` (the OS density bucket).
- An installer override (`FB_DISPLAY_DENSITY`, accepting a step value; today's `compact`, `normal` and `large` map to
  0.85, 1.0 and 1.15) wins over both.

`spec/displays/screen_breakpoints.json`, its generator `apps/panel/tools/build_screen_breakpoints_spec.dart` and the
melos step are retired. The dashboard grid (`spec/displays/grid.json`) is unchanged.

### Supported panels

Portworld resolutions for the 8″, 10.1″, 11.6″ and 14″ panels are assumed and must be confirmed against datasheets.

| Panel | Physical px | ppi | Density | Effective canvas | Class | 36 px target |
|---|---|---|---|---|---|---|
| 4″ square (YC-SM06E) | 480 × 480 | 170 | 0.85 | 282 × 282 | Compact, square | 9.2 mm |
| 4″ tall (YC-SM41P) | 480 × 800 | 233 | 1.15 | 209 × 348 | Compact | 9.0 mm |
| 7″ basic (Pi Touch Display v1) | 800 × 480 | 133 | 0.85 | 471 × 282 | Compact | 11.7 mm |
| 7″ WSVGA | 1024 × 600 | 170 | 0.85 | 602 × 353 | Regular | 9.2 mm |
| 5″ HD (reTerminal) | 1280 × 720 | 294 | 1.5 | 427 × 240 | Compact | 9.3 mm |
| 7″ HD (Pi Touch Display 2) | 1280 × 720 | 210 | 1.15 | 557 × 313 | Compact | 10.0 mm |
| 8″ WXGA (SM08P) | 1280 × 800 | 189 | 1.0 | 640 × 400 | Regular | 9.7 mm |
| 10.1″ WXGA (YC-102P) | 1280 × 800 | 149 | 0.85 | 753 × 471 | Regular | 10.4 mm |
| 11.6″ Full HD | 1920 × 1080 | 190 | 1.0 | 960 × 540 | Expanded | 9.6 mm |
| 14″ Full HD | 1920 × 1080 | 157 | 0.85 | 1129 × 635 | Expanded | 9.9 mm |

Two consequences. Compact layouts must hold down to **208 px wide** (the 4″ tall panel). And the canvas's square
boards (240 × 240) are smaller than the real 4″ square (282 × 282), so they are the worst case.

The canvas artboards are checkpoints: Square 240 × 240, XS 400 × 240, S 512 × 300, M 640 × 360, M+ 640 × 400,
L 960 × 540, and their portrait versions.

### Physical floors

| Element | Millimetres | Design px at density 1.0 |
|---|---|---|
| Touch target, any tappable element in both directions | 9 | 36 |
| Primary control: arm, unlock, keypad key, hero slider thumb | 12 | 48 |
| Body text | 3.0 | 12 |
| Caption | 2.5 | 10 |
| Glance numeral at 1.5 m: clock, countdown | 12 | 48 |
| Hero numeral at 2 m | 16 | 64 |

Known misses on the 240 square: keypad keys are 42 × 54, the entry countdown is 36 px, and hero numerals beside the
role badge are 34 px. On Compact panels card values (18 px) and the room temperature line (10 px) do not meet the
1.5 m target; only the clock does.

### What changes per class

| Element | Compact | Regular | Expanded |
|---|---|---|---|
| Dock (landscape) | 44 wide, icons | 56 wide, icons | 84 wide, icon + label |
| Bar (portrait) | 44 high (40 on square), no labels | 52, label on the active tab | 56, label on the active tab |
| Page padding and gaps | 6 | 8 | 12 |
| Header | 36 high, title 14 | 40, title 16 | 48, title 18 |
| Sky panel | 38 % of width or 30–38 % of height, clock 48 | Same split, clock 72 | Same split, clock 96 |
| Scene pills | One scrolling row after the room mode button | On the sky (landscape), own row (portrait) | As Regular |
| Room mode | One button showing the current mode; opens the chooser | Chip row, details button, schedule and occupancy line | As Regular |
| Automations | Inside the mode chooser | Inside mode details | Listed on the overview with switches |
| Domain cards | Icon + value; 3 quick actions if each is at least 36 wide, else 2; none on a square with more than two domains | Icon, title, state line, value, 3 quick actions | As Regular, value 28 |
| Room readings | One line in the weather card | Status strip under the cards | Status strip |
| Domain hero | Numeral 48–88; role badge dropped in landscape | Numeral up to 160 | As Regular |
| Secondary lists | Scroll; on the square behind a badge, header button or tabs | Beside or under the hero | As Regular |
| Lighting presets (device detail) | Dropped; the slider remains | Shown | Shown |
| Overlay card | Icon beside title, 2 alert rows | Icon above title, 3 alert rows | As Regular, larger |
| Overflow | Rows scroll sideways; nothing wraps | Mode chips and status pills scroll sideways | As Regular |

## 5. Components

Most designed components re-skin a widget in `apps/panel/lib/core/widgets/` (or a module widget named below); nine
are new. Confirm each row against the code before changing it, and keep the widget's public API where it can stay.

| Designed component | Existing widget | Change |
|---|---|---|
| Page header: icon tile, title, live-state line, actions | `PageHeader`, `HeaderMainIcon`, `HeaderIconButton` | Re-skin. One header for every screen. |
| Pushed-page header: back, icon, name, state | `AppTopBar`, Material `AppBar` | Replace both with the page header plus a back button. |
| Hero card: badge, numeral, slider, buttons | `HeroCard`, `BaseCard` | Re-skin. Numeral sized from the height left over. |
| Role, sensor and member tiles | `UniversalTile` | Re-skin. Horizontal in landscape, vertical in portrait. |
| Dashboard tiles: mini, row, big | `UniversalTile`, `ButtonTile`, the scene tile's Material `Card` | Re-skin; the scene tile moves onto the shared tile. |
| Mode chip and popup | `ModeSelector`, `IntentModeSelector` | Re-skin. The label always names the domain. |
| Room mode chip row and compact button | Stock `FilterChip`, `ActionChip` | Replace with the mode selector. |
| Segmented control: arm, range, theme, presets | `ModeSelector` (horizontal) | Re-skin. |
| Slider with thumb | `SliderWithSteps`, `CardSlider`, `SettingsSlider` | Re-skin; one slider. Step labels are dropped in favour of presets. |
| Thermostat dial | `CircularControlDial` | Re-skin. 240° arc, one or two thumbs, minus and plus at the foot. |
| Stepper: minus, plus | `ValueSelector` | Re-skin. |
| Switch | `IconSwitch`, `SettingsToggle`, stock `Switch` | Re-skin; one switch. |
| List row with one control | `SettingsTile`, `SettingsCard`, stock `ListTile`, `SwitchListTile` | Re-skin; replaces the stock tiles. |
| Section label | `SectionTitle`, `SectionHeading` | Re-skin; one style. |
| Alert banner | `AlertBanner` | Re-skin. |
| Toast | `Toast` | Re-skin. |
| Bottom sheet and right drawer | `DeckItemSheet`, `DeckItemDrawer` | Re-skin. |
| Selection and confirm dialogs | `settings_selection_dialog.dart`, stock `AlertDialog` | Re-skin; selection dialogs lose their buttons (a tap selects and closes). |
| Overlay card and full screen | Overlay manager templates (`features/overlay`) | Re-skin; one layout for banner, card and full screen. |
| State template: error, empty, not configured, blocked | `DomainStateView` | Re-skin. |
| Loading skeleton | `DomainStateView` spinner | Replace the spinner with a layout-stable skeleton. |
| Offline treatment | `DeviceOfflineState` | Re-skin; the same on tile, hero and detail. |
| Power button | `DevicePowerButton` | Re-skin; lives in the header. |
| Deck bar and dock | Deck navigation in `modules/deck/` | Re-skin; adds the Settings entry and a slot for lock badges. |
| Layout shells | `PortraitViewLayout`, `LandscapeViewLayout`, `DevicePortraitLayout`, `DeviceLandscapeLayout` | Keep; drive them from the effective canvas and class. |
| Tile grids | `FixedGridSizeGrid`, `FixedTileSizeGrid` | Keep. |
| Flip clock | `FlipClock` | Re-skin; digits in the accent, drift for burn-in. |
| Icon tile | `IconContainer` | Re-skin. |
| Scroll edge masks | `HorizontalScrollWithGradient`, `VerticalScrollWithGradient` | Dropped in the designs; a clipped item hints at scroll. Keep if cheap. |
| Outcome indicator and details sheet | — | **New.** |
| Comfort preset selector and override picker | — | **New.** |
| Accent swatch picker | — | **New.** |
| Arm control and status ring | — | **New** (follow-up epic, §10). |
| PIN keypad (alarm and protection) | — | **New** (follow-up epic). |
| Countdown (exit and entry delay) | — | **New** (follow-up epic). |
| Camera tile, grid and live frame | — | **New** (UniFi Protect epic). |
| Call bar actions (mute, hang up) | — | **New** (follow-up epic). |
| Lock badge, unlocked pill, read-only state | — | **New** (follow-up epic). |

Every shared component is drawn in default, active, pressed, disabled, pending, never confirmed and offline where
relevant, in light and dark, at the three classes. The live components on the canvas page "Parts" have tweaks for
size, theme, accent and state.

## 6. Screens

The canvas page for each screen and the rules that are not obvious from the boards.

| Screen | Canvas page | Rules |
|---|---|---|
| **Room overview** | 2 · Room overview | Sky panel with clock and weather card; one **Room mode** control (domain cards show state, never a domain mode name); domain cards per §4; status strip (Regular, Expanded) or one line in the weather card (Compact). Holds at 208 px wide. Sparse and empty rooms keep the sky and show a state template. |
| **Lights, Climate, Shading** | 3 · Domain views | Hero card plus role tiles. Every domain mode control names its domain ("Lights mode: Relax"). Grouped covers show members and a **Mixed** value. Auxiliary-only climate shows "No heating or cooling in this room". Comfort presets and a running override sit in the Climate view. |
| **Navigation and overlays** | 4 · Navigation and overlays | Sheets, drawer, mode popup, loading skeleton, connection loss (banner → overlay → full screen), security alerts (2 rows Compact, 3 rows Regular and up, then "+N more"). One overlay layout for banner, card and full screen. |
| **Security, Entry** | 5 · Security, Entry, cameras | Status ring with the arming state, entry points with Locked / Closed / Open / Offline, events. Arm control, keypad, cameras and the doorbell are follow-up work (§10). |
| **Thermostat** | 6 · Thermostat | One dial for plain, native and virtual thermostats; one or two thumbs; minus and plus at the foot. Override picker with five durations replaces typed minutes. Diagnostics move into a read-only "Details" layer in plain language. No comfort configuration editing on the panel. |
| **Media, Sensors, Energy** | 7 · Media, Sensors, Energy | All Media body states and the "Media needs a live connection" block. "No devices" uses a **Check again** button, not pull to refresh. The Energy range picker sits inside the chart card (a header button on the square). |
| **Square 240 × 240** | 8 · Square | Every screen at the smallest panel; the worst case for §4. |
| **Device details** | 9 · Device details | Lighting, cover, TV, sensor, light and actuator groups, hardware inputs, lock, door, outlet, generic. The power button is in the header. Lighting presets are dropped on Compact. No typed values. |
| **Master and dashboards** | 10 · Master and dashboards | Master overview, tiles page, cards page, tile catalogue. The scene tile runs its scene on tap and the active scene takes the accent. |
| **Settings and weather** | 11 · Settings and weather | Every settings page, the accent picker in Settings › Display, selection dialogs without buttons, the weather detail. |
| **Startup** | 12 · Startup | Loading, discovery, room selection, fatal error. The app colour appears here. |
| **Screen protection** | 13 · Screen protection | Follow-up epic (§10). |
| **Buddy, idle, signage** | 14 · Buddy, idle, signage | Chat, voice overlay, deck layers, screen saver (flip clock in the accent), lock screen, signage board. Screen saver and signage shift their content by a few px every minute against burn-in. Signage has no deck and no controls and never sleeps. |

**Settings entry point.** Swipe down still opens Settings. Three visible entries are added: a gear at the foot of the
dock (landscape) or bar (portrait), Settings as an entry in the "All pages" sheet, and a pull handle at the top edge.

## 7. States and feedback

### Screen states

Every data-backed screen uses the same templates:

| State | Look |
|---|---|
| Loading | Layout-stable skeleton in `fill.base`; header and sky stay. No centred spinner. |
| Error | State template: icon, short title, one line, Retry. |
| Empty | State template: neutral icon, title, one line. |
| Not configured | Header stays; domain icon, title, one line that points to the admin. Distinct from empty. |
| Offline device | One treatment on tile, list row, hero and detail: "Offline · last seen 21:10", warning icon, controls dimmed to `text.disabled`. |
| Disconnected | Overlays per §6; values underneath stay, controls are paused ("Controls are paused. Values on screen may be out of date"). |

### Control feedback

Feedback levels and timings are unchanged ([`optimistic-ui-architecture.md`](optimistic-ui-architecture.md)). What
changes is the look:

- **Pending and settling:** the new value shows at once; the control shows the "Setting" outcome (refresh icon,
  `text.secondary`).
- **Never confirmed (MIXED):** a distinct warning look, "Not confirmed", never the same as settling.
- **Rollback:** the value snaps back and an error toast appears.
- Controls that give less feedback on purpose (room card quick actions, landscape role tiles, sheet toggles, media
  transport) change instantly and never lock.

### Outcome vocabulary

One outcome indicator (icon + short label, optional "Details" tap) and one details sheet for room modes, schedules,
groups and native thermostats.

| Outcome | Label | Icon and colour | Opens details |
|---|---|---|---|
| Sending, pending, accepted | Setting · Sent · waiting for the thermostat | Refresh, `text.secondary` | No |
| Confirmed, completed | Completed | Check, ok | No |
| Partial | Partial · 1 light did not answer | Alert, warning pill | Yes |
| Failed, refused | Failed · Refused | Alert, warning pill | Yes |
| Interrupted, superseded | Replaced by a newer request | Info | Yes |
| Timed out, unconfirmed, unknown | Not confirmed · Timed out · refresh before retrying | Alert, warning pill | Yes |
| Conflict | Changed elsewhere | Alert, warning pill | Yes |
| Mixed | Mixed | The word in place of the numeral | No |
| Unavailable, stale | No data · Last update 12 min ago · Not reporting | Alert or clock, warning | No |
| Offline | Offline · last seen 21:10 | Alert, warning; controls dim | No |

## 8. Copy

Every status is a short label; anything longer goes behind "Details". All strings live in the six `.arb` files in
`apps/panel/lib/l10n/`; none is hard-coded. Allow about 60 % expansion in short slots; names truncate and never push
a control off screen. Names in the samples (Anna, room and device names) are placeholders.

### Long sentences replaced

| Today | Short label | Details layer |
|---|---|---|
| "Selected · some commands could not complete" | Partial | Per-domain rows: Completed, Partial, No devices, Not supported |
| "OPEN/CLOSE confirms motion begun or an already reached endpoint, not full travel. STOP requires qualified stopped feedback." | (none on the hero) | "Results of the commands sent, not what the devices are doing now." |
| "User OFF is latched. Presets and automation cannot resume output." | Off | "Turned off here at 19:02. Stays off until someone turns it on." with a Turn on button |
| "Planned times are not device state" | Sleep at 22:30 | Same one-line note |
| Reported physical feedback: Unknown / Mixed | Mixed | Members list with each position |
| Virtual thermostat member evidence, latch, drain, quality | Heating · 2 of 3 radiators on | "Floor loop: Paused · dew point guard" |

### Labels by area

| Area | Labels |
|---|---|
| Room mode | Room mode · Completed · Sleep at 22:30 · Occupied · Mode details · Retry Relax |
| Automations | On · Suspended · triggered too often |
| Alarm | Disarmed · Arming away · Leave now. Armed in 45 s · Armed away · Armed night · Alarm · Disarmed · fault · Alarm offline · Cancel arming · Silence |
| Keypad | Entry delay · Enter your code to disarm · Wrong code. 2 tries left · Keypad locked · Too many wrong codes. Try again when the timer ends · Settings locked · Panel locked |
| Security confirmations | 2 entry points are open · Arm anyway · Unlock the front door? · It locks again by itself after 30 seconds · Disarmed by Anna |
| Entry points | Locked · Closed · Open · Offline |
| Doorbell and camera | Ringing · 21:47 · Answer · Unlock · Dismiss · Talking · 0:42 · Mute · Hang up · Live · HD · LIVE · 2 min ago · No image |
| Thermostat | Heating to 22.0° · Now 21.4° · Idle · Inside the range · nothing to do · Holding 22.5° until 15:30 · Keep 22.5° for · Until the schedule changes · Changed from another app at 20:14 · No data from the thermostat. Controls are paused |
| Climate, auxiliary only | No heating or cooling in this room · Air devices here work on their own |
| Media | Starting Watch · Done · Working · Waiting · No answer · Skipped · Watch started with a problem · Nothing is playing. Pick an activity · Media needs a live connection |
| Connection | Connection lost. Reconnecting · Reconnecting to the gateway · Controls are paused. Values on screen may be out of date · Can’t reach the gateway |
| Hardware inputs | Pressed · 2 min · Idle · On · Off (replacing hard-coded "Detected", "Idle", "ON", "OFF") |
| Light group | Turn on · Turn off · Brightness for all (replacing hard-coded "Reported power", "Apply together") |
| Screen protection | Locked on this panel · Settings, locked |
| Empty and not configured | Nothing to control here · This room is not set up yet · No media devices in this room · Media is not set up · No energy data yet · No tiles on this page yet · This page no longer exists |

## 9. Product decisions

| Question | Decision |
|---|---|
| Physical sizing | Accepted. Density per panel so one design px is 0.25–0.33 mm; floors in §4. |
| Room modes vs domain modes | One "Room mode" control on the overview. Domain cards show state, never a domain mode name. Every domain mode control names its domain. |
| Talk model | Tap to talk: one tap opens the line both ways. |
| Duress code | **Open.** Needs a product decision before the keypad is built. |
| Settings entry point | Visible: dock or bar gear, "All pages" entry, pull handle. Swipe down stays. |
| Signage | Designed as the end state: no deck, no controls, never sleeps. |
| Burn-in | Screen saver and signage shift their content by a few px every minute. |
| Numeral face | Barlow Semi Condensed 300 and 500, bundled (§3). |

### Where the design departs from the brief

| Topic | Brief | Design | Why |
|---|---|---|---|
| Compact boundary | Short side < 300 | Short side < 340 | The S artboard (300 short side) cannot hold the regular room overview; it needs about 310 px of content height. |
| Accent set | Blue, teal, green, amber, terracotta, rose, violet, graphite | Blue, teal, sage, terracotta, rose, violet, sand, graphite | Amber reads as warning and green as ok. |
| Energy range picker | Mode-control slot | Inside the chart card; a header button on the square | Stays visible while a range reloads. |
| Media "no devices" | Pull to refresh | A "Check again" button | A vertical pull fights the swipe down for Settings. |
| Lighting presets | On every size | Dropped on Compact | The slider remains; the hero numeral keeps its size. |
| Hero numeral weight | 200 | 300 | Survives low-contrast skies and distance. |
| Card radius | 6 | 8 | Matches the admin. |
| Smallest type | 8 | 10 | 8 px is under the 2.5 mm caption floor. |

### To verify against the code and hardware

- Portworld resolutions for the 8″, 10.1″, 11.6″ and 14″ panels (§4).
- The dock is drawn on the left in landscape. Keep the side the code uses today if it differs.
- The wake word and the version string on the Settings boards are placeholders.

## 10. New functionality and where it is tracked

The redesign epic covers the re-skin, the size system and the panel-only additions: per-panel accent (local), the
visible Settings entry, comfort presets and the override picker in the Climate view, the scene tile running its
scene, unlocking from the panel with a confirmation, and burn-in drift. Everything that needs backend work is a
separate epic built on this spec's components:

| Feature | Panel | Needs beyond the panel | Tracked in |
|---|---|---|---|
| Room accent colours | "Room default" in the picker, room colours in the Master list | A colour field on spaces and on displays | Follow-up epic |
| Arm and disarm | Arm control in Security, Entry and behind the overview's alarm pill | The existing writable arming state | Space security epic (#1287) and a follow-up alarm keypad epic |
| PIN keypad, wrong code, lockout | One keypad for alarm and protection | Codes in the backend: one house code or per-user codes | Follow-up alarm keypad epic |
| Exit delay | Countdown in the status ring, Cancel arming | An exit-delay state | Follow-up alarm keypad epic |
| Entry delay and triggered | Full-screen keypad on every panel, Silence, camera link | Existing pending, triggered and siren | Follow-up alarm keypad epic |
| Arming with open entry points | List of what is open, Arm anyway | A bypass on arming | Follow-up alarm keypad epic |
| Cameras | Tile, grid, full-screen view, snapshots with age | The cameras module | UniFi Protect epic (#1189, #1192) |
| Doorbell ring | Full-screen interrupt with Answer, Unlock, Dismiss; missed rings | Ring delivery to chosen panels | UniFi Protect epic (#1190) and a follow-up doorbell epic |
| Two-way talk | Tap to talk, Mute, Hang up | Audio path; panels with microphone and speaker | Follow-up doorbell epic |
| Screen protection | Lock badges, protected Settings and panel, unlocked session with auto-relock, read-only controls, guest mode | Per-display configuration in the admin | Follow-up epic |
| Signage content | Announcements, today and the RSS feed on the signage board | A content source for announcements | #1355, #1356 |

Not designed, though the brief lists them as possible work: album art in Media and a 12-hour clock.

## 11. Gaps

The first pass draws each screen's main composition and its most important states. These are not drawn; compose them
from §5 and §7 and add them to the canvas when a designer is available:

| Area | Not drawn yet |
|---|---|
| Room overview | Loading and error; room mode outcomes (partial, failed, interrupted, conflict, unavailable); schedule and occupancy variants; the mode chooser on Compact; the Buddy button on this screen; 36 of 40 sky combinations |
| Domain views | Loading, error, not configured, rollback; role list sheet; Lights capabilities other than brightness and the on/off-only role; Climate cooler-only, system off and the room temperature notice; comfort preset change on Compact landscape |
| Navigation and overlays | Ring over an entry-delay banner; system action overlays (restart, power off, reset in progress, done, failed); error toasts; inactivity handling |
| Security, Entry, cameras | Speaker volume and visitor level in the call; doorbell device detail; "answered on another panel" and "no camera"; "camera hidden on this panel"; camera connection states; several alarm systems; unconfigured house modes; square list views for the Security tabs |
| Thermostat | Fan mode and speed for air conditioners; picker and details as a real sheet or drawer; copy for "refused" and "unknown" |
| Media, Sensors, Energy | Remote; devices and source sheets; Sensors filter popup; Top consumers sheet; net import; standalone Energy; chart gridlines and value labels |
| Device details | Colour temperature, hue, saturation and white sliders; sticky channel selector; cover types other than the roller shutter; tilt as a control; TV remote and source sheet; sensor events; air devices; camera, doorbell and alarm details; pump, robot vacuum, sprinkler, switcher, valve, water heater; pending and never confirmed per device |
| Master and dashboards | Master loading, error and no scenes; scenes on the square Master; icon tap versus body tap on device tiles; the device-detail page type; grid derived from a target tile size |
| Settings and weather | Speaker-only and microphone-only Audio; microphone unavailable; accent "following the room"; restart and power-off confirmations; About loading and error; Weather with no locations; weather detail loading, not configured and no data |
| Screen protection | Lock badge on tiles and in "All pages"; hidden device details; read-only on device detail screens |
| Buddy, idle, signage | Chat loading and initialisation failed; wake word "Processing"; live level feedback in voice input; 12-hour time and an AM/PM slot on the flip clock |

The variant matrix is also incomplete: most screens have XS, M and L; S and M+ exist only for the room overview.

## 12. Migration plan

Tracked in [`EPIC-DISPLAY-UI-REDESIGN`](../tasks/epics/EPIC-DISPLAY-UI-REDESIGN.md).

1. **Foundations.** Tokens and fonts with adapters for the old names, so unmigrated screens keep compiling; the size
   system; the accent scope and picker.
2. **Shared components.** Header, cards and tiles, controls, lists and dialogs, state templates and the outcome
   indicator, deck bar and dock. Each with widget tests and a debug gallery entry.
3. **Screens,** in the brief's priority order. Each screen task covers portrait and landscape, the three classes and
   the square, light and dark, and all six locales.
4. **Clean-up and verification.** The legacy colour families, DIN 1451 and the old size getters are removed, and the
   redesign is checked on real panels.

## Related documents

- [`display-app-design-spec.md`](display-app-design-spec.md): behaviour reference for every screen and rule.
- [`admin-ui-design-spec.md`](admin-ui-design-spec.md): the admin design system this one shares colours with.
- [`optimistic-ui-architecture.md`](optimistic-ui-architecture.md): feedback levels and timings.
- [`space-activity-modes.md`](space-activity-modes.md): room modes, schedules, occupancy.
- [`climate-architecture.md`](climate-architecture.md), [`media-architecture.md`](media-architecture.md),
  [`cameras-architecture.md`](cameras-architecture.md).
- [`archive/2026-11-21-display-ui-design-brief.md`](archive/2026-11-21-display-ui-design-brief.md): the round 1
  brief, with the current-state analysis and the screen catalogue.
