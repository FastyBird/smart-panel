# Task: Display UI redesign

ID: EPIC-DISPLAY-UI-REDESIGN
Type: epic
Scope: panel
Size: large
Parent: (none)
Status: in-progress
Created: 2026-11-21
GitHub: #1710 (milestone: Display UI redesign)

## 1. Business goal

In order to read and control my home at a glance on any supported wall panel, from a 4" square to a 14" screen,
As a household member,
I want every display screen to follow one design system that matches the admin, scales to the panel's physical size
and takes my room's accent colour.

## 2. Context

- **Design spec (authoritative):** [`docs/display-ui-design-spec.md`](../../docs/display-ui-design-spec.md). It holds
  the tokens, fonts, size system, component mapping, screen rules, state templates, copy and the migration plan. Read
  it before any task in this epic.
- **Behaviour reference:** [`docs/display-app-design-spec.md`](../../docs/display-app-design-spec.md). What appears
  when, data, states and feedback timings stay as described there.
- **Visual source:** the design canvas linked from the spec (43 boards on 15 pages: foundations, every screen at the
  square, XS, S, M, M+ and L sizes, light and dark, and live components on the "Parts" page).
- **Round 1 brief:** [`docs/archive/2026-11-21-display-ui-design-brief.md`](../../docs/archive/2026-11-21-display-ui-design-brief.md),
  with the current-state analysis (§3.3 sizing problems, §9 drift).
- The admin redesign ([`EPIC-ADMIN-UI-REDESIGN`](EPIC-ADMIN-UI-REDESIGN.md)) set the shared neutrals, status and
  domain colours.

## 3. Scope

**In scope**

- Tokens and fonts, the size system (density from ppi, effective canvas, size classes) and the accent palettes with
  a per-panel picker stored locally.
- Design system checks for hard-coded colours, font sizes and stock Material widgets.
- The shared components in `apps/panel/lib/core/widgets/` and the deck, settings and overlay widgets that re-skin
  them (spec §5).
- Every screen in spec §6 except screen protection, on all panel sizes, light and dark, in all six locales.
- Panel-only additions: the visible Settings entry, comfort presets and the override picker in the Climate view, the
  scene tile running its scene, unlocking from the panel with a confirmation, burn-in drift.

**Out of scope** (separate epics, built on this epic's components; spec §10)

- Room accent colours from the backend (a colour field on spaces and displays).
- Alarm keypad: arm and disarm, PIN codes, exit and entry delays, bypass, triggered interrupts, the duress decision.
  Builds on the Space security epic (#1287).
- Cameras on the panel: the UniFi Protect epic (#1189, #1190, #1192).
- Doorbell ring delivery and two-way talk.
- Screen protection.
- Signage announcements and the RSS feed (#1355, #1356); they follow this spec.
- Album art and a 12-hour clock (not designed).

## 4. Acceptance criteria

- [ ] Phase 1, foundations: tokens and fonts in `theme.dart` with adapters for the old names; density from ppi and
      Compact / Regular / Expanded from the effective canvas; accent palettes and picker; design system checks in
      warn mode.
- [ ] Phase 2, shared components: each re-skinned or new component built with widget tests and shown in the debug
      gallery, at the three classes, light and dark.
- [ ] Phase 3, screens: every screen in spec §6 (except screen protection) on the redesign.
- [ ] Phase 4, clean-up: legacy colour families, DIN 1451 and the old size getters removed; checks are errors
      everywhere; verified on real panels.
- [ ] Every migrated screen keeps the behaviour in `display-app-design-spec.md`, works from 208 px wide to
      1129 × 635, in portrait and landscape, on the square, in light and dark and in three accents.

## 5. Tasks

Sub-issues of #1710 in the [Display UI redesign](https://github.com/FastyBird/smart-panel/milestone/22) milestone. PR titles are the issue titles. The issue bodies
carry the full acceptance criteria; the notes below are the summary. Every task that changes screens is checked at
the square 240, XS, S, M, M+ and L (portrait and landscape where the screen has both) in light and dark, keeps the
behaviour in `display-app-design-spec.md`, and updates all six locales.

| ID | Issue | Phase | Task | Depends on | Status |
|---|---|---|---|---|---|
| DR-1 | #1711 | 1 | `feat(panel): adopt the redesign colour tokens and fonts` | — | done |
| DR-2 | #1712 | 1 | `feat(panel): derive density from pixel density and size classes from the effective canvas` | — | done |
| DR-3 | #1713 | 1 | `feat(panel): add the accent palettes and the accent picker` | DR-1 | done |
| DR-4 | #1714 | 1 | `chore(panel): add the design system checks and a component gallery` | DR-1 | done |
| DR-5 | #1715 | 2 | `feat(panel): add one page header for every screen type` | DR-1, DR-2 | done |
| DR-6 | #1716 | 2 | `feat(panel): re-skin cards, the hero card and tiles` | DR-1, DR-2 | done |
| DR-7 | #1717 | 2 | `feat(panel): add one slider, switch, stepper, segmented control and mode chip` | DR-1, DR-2, DR-3 | done |
| DR-8 | #1718 | 2 | `feat(panel): re-skin list rows, sheets, drawers, dialogs, toasts and banners` | DR-1, DR-2, DR-3 | done |
| DR-9 | #1719 | 2 | `feat(panel): add state templates, loading skeletons and the outcome indicator` | DR-1, DR-2, DR-8 | done |
| DR-10 | #1720 | 2 | `feat(panel): re-skin the deck bar and dock and add a visible settings entry` | DR-2, DR-3, DR-8 | in review |
| DR-11 | #1721 | 3 | `feat(panel): move the room overview onto the redesign` | DR-5, DR-6, DR-7, DR-9, DR-10 | open |
| DR-12 | #1722 | 3 | `feat(panel): move the lights, climate and shading views onto the redesign` | DR-5, DR-6, DR-7, DR-9 | open |
| DR-13 | #1723 | 3 | `feat(panel): move overlays and interrupts onto one overlay layout` | DR-8, DR-9 | open |
| DR-14 | #1724 | 3 | `feat(panel): move the security view and entry overview onto the redesign` | DR-5, DR-6, DR-9 | open |
| DR-15 | #1725 | 3 | `feat(panel): move thermostat control onto one dial layout` | DR-7, DR-8, DR-9, DR-12 | open |
| DR-16 | #1726 | 3 | `feat(panel): move the media, sensors and energy views onto the redesign` | DR-5, DR-6, DR-7, DR-9 | open |
| DR-17 | #1727 | 3 | `feat(panel): move lighting, cover, media and sensor device details onto the redesign` | DR-5 … DR-9 | open |
| DR-18 | #1728 | 3 | `feat(panel): move the remaining device details onto the redesign` | DR-17 | open |
| DR-19 | #1729 | 3 | `feat(panel): unlock doors from the panel with a confirmation` | DR-8, DR-14, DR-18 | open |
| DR-20 | #1730 | 3 | `feat(panel): move the master overview and dashboard pages onto the redesign` | DR-6, DR-9, DR-10 | open |
| DR-21 | #1731 | 3 | `feat(panel): move settings and the weather detail onto the redesign` | DR-3, DR-7, DR-8, DR-9 | open |
| DR-22 | #1732 | 3 | `feat(panel): move startup, discovery and room selection onto the redesign` | DR-1, DR-2, DR-9 | open |
| DR-23 | #1733 | 3 | `feat(panel): move buddy, the screen saver, the lock screen and signage onto the redesign` | DR-3, DR-9, DR-13 | open |
| DR-24 | #1734 | 4 | `chore(panel): remove the legacy theme, DIN 1451 and the old size getters` | DR-11 … DR-23 | open |
| DR-25 | #1735 | 4 | Integrated verification on real panels | DR-24 | open |

### Execution order

1. **Phase 1:** DR-1 and DR-2 in parallel; DR-3 and DR-4 after DR-1.
2. **Phase 2:** DR-5, DR-6 and DR-7 in parallel after phase 1; DR-8 after DR-3; DR-9 after DR-8; DR-10 after DR-8.
3. **Phase 3:** DR-11 (the flagship and reference screen) first, then the rest in the brief's priority order once
   their dependencies merge: DR-12, DR-13, DR-14, DR-15, DR-16, DR-17 → DR-18 → DR-19, DR-20, DR-21, DR-22, DR-23.
4. **Phase 4:** DR-24 after every screen task; DR-25 closes the epic.

A task that migrates a folder switches that folder's design system checks to errors in the same PR. Keep each PR to
one component group or one screen group.

### Issue summaries

**DR-1 — adopt the redesign colour tokens and fonts**
The panel runs on the approved palette: the admin's neutrals, status and domain colours, Media in magenta, cards with
radius 8, 10 px as the smallest type, and Barlow Semi Condensed for numerals. Layouts do not change yet. The old
`ThemeColors`, `ThemeColorFamily`, `AppColorsLight` and `AppColorsDark` names keep working as adapters onto the new
tokens, so unmigrated screens compile and only change colour. Files: `apps/panel/lib/core/utils/theme.dart`,
`apps/panel/pubspec.yaml`, `apps/panel/assets/fonts/` (Roboto Medium, Barlow Semi Condensed 300 and 500, with the OFL
licence), widgets that pick the media domain colour. Spec: §1, §2 (all but accents and sky), §3.

**DR-2 — derive density from pixel density and size classes from the effective canvas**
Two panels that show the same amount of content get the same layout, and a high-density panel such as the reTerminal
gets a larger density instead of a compact one. `VisualDensityService` picks the density step from ppi
(`96.52 × DPR` on flutter-pi, `160 × DPR` on Android, `FB_DISPLAY_DENSITY` override); `ScreenService` exposes the
effective canvas, `sizeClass` (Compact, Regular, Expanded), orientation and `isSquare`; `isSmallScreen`,
`isMediumScreen`, `isLargeScreen` and `isAtLeast*` map onto the new classes and are marked deprecated. Unit tests
cover every row of the spec's panel table. Files: `apps/panel/lib/core/services/{screen,visual_density,startup_manager}.dart`,
`apps/panel/lib/core/utils/screen_layout.dart`, `spec/displays/screen_breakpoints.json` and
`apps/panel/tools/build_screen_breakpoints_spec.dart` (deleted), `apps/panel/lib/spec/screen_breakpoints.g.dart`
(deleted), `melos.yaml`, the website's display install page. Spec: §4.

**DR-3 — add the accent palettes and the accent picker**
Each panel can take one of eight accents, blue by default, and everything interactive outside a domain view follows
it. An `AccentScope` provides the current palette (fill, text, soft, pressed per theme); the choice is a local
preference set with a swatch picker in Settings › Display, with live preview. Files: `apps/panel/lib/core/utils/theme.dart`,
new `apps/panel/lib/core/widgets/accent_*.dart`, `apps/panel/lib/core/services/local_preferences.dart`,
`apps/panel/lib/features/settings/presentation/pages/display_settings.dart`, l10n. Spec: §2 (accents), §5 (accent
swatch picker).

**DR-4 — add the design system checks and a component gallery**
CI reports every place that breaks the design system, as warnings, and each later task can switch its folders to
errors with one config line: hex `Color(0x…)` outside `theme.dart`, raw `fontSize:` values, and stock `AppBar`,
`ListTile`, `SwitchListTile`, `ExpansionTile`, `FilterChip`, `ActionChip` and `AlertDialog` on screens. A debug-only component gallery renders each component at a chosen class, theme and
accent; the component tasks add their entries to it. Files: `apps/panel/tools/check_design_system.dart` (new),
`apps/panel/lib/features/gallery/` (new, debug builds only), `melos.yaml`, the panel CI workflow. Spec: §1, §12.

**DR-5 — add one page header for every screen type**
Every screen, pushed or not, has the same header: icon tile, title, live-state line, actions, and a back button on
pushed pages, with heights per class. `AppTopBar` and the Material `AppBar` on group and thermostat screens are
retired. Files: `apps/panel/lib/core/widgets/{page_header,top_bar,icon_container}.dart`,
`apps/panel/lib/modules/devices/presentation/widgets/device_power_button.dart`, screens that use `AppTopBar` or
`AppBar`. Spec: §4 (header), §5.

**DR-6 — re-skin cards, the hero card and tiles**
Cards, the hero card and every tile share the new surfaces, radius 8, the domain tint rules and one offline
treatment; the hero numeral is sized from the height left over and clamped per class. Files:
`apps/panel/lib/core/widgets/{base_card,hero_card,universal_tile,button_tile,tile_wrappers}.dart`,
`apps/panel/lib/modules/devices/presentation/widgets/device_offline_overlay.dart`. Spec: §2 (domains), §4 (domain
cards, hero), §5, §7 (offline).

**DR-7 — add one slider, switch, stepper, segmented control and mode chip**
Every numeric control is one slider, one stepper or the dial; every toggle is one switch; every mode choice is one
segmented control or mode chip whose label names its domain. Domain colours inside domain views, the accent outside.
Files: `apps/panel/lib/core/widgets/{slider_with_steps,card_slider,icon_switch,value_selector,mode_selector,intent_mode_selector,circular_control_dial}.dart`,
`apps/panel/lib/features/settings/presentation/widgets/{settings_slider,settings_toggle}.dart`,
`apps/panel/lib/modules/deck/presentation/widgets/{deck_mode_chip,deck_mode_popup}.dart`. Spec: §2 (accent rules),
§5.

**DR-8 — re-skin list rows, sheets, drawers, dialogs, toasts and banners**
Lists, secondary layers and messages share one look: one list row with one control, one section label, the bottom
sheet and right drawer, confirm and selection dialogs (selection closes on tap), toasts and the alert banner. Files:
`apps/panel/lib/core/widgets/{section_heading,bottom_sheet_dialog,right_drawer,toast,alert_banner}.dart`,
`apps/panel/lib/modules/deck/presentation/widgets/{deck_item_sheet,deck_item_drawer}.dart`,
`apps/panel/lib/features/settings/presentation/widgets/{settings_tile,settings_card,settings_selection_dialog}.dart`.
Spec: §5.

**DR-9 — add state templates, loading skeletons and the outcome indicator**
Every data-backed screen has the same loading (layout-stable skeleton), error, empty, not configured and blocked
states, and every command outcome uses one indicator with an optional details sheet; never confirmed has its own
look. Files: `apps/panel/lib/modules/deck/presentation/widgets/domain_state_view.dart`, new
`apps/panel/lib/core/widgets/{skeleton,outcome_indicator,outcome_details_sheet}.dart`, l10n. Spec: §5, §7, §8
(outcome labels).

**DR-10 — re-skin the deck bar and dock and add a visible settings entry**
Navigation fits every class (dock 44 / 56 / 84, bar 44 / 52 / 56, 40 on the square), the active tab takes the accent,
and Settings is reachable without the hidden swipe: a gear in the dock or bar, an entry in "All pages" and a pull
handle. A slot for lock badges is left empty for the screen protection epic. Files:
`apps/panel/lib/modules/deck/presentation/{deck.dart,widgets/deck_bottom_nav_bar.dart,widgets/deck_side_dock.dart,widgets/deck_more_sheet.dart}`.
Spec: §4 (dock, bar), §6 (settings entry point).

**DR-11 — move the room overview onto the redesign**
The flagship screen follows the canvas at every size: sky panel and clock, one Room mode control (button on Compact,
chip row with details on Regular and up), domain cards with 2 or 3 quick actions, scene pills, status strip or
readings line, automations per class; sparse and empty rooms; it holds at 208 px wide. Files:
`apps/panel/lib/plugins/spaces-home-control/presentation/system_pages/room_overview.dart`,
`.../presentation/widgets/*`, `apps/panel/lib/modules/deck/presentation/widgets/sky/`. Spec: §2 (sky), §4, §6, §8
(room mode labels), §9 (room modes vs domain modes).

**DR-12 — move the lights, climate and shading views onto the redesign**
The three control-heavy domain views use the hero card, role tiles and the mode chip, including grouped covers with
Mixed and the auxiliary-only climate state. Files:
`apps/panel/lib/plugins/spaces-home-control/presentation/domain_pages/{lights,climate,shading}_domain_view.dart`,
`grouped_covers_room_controls.dart`, `widgets/climate_temperature_notice.dart`. Spec: §4 (domain hero, secondary
lists), §6, §8.

**DR-13 — move overlays and interrupts onto one overlay layout**
Banner, card and full-screen overlays share one layout in every colour scheme, with connection escalation and
security alerts (2 or 3 rows, then "+N more") and system action overlays composed from it. Files:
`apps/panel/lib/features/overlay/**`, `apps/panel/lib/core/services/connection_overlay_provider.dart`, the suggestion
toast in `apps/panel/lib/features/suggestions/**`. Spec: §4 (overlay card), §6, §7, §8 (connection labels).

**DR-14 — move the security view and entry overview onto the redesign**
Security and Entry show the status ring, entry points (Locked, Closed, Open, Offline) and events in the new layout.
The arm control and keypad come from the alarm keypad epic and must fit the layout this task builds. Files:
`apps/panel/lib/modules/security/presentation/**`, `apps/panel/lib/plugins/spaces-synthetic-entry/**`. Spec: §6, §8
(entry points). Coordinate with #1291.

**DR-15 — move thermostat control onto one dial layout**
Plain, native and virtual thermostats share one dial (one or two thumbs, minus and plus), comfort presets and a
running override with a five-option duration picker, and a read-only Details layer in plain language. Typed
temperatures and durations and comfort configuration editing are removed from the panel. Files:
`apps/panel/lib/modules/devices/presentation/device_details/{thermostat,native_thermostat,virtual_thermostat*}.dart`,
the comfort section of `climate_domain_view.dart`. Spec: §6, §8 (thermostat labels, long sentences replaced).

**DR-16 — move the media, sensors and energy views onto the redesign**
Media (every body state and the live connection block, "Check again" when no devices), Sensors and Energy (range
picker inside the chart card) follow the canvas. Files:
`apps/panel/lib/plugins/spaces-home-control/presentation/domain_pages/{media,sensors,energy}_domain_view.dart`,
`apps/panel/lib/modules/energy/presentation/**`. Spec: §6, §8 (media labels), §9 (departures).

**DR-17 — move lighting, cover, media and sensor device details onto the redesign**
The rich device details use the header with the power button, the hero card and the shared controls; lighting
presets are dropped on Compact. Files: `apps/panel/lib/modules/devices/presentation/device_details/{lighting,window_covering,media,television,speaker,av_receiver,set_top_box,projector,game_console,streaming_service,sensor}.dart`,
`apps/panel/lib/modules/devices/presentation/widgets/{device_portrait_layout,device_landscape_layout}.dart`. Spec:
§4, §5, §6.

**DR-18 — move the remaining device details onto the redesign**
Light and actuator groups, hardware inputs, lock, door, outlet, switcher, the air devices and the generic detail use
the same layout; hard-coded English and typed values are removed; placeholders become read-only details. Files: the
remaining files in `apps/panel/lib/modules/devices/presentation/device_details/`, device plugin detail widgets under
`apps/panel/lib/plugins/devices-*/`. Spec: §6, §8 (hardware inputs, light group).

**DR-19 — unlock doors from the panel with a confirmation**
A lock can be unlocked from Entry and the lock detail after a confirmation ("Unlock the front door?"); the panel
shows when it locks again. Files: `apps/panel/lib/modules/devices/presentation/device_details/lock.dart`, the entry
overview, l10n. Spec: §1 (security actions), §8 (security confirmations), §10.

**DR-20 — move the master overview and dashboard pages onto the redesign**
Master, the tiles and cards pages and every tile follow the canvas; the scene tile moves onto the shared tile and runs
its scene on tap. Files: `apps/panel/lib/plugins/spaces-synthetic-master/**`, `apps/panel/lib/plugins/{pages-*,tiles-*,data-sources-*}/**`,
`apps/panel/lib/modules/dashboard/**`. Spec: §5 (dashboard tiles), §6.

**DR-21 — move settings and the weather detail onto the redesign**
Every settings page uses list rows, switches and selection dialogs, and the weather detail follows the canvas.
Files: `apps/panel/lib/features/settings/**`, `apps/panel/lib/modules/weather/presentation/**`. Spec: §5, §6.

**DR-22 — move startup, discovery and room selection onto the redesign**
Loading, discovery, room selection and the fatal error show the app colour and the new state templates. Files:
`apps/panel/lib/features/discovery/**`, `apps/panel/lib/app/app/{body,error}.dart`. Spec: §2 (app colour), §6, §7.

**DR-23 — move buddy, the screen saver, the lock screen and signage onto the redesign**
Buddy chat and the voice overlay, the screen saver (flip clock in the accent) and the lock screen follow the canvas;
the screen saver and signage shift their content by a few px every minute; signage has no deck and never sleeps.
Announcements and the RSS feed are #1355 and #1356. Files: `apps/panel/lib/modules/buddy/presentation/**`,
`apps/panel/lib/modules/displays/presentation/screen_saver.dart`, `apps/panel/lib/core/widgets/flip_clock.dart`,
`apps/panel/lib/plugins/spaces-signage-info-panel/**`. Spec: §6, §9 (burn-in, signage).

**DR-24 — remove the legacy theme, DIN 1451 and the old size getters**
The migration is finished and the checks keep it that way: the 12-family palette adapters, the DIN 1451 asset and
the deprecated size getters are gone, and every design system check is an error. Files:
`apps/panel/lib/core/utils/theme.dart`, `apps/panel/lib/core/services/screen.dart`, `apps/panel/pubspec.yaml`,
`apps/panel/assets/fonts/`, `apps/panel/tools/check_design_system.dart`, `docs/display-ui-design-spec.md`,
`docs/display-app-design-spec.md` (§3, §4, §16 point at the new spec). Spec: §12.

**DR-25 — display UI redesign integrated verification**
The redesign is checked as a whole on real panels before the epic closes: a Pi Touch Display v1 and 2, a reTerminal,
an 8" or 10.1" Android panel and the 4" square where available, plus the emulated sizes from the spec's panel table.
Portworld resolutions are confirmed and the spec updated. Files: none (verification only), `docs/display-ui-design-spec.md`
if a resolution differs.

## 6. Technical constraints

- Raspberry Pi 4 GPU budget: no blur, at most one translucent layer, no stacked shadows.
- Bundled assets only. New fonts are OFL or Apache licensed and their licences ship with the app.
- i18n: all six languages; allow about 60 % longer labels in short slots.
- Generated code (`apps/panel/lib/api/`, `apps/panel/lib/spec/`) is not edited by hand.

## 7. AI instructions

- Read [`docs/display-ui-design-spec.md`](../../docs/display-ui-design-spec.md) before any change in this epic, then
  the matching section of `display-app-design-spec.md` for behaviour.
- Open the canvas page named in spec §6 for the screen you change; when a board clips or overflows, follow the spec's
  rule and report the board.
- Where an older spec, plan or feature task describes panel layout or styling differently, the design spec wins.
- Keep each PR to one component group or one screen group, and add widget tests for non-trivial layout logic (class
  switches, quick-action counts, numeral sizing).
