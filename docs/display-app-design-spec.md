# Smart Panel — Display App Design Specification

> **Audience:** product designers producing a new visual design for the Smart Panel **display app** (the Flutter touch UI that runs on the wall panel).
>
> **Purpose:** describe *exactly* what the app does today — every screen, every state, every rule that decides whether something appears at all — so a new design can be dropped onto the existing functionality without losing behaviour.
>
> **Status:** describes the app as implemented in `apps/panel/`. Where something is a stub or known-incomplete, it is called out explicitly.
>
> **Companion documents:** `docs/architecture.md`, `docs/domains.md`, `docs/climate-architecture.md`, `docs/media-architecture.md`, `docs/optimistic-ui-architecture.md`, `docs/spaces-rooms-and-zones.md`, `docs/features.md`.

---

## Table of contents

1. [What the display app is](#1-what-the-display-app-is)
2. [Hardware & runtime reality](#2-hardware--runtime-reality)
3. [Scaling, breakpoints and orientation](#3-scaling-breakpoints-and-orientation)
4. [Design tokens](#4-design-tokens)
5. [Information architecture — the Deck](#5-information-architecture--the-deck)
6. [Navigation chrome and gestures](#6-navigation-chrome-and-gestures)
7. [Startup and provisioning flows](#7-startup-and-provisioning-flows)
8. [System views (per space type)](#8-system-views-per-space-type)
9. [Domain views](#9-domain-views)
10. [Security view](#10-security-view)
11. [Dashboard pages and tiles](#11-dashboard-pages-and-tiles)
12. [Device detail screens](#12-device-detail-screens)
13. [Settings](#13-settings)
14. [Buddy AI assistant and voice](#14-buddy-ai-assistant-and-voice)
15. [Overlays, interrupts and idle behaviour](#15-overlays-interrupts-and-idle-behaviour)
16. [Shared UI components (the de-facto design system)](#16-shared-ui-components-the-de-facto-design-system)
17. [State machine: loading, empty, error, not-configured, offline, pending](#17-state-machine-loading-empty-error-not-configured-offline-pending)
18. [What is optional — full conditional-visibility matrix](#18-what-is-optional--full-conditional-visibility-matrix)
19. [Worked examples from real installations](#19-worked-examples-from-real-installations)
20. [Localization, units and formatting](#20-localization-units-and-formatting)
21. [Constraints and non-negotiables for a new design](#21-constraints-and-non-negotiables-for-a-new-design)
22. [Deliverables checklist](#22-deliverables-checklist)

---

## 1. What the display app is

The display app is a **kiosk-mode, touch-only, always-on control surface** for one physical location. It is not a phone app; it never leaves the foreground, it has no OS chrome, and it usually sits on a wall at eye or chest height.

Three ideas drive everything:

1. **A display belongs to a space.** During first boot the panel is assigned to a *space* (a room, or a synthetic "whole-home"/"entry"/"signage" space). That single assignment decides which screens exist. A display in the living room shows living-room lights/climate/media; a display in the hallway can show the whole-house overview.

2. **Screens are generated, not authored.** Apart from optional user-designed dashboard pages, the panel builds its own screen list from what is actually installed and configured: which devices exist in the space, which roles have been assigned to them in the Admin, whether energy metering is available, and so on. **Almost nothing is hard-coded to be present** — the one exception is the **Security view**, which `buildDeck` appends to every initialized deck regardless of space type (including Zone and Signage panels). Everything else — every system view, every domain view, every dashboard page — is conditional. This is the single most important thing for a redesign: see §18.

3. **A flat, swipeable deck instead of a menu tree.** All top-level screens live in one horizontal carousel ("the deck"). Depth is reserved for detail pages, sheets and overlays.

The panel talks to a local backend over REST (Dio) + WebSocket (Socket.io). It is offline-tolerant but not offline-capable: without the backend it shows escalating connection states (§15.1).

---

## 2. Hardware & runtime reality

| | |
|---|---|
| **Framework** | Flutter (Dart). Single codebase. |
| **Primary targets** | **Android** (tablet / commercial wall panel) and **Linux via `flutter-pi`** (Raspberry Pi + DSI/HDMI touch panel). Build targets for iOS/macOS/Windows/web exist in the repo but are not product targets. |
| **Display mode** | `SystemUiMode.immersive` — full screen, no status bar, no navigation bar. **The app owns every pixel.** There is no OS-provided back gesture to rely on; there is also no safe-area notch on the typical panel, though `SafeArea` is used. |
| **Input** | Touch only. No mouse, **no hover states**, no physical keyboard. The on-screen keyboard appears only for the manual backend-URL field and the Buddy chat input. |
| **Haptics** | Used on Android for slider/toggle feedback (`HapticFeedback.selectionClick`, `lightImpact`, `mediumImpact`). Not available on flutter-pi. |
| **Typical panel sizes** | 5"–10" embedded panels (roughly 480×800 up to 1280×800 physical) and 10"–13" Android tablets. Both portrait-mounted and landscape-mounted installations exist and are equally supported. |
| **Fonts (bundled, no network)** | **Roboto** (Regular / Bold / Italic) — the app-wide default family. **DIN 1451** — the "data" face. See the note below for where it is actually used. |
| **Icon sets** | Material Design Icons (`material_design_icons_flutter`, referenced as `MdiIcons.*`) for everything; `weather_icons` (`BoxedIcon`) for meteorological glyphs on the sky panel and weather tiles. Space and device icons are resolved from backend-configured icon names with category fallbacks. |
| **Blur** | `BackdropFilter` is used in exactly **one** place: the frosted weather card on the sky panel (`sigma 16`). Everything else that looks like glass is flat alpha. Treat real blur as expensive on Pi. |
| **Assets** | No remote images, no CDN. Everything ships in the bundle. All imagery is icon-based, not photographic. **There is no network image loading anywhere in the panel** — no `Image.network`, no `NetworkImage`, no caching layer. (The channel spec defines an `artwork_url` property, but nothing consumes it; see §9.5.) |

**Where DIN 1451 is actually used.** It is *not* limited to hero numerals — it is applied wherever the app wants a "data readout" look, at every size:

**27 uses across 12 files** — the complete inventory:

| Surface | File | Uses |
|---|---|---|
| Lights / Climate / Shading domain hero values | 3 domain views | 1 each |
| **Lighting device-detail value** | `device_details/lighting.dart` | 1 |
| **Energy consumption card giant value** | `energy_consumption_card.dart` | 1 |
| Time tile | `tiles-time` | 2 (clock 90 + date 25) |
| Weather tile — forecast | `tiles-weather/forecast.dart` | 5 |
| Weather tile — current | `tiles-weather/weather.dart` | 3 |
| Weather data source — current | `data-sources-weather/weather_current.dart` | 3 |
| Weather data source — forecast day | `data-sources-weather/weather_forecast_day.dart` | 3 |
| **Device-channel data-source widget** | `data-sources-device-channel` | 4 — 12 px values, units, **and the loading / unavailable placeholder text** |
| **`ButtonTile` title + subtitle** | `core/widgets/button_tile.dart` | 2 — small dashboard-tile labels |

The last two rows are small-text uses that sit oddly next to Roboto body copy — treat them as an inventory item to decide on deliberately (unify on Roboto, or embrace DIN as the numeric/data face at all sizes) rather than as a rule to preserve blindly.

**Implication for design:** the app must render smoothly on a Raspberry Pi 4-class GPU at 30–60 fps. Prefer flat fills, gradients and simple shadows. Avoid stacked translucency, large blurs, per-frame shader work, and heavy shadow layering.

---

## 3. Scaling, breakpoints and orientation

### 3.1 The scaling model

Every dimension in the app is authored at a **DPR-2.0 baseline** and then scaled at runtime:

```
scaleFactor = 2.0 / devicePixelRatio
size        = designValue × scaleFactor × densityMultiplier
```

`densityMultiplier` comes from **visual density**: `compact = 0.85`, `normal = 1.0`, `large = 1.15`.

Two caveats a designer should know about density, because it is weaker than it looks:

- **It is a build-time choice, not a user setting.** Density is resolved once from the compile-time `FB_DISPLAY_DENSITY` value (`compact` / `normal` / `large`). When that is unset it falls back to **`compact` for DPR ≥ 2.5, `normal` otherwise**. There is no field on the display model and no runtime control — nothing in Settings changes it, and it never updates while the app is running.
- **It is not applied to every dimension.** The multiplier only reaches values that go through the density-aware token helpers (`AppSpacings.*`, `AppFontSize.*`, `AppBorderRadius.*`). Code that calls `ScreenService.scale(x)` directly gets `normal` regardless. So a `compact` build shrinks the token system but leaves ad-hoc dimensions untouched.

Practical consequence: **design against the DPR-2.0 baseline at `normal` density.** Treat `compact` as a global tightening of spacing/type on very high-DPR panels, not as a layout you need to redraw. When this document says "28 px" it means the design value that gets multiplied — that is the number to put in the design file.

### 3.2 Screen-size classes

Breakpoints use DPR-normalised width (physical px for DPR > 1.5, logical px otherwise) and depend on orientation:

| Class | Portrait width | Landscape width |
|---|---|---|
| **small** | ≤ 600 | ≤ 800 |
| **medium** | ≤ 800 | ≤ 1150 |
| **large** | > 800 | > 1150 |

The class changes real layout, not just type size. Common uses:

- **small** → labels hidden in the bottom nav; 2-column grids instead of 3; horizontal (compact) tiles instead of vertical tiles; smaller hero numerals (25 % of card height instead of 35 %); side dock 65 wide with no labels.
- **large** (landscape) → side dock 90 wide **with** labels; 3-column sensor grids; larger hero type.

### 3.3 Orientation

Orientation is derived from the physical screen dimensions and is **fixed per installation** (a wall panel does not rotate), but *both* orientations are fully implemented for every deck screen and the app reacts live to metric changes.

The two orientations are **not** the same layout reflowed. They are deliberately different compositions:

| | Portrait | Landscape |
|---|---|---|
| Deck navigation | Bottom bar (52 high) | Left side dock (65 / 90 wide) |
| Domain view body | Vertical stack: hero on top, secondary content below | Two columns: secondary content (flex 1) then hero (flex 2) |
| Mode control | Mode button on the right of the bottom bar → popup above | Mode chip in the page header → popup below |
| Room overview | Sky panel on top (40 % of height, max 500), content below | Sky panel on the left (42 % of width), content on the right |
| Sheets | Bottom sheet | Right drawer — **except the deck "More" sheet, which is a bottom sheet in both orientations** (§6.3) |

**Left-to-right order in landscape is: side dock → secondary column → main/hero column.**

### 3.4 Dashboard grid

User-designed pages use a unit grid. Defaults: **4 columns × 6 rows**. Unit size is derived from width: `÷4` up to 480, `÷6` up to 600, `÷8` up to 720, otherwise `÷10`. ⚠️ **There is no clamp.** `GridConfig` generates `minUnitSize`/`maxUnitSize` constants of 40 and 200, but nothing in the panel reads them — neither the width division nor an explicitly configured `tileSize` is bounded. Very narrow or very wide displays, and out-of-range configured sizes, are passed through as-is. A page can override rows/cols, or supply a `tileSize` — which is a **target, not an absolute**: it only picks how many rows/columns fit, and the container is then divided by those counts (see §11.1).

---

## 4. Design tokens

These are the tokens the code actually uses. A redesign may re-value them, but the *set* should stay recognisable so existing screens keep working.

### 4.1 Spacing (design px)

| Token | Value |
|---|---|
| `pXxs` | 1 |
| `pXs` | 2 |
| `pSm` | 4 |
| `pMd` | 8 |
| `pLg` | 16 |
| `pXl` | 32 |

`pMd` (8) is the workhorse: page padding, gaps between cards, header padding.

### 4.2 Radius

| Token | Value | Used for |
|---|---|---|
| `small` | 2 | Inline chips, swatches |
| `base` | 6 | Cards, tiles, buttons, pills — the default |
| `medium` | 12 | Popups, drawers, side dock, modal cards |
| `round` | 20 | Fully-rounded badges (hero badge, mode badge) |

### 4.3 Type scale (design px)

| Token | Value | Typical use |
|---|---|---|
| `extraExtraSmall` | 8 | Side dock labels |
| `extraSmall` | 10 | Pill text, subtitle items, tile status, badge counters |
| `small` | 12 | Header subtitle, card titles, secondary text |
| `base` | 14 | Body, list items, primary labels |
| `large` | 16 | Page header title, card primary values |
| `extraLarge` | 18 | Section emphasis, large icons |

Beyond the scale, several **display-size numerals** are computed, not tokenised:

- Hero value (lights / climate / shading): `cardHeight × 0.35` (or `× 0.25` on compact), clamped **48–160**, weight 200, `height: 0.7`, family **DIN1451**. Unit glyph = `0.27 ×` that size, positioned top-right; colour swatch = `0.22 ×`, bottom-right.
- Sky panel clock: **56** portrait (weight 100, tracking −1.5), **72** landscape (weight 200, tracking −2), **48** on compact landscape.
- Time tile: **90** (DIN1451 bold), date **25**.
- Signage clock: **120** (weight 200), date **28**.
- Screen-saver flip clock digits: **44**.

### 4.4 Colour system

Two full themes (light / dark). Colour is organised as **12 semantic families**, each with 7 steps:

`base`, `dark2`, `light3`, `light5`, `light7`, `light8`, `light9`

Families: `primary`, `success`, `warning`, `danger`, `error`, `info`, `neutral`, `flutter`, `teal`, `cyan`, `pink`, `indigo`.

Light-theme anchors:

| Family | base |
|---|---|
| primary | `#D9230F` (FastyBird red — the brand accent) |
| success | `#469408` |
| warning | `#D9831F` |
| danger / error | `#DB2828` |
| info | `#029ACF` |
| neutral | `#909399` |
| teal | `#26A69A` |
| cyan | `#00BCD4` |
| pink | `#E91E63` |
| indigo | `#3F51B5` |
| flutter | `#6200EE` |

Dark-theme anchors: primary `#A91B0C`, success `#67C23A`, warning `#E6A23C`, danger/error `#F56C6C`, info `#409EFF`, neutral `#909399`, teal `#4DB6AC`, cyan `#26C6DA`, pink `#F06292`, indigo `#5C6BC0`.

**Important inversion:** in dark mode the `lightN` steps get *darker*, not lighter. `light9` is always the faintest tint of the family against the current background, `light5` a mid tint, `base` the solid colour. Designs must supply both directions.

Surfaces:

| Role | Light | Dark |
|---|---|---|
| Page background | `#F2F3F5` | `#0A0A0A` |
| Card / base surface | `#FFFFFF` | `#141414` |
| Overlay surface (popups, dock) | `#FFFFFF` | `#1D1E1F` |
| Fill (subtle) | `#F0F2F5` base / `#F5F7FA` light / `#FAFAFA` lighter | `#303030` base / `#262727` light / `#1D1D1D` lighter |
| Border | `#E4E7ED` light / `#DCDFE6` base / `#CDD0D6` darker | `#414243` light / `#4C4D4F` base / `#636466` darker |
| Text primary / regular / secondary / placeholder / disabled | `#303133` / `#606266` / `#909399` / `#A8ABB2` / `#C0C4CC` | `#E5EAF3` / `#CFD3DC` / `#A3A6AD` / `#8D9095` / `#6C6E72` |
| Shadow | `rgba(0,0,0,.1)` light · `.2` medium · `.3` strong |

**Semantic colour bindings** (these are load-bearing, keep them):

| Concept | Family |
|---|---|
| Lights domain | `warning` |
| Climate domain | `info` |
| Shading domain | `teal` |
| Media domain | `danger` |
| Sensors domain | `cyan` |
| Energy domain | `success` |
| All lights on | `success` · all off → `neutral` · mixed → `warning` |
| Active alert | `danger` |
| Stale / offline sensor | `warning` |
| Nav active state | `primary` @ 15 % alpha fill, `primary` icon + label |

### 4.5 Motion

| Token | Duration | Use |
|---|---|---|
| `fast` | 100 ms | Icon swaps, micro-feedback |
| `standard` | 200 ms | Toggle/selection state, tile colour transitions |
| `slow` | 300 ms | Modals, page transitions |

Specific behaviours:
- **Route transitions are fades**, not slides (deliberate — cheaper on GPU). `easeOut`. This is installed **theme-wide**: both `AppTheme.lightTheme` and `AppTheme.darkTheme` set a `pageTransitionsTheme` whose builder is a fade for *every* `TargetPlatform`, and `MaterialPageRoute` resolves its transition through that theme. So ordinary pushes (device details, Buddy chat, weather detail, a room overview pushed from Master) all fade — there is no platform-specific slide anywhere inside the main app.
- **Deck adjacent page:** native `PageView` slide, 300 ms `easeInOut`.
- **Deck distant jump (> 1 page):** crossfade — fade out 150 ms → instant jump → fade in 150 ms. Swipe is disabled during the crossfade.
- **Nav tab expand/collapse:** `AnimatedSize` 250 ms `easeInOut`.
- **Nav auto-scroll to active tab:** 300 ms `easeInOut`, aligned to 0.5 (centred).
- **Settings pages:** fade 200 ms.
- Security ring **pulses** while the alarm is triggered.

### 4.6 Tile geometry

| Token | Value | Meaning |
|---|---|---|
| `AppTileAspectRatio.square` | 1.0 | Sensor tiles, settings buttons |
| `.horizontal` | 2.0 | Basic horizontal rows |
| `.wide` | 2.5 | Device tiles in domain views, presets |
| `.extraWide` | 3.0 | Auxiliary / secondary info |
| `AppTileHeight.horizontal` | 50 | Standard horizontal tile height (**most lists use `50 × 0.85 = 42.5`**) |
| `AppTileWidth.horizontal*` | 100 / 140 / 180 | Small / medium / large horizontal tiles |
| `AppTileWidth.vertical*` | 80 / 100 / 120 | Small / medium / large vertical tiles |

---

## 5. Information architecture — the Deck

### 5.1 Deck composition

The deck is a flat, ordered list of full-screen pages, built fresh whenever anything relevant changes (display config, devices, spaces, media bindings, dashboard pages, energy support, language).

**Order is fixed:**

```
[ system views for the assigned space ]   ← space-type dependent, may be empty
[ Security view ]                          ← always present
[ Energy view ]                            ← only when energy is supported AND
                                             the space has no Energy domain view
[ dashboard page 1 … n ]                   ← sorted by the page's `order` field
```

**System views by space type:**

| Space type | System views produced |
|---|---|
| **Room** (`spaces-home-control`) | `Room overview` at index 0, then **one domain view per present domain**, in the fixed order Lights → Climate → Shading → Media → Sensors → Energy |
| **Master** (synthetic) | `Master overview` only |
| **Entry** (synthetic) | `Entry overview` only |
| **Signage info panel** | `Signage overview` only |
| **Zone** | *none* — no system view is built. ⚠️ Because Security is appended unconditionally it becomes **index 0**, so with `homeMode = auto` a zone panel **lands on the Security view**, not on a dashboard page. |
| **Unassigned** (`spaceId == null`) | *none* — the app shows the space picker at startup instead |

### 5.2 Landing page

- `homeMode = auto` → the deck opens at **index 0** (the system view).
- `homeMode = explicit` → opens at the page whose id matches `homePageId` (or the backend-resolved `resolvedHomePageId`). If that page is missing, it falls back to index 0 and logs a warning.

### 5.3 Domain-view visibility rules

A domain view exists **only when both a device and a configuration exist**. This is the rule set a designer must internalise, because it means *any* combination of the six domains can be missing.

| Domain | Requires devices of category… | …**and** configuration |
|---|---|---|
| **Lights** | `lighting` | ≥ 1 light target with a role that is not `other`/`hidden` |
| **Climate** | `thermostat`, `heating_unit`, `air_conditioner`, `fan`, `air_humidifier`, `air_dehumidifier`, `air_purifier` | ≥ 1 climate target whose role passes `isActuator` — which is defined as *not sensor and not hidden*, so it **also counts `auxiliary`**. See the auxiliary-only trap below. |
| **Shading** | `window_covering` | ≥ 1 covers target with a role that is not `hidden` |
| **Media** | `television`, `media`, `speaker`, `av_receiver`, `game_console`, `projector`, `set_top_box`, `streaming_service` | ≥ 1 media **activity binding** |
| **Sensors** | `sensor`, `camera` | backend reports ≥ 1 **sensor reading** (i.e. sensor roles assigned) |
| **Energy** | any device with a channel of category `electrical_power`, `electrical_energy`, `electrical_generation` | — (no separate configuration) |

While configuration counts are still loading (`null`), the domain is shown if devices exist — this avoids a blank deck during the first seconds after boot. Once loaded, `0` hides the domain.

**Device categories that never generate a domain view:** `alarm`, `door`, `doorbell`, `lock`, `outlet`, `pump`, `robot_vacuum`, `sprinkler`, `switcher`, `valve`, `water_heater`, `terminal`, `generic`. They are reachable only through the Security view, dashboard tiles, or a device detail page.

---

## 6. Navigation chrome and gestures

### 6.1 Bottom navigation bar (portrait)

```
┌──────────────────────────────────────────────────────────────────┐
│ [ Home ] │ ⟨ scrollable: Lights  Climate  Media  Security  ⋯ ⟩ │ [Mode] │
└──────────────────────────────────────────────────────────────────┘
   56 wide  1px                                              1px    16px pad
```

- Height **52**. Background = base surface. 1 px top border.
- **Home tab** is pinned left, always icon-only (`MdiIcons.home`), width 56. Present only if a system view exists.
- The middle region scrolls horizontally and **auto-centres the active tab** (300 ms). It holds domain tabs, the Security tab, the Energy tab, and the "More" tab.
- **Tab pill:** height 36, min width 40, radius `base`, 4 horizontal margin, 8 horizontal padding. Active = accent @ 15 % fill + accent icon/label. Inactive = placeholder-coloured icon, no fill. Icon 24.
- Label appears **only when the tab is active and the screen is not small**; it animates in with `AnimatedSize`.
- **Badge:** small accent pill at the icon's top-right, min 14×14, 9 px bold white numeral. Currently used for the More tab's dashboard-page count.
- **"More" tab** appears only when ≥ 1 dashboard page exists. Its icon is `dots-horizontal`; it counts as "active" whenever a dashboard page is on screen; tapping opens the **More sheet**.
- **Mode button** (far right, after a divider) appears only when the current domain view registers a mode config. It is icon-only, 22, tinted with the mode's colour family. Tapping opens the **mode popup**, anchored above the bar (fixed 68 offset from the bottom, 8 from the right).

  **Only four of the six domains register one:**

  | Domain | Mode control | What the popup selects |
  |---|---|---|
  | Lights | ✅ | Off / Work / Relax / Night |
  | Climate | ✅ | Heat / Cool / Off (capability-dependent) |
  | Shading | ✅ | Open / Daylight / Privacy / Closed |
  | Energy | ✅ | **Time range** — Today / Week / Month (info-coloured; registered only once a summary exists) |
  | Media | ❌ | *clears the config* — activities are chosen in the body instead |
  | Sensors | ❌ | *clears the config* — category filtering lives in the section title |

  Note that Energy's chip is a **range selector**, not a "mode" — same component, different semantics. Do not design Media/Sensors mode chips; do design the Energy range one.

### 6.2 Side dock (landscape)

- Column width **90** on large screens (icon + 8 px label), **65** otherwise (icon only).
- The dock is a floating card: overlay surface at 85 % (dark) / 90 % (light) alpha, radius `medium`, 1 px border, soft shadow (blur 8, offset x 2), vertically centred with 16 top/bottom and 8 left/right page margin. The column behind it uses the page background.
- Same content and states as the bottom bar (Home, divider, scrollable tabs) but **no Mode button** — landscape puts the mode control in the page header as a chip.
- Dock tab: full width, 4 horizontal margin, 4 vertical padding, radius `base`, active = accent @ 15 %. Icon 22, label 8 (`extraExtraSmall`), single line, ellipsised.

### 6.3 "More" sheet

Bottom sheet titled **"All pages"**. A responsive `Wrap` of square-ish buttons (min width 80, gap 8) — one per deck item, including the system view, every domain, security, energy and every dashboard page. Each button: 24 icon over a 10 px label, subtle fill, radius `base`; the current page gets accent @ 12 % fill + accent @ 30 % border + accent icon/label. Tapping closes the sheet and navigates.

### 6.4 Mode chip (landscape) and mode popup

- **Chip** lives in the page header's rightmost slot: pill with `light8` fill, `light7` border, `base`-coloured 16 icon + 12 px semibold label + chevron-down.
- **Popup:** elevation 8, radius `medium`, width 180–220, 8 padding. Anchored **below** the chip in landscape, **above the bottom bar** in portrait. The content is supplied by the active domain view (its own list of modes), so the popup body differs per domain.
- Content pattern: an uppercase 10 px tracking-1 section label, then rows of `icon + label + check`, active row filled with `light9` and outlined with `light7` in the mode's colour.

### 6.5 Gestures

| Gesture | Result |
|---|---|
| **Horizontal swipe** on the deck | Previous / next deck page. Blocked while an interactive widget (dial, slider) declares a swipe-block. |
| **Vertical swipe down** (> 20 px, dy dominant) anywhere in the app | Opens **Settings**. Fires once per gesture; ignored if Settings is already open. |
| **Vertical swipe up** inside Settings | Closes Settings. |
| **Any tap or pan** | Resets the inactivity timer. |
| **Tap** | The main selection primitive. There is no long-press and no drag-to-reorder anywhere in the display app. |
| **Horizontal swipe on the suggestion toast** | The one swipe-to-dismiss gesture in the app: the card is wrapped in a horizontal `Dismissible`, and dismissing reports feedback back to the suggestion provider. It is one of **four** dismissal paths — see §6.6. |
| **Pull to refresh** | Only on the media domain's "no endpoints" state. |

### 6.6 Persistent floating elements on the deck

- **Buddy FAB** — 48 circle, primary fill, white robot icon 24, shadow (primary @ 30 %, blur 12, y+4). Positioned 16 from the right; bottom = `52 + 8` in portrait (clearing the nav bar), 16 in landscape. **Hidden entirely when the Buddy module is disabled.**
- **Voice-activation indicator** — centred at the top, 4 px below the top edge. Rendered when the voice-activation service is registered, and **collapses to nothing while its state is `stopped`** — so it is invisible until the wake word is armed. Shows listening / recording (with a countdown) / processing. Independent of the Buddy module.
- **Suggestion toast** — positioned card that animates in when a proactive suggestion is enqueued. Has a warning variant with a heavier 2 px border. Mounted unconditionally and fed by *any* registered suggestion provider, so it is **not** gated on the Buddy module. It has **four dismissal paths, all of which must survive a redesign**:

  | Path | Behaviour |
  |---|---|
  | Horizontal swipe | `Dismissible` → dismiss + provider feedback |
  | Explicit **Dismiss** text button | Same callback as the swipe |
  | The suggestion's **action button** | Accepts the suggestion, which also removes the toast |
  | **30 s auto-dismiss** | The notification service times the toast out on its own — sized for wall-mounted displays where nobody is standing there to dismiss it |

---

## 7. Startup and provisioning flows

The root app is a small state machine. Each state is a **complete standalone screen** — the deck chrome does not exist yet.

```
loading ──► ready                      (backend reachable, display has a space)
   │    ├─► roomSelection              (display has no space assigned)
   │    ├─► discovery                  (no stored backend)
   │    ├─► connectionFailed           (stored backend unreachable)
   │    └─► error                      (initialization threw)
```

### 7.1 Loading

Centred circular progress indicator, 50×50 (scaled). Held for **at least 500 ms** so the transition never flickers. Language and dark-mode come from cached local preferences, so the first frame is already in the right locale and theme.

### 7.2 Backend discovery

A dedicated screen with **six** sub-states, each laid out separately for portrait and landscape:

1. **Searching** — animated **pulse rings** behind a spinner, title, description, live "N found" counter, and a Cancel button.
2. **Found** — title + "N found", a selectable list of discovered gateways (name + address), and buttons: *Connect selected*, *Rescan*, *Manual*.
3. **Not found** — explanatory copy + *Try again* / *Manual*.
4. **Error** — error title/description + *Try again* / *Manual*.
5. **Connecting** — spinner + the address being contacted.
6. **Manual entry** — a single text field (hint + label + help text) with *Back* / *Connect*. The app normalises input: adds `http://` when no scheme is present, lowercases the scheme, appends `/api/v1` when the URL has no `/api/` segment.

Behind all of this, a **background retry pings the known backend every 5 s** and automatically proceeds when it answers. If the panel was shipped with a compile-time backend URL (all-in-one image), discovery is skipped and that URL is retried directly.

### 7.3 Space selection

Shown when the display is registered but `spaceId == null`.

⚠️ **It is a *room* picker, not a space picker.** It reads the rooms getter, which filters to `type == room` and sorts by display order — zones and the synthetic master / entry / signage spaces are never listed. Consequences:

- The **empty state means "no *rooms* configured"**, and it appears even when the installation has plenty of zones or synthetic spaces.
- A display intended for a zone, master, entry or signage space **cannot be assigned from the panel at all** — that assignment has to be made in the Admin. Worth knowing before designing this screen as a general-purpose space chooser.
- With exactly **one** room the screen pre-selects it, so the user only has to confirm.

Content: title, "N rooms available", a selectable list of rooms (icon + name), and a *Confirm* button. Also has a **saving state** (spinner + "saving…").

### 7.4 Where failures actually surface

Connection failures and fatal errors go to **two different screens** — worth knowing, because the failure a user is most likely to hit never reaches the fatal screen:

| Failure | State | Screen shown |
|---|---|---|
| Stored backend unreachable | `connectionFailed` | **Discovery screen in retry mode** — the error message is rendered inside discovery, with a background retry running |
| A selected discovered backend fails to connect | `connectionFailed` | Same — discovery, retry mode |
| A manually entered URL fails to connect | `connectionFailed` | Same — discovery, retry mode |
| Initialization returned an error / needed discovery unexpectedly | `error` | **Fatal error screen** |
| Initialization threw | `error` | **Fatal error screen** (raw exception text) |

The **fatal error screen** is a full-screen error with a localized message and a **Restart** action. It is reserved for the last two rows: the three connection-failure messages are surfaced *within* the discovery flow instead, so the panel stays in a recoverable state that self-heals when the backend returns.

### 7.5 Deck empty state (defensive only)

The deck widget has a centred warning-icon empty state with a title and description for the case where it has zero items.

> ⚠️ **This is a defensive branch, not a shipped state.** `buildDeck` appends the Security view **unconditionally**, so an initialized deck always has at least one item; and a display with no space is held in the space-selection flow (§7.3) before the deck ever renders. Design it if you want belt-and-braces coverage, but do not plan around users seeing it.

---

## 8. System views (per space type)

### 8.1 Room overview — the flagship screen

This is what most panels show most of the time. It is deliberately the most designed screen in the app.

#### Composition

```
PORTRAIT                          LANDSCAPE
┌─────────────────────┐           ┌──────────┬──────────────────┐
│                     │           │          │  status pills    │
│     SKY PANEL       │ 40 % h    │   SKY    ├──────────────────┤
│  clock / date /     │ max 500   │  PANEL   │  domain cards    │
│  weather card       │           │  42 % w  │  (2-up grid)     │
├─────────────────────┤           │  + scene │                  │
│  scene pills (row)  │           │   pills  │                  │
│  domain cards 2-up  │           │          │                  │
│  status pills       │           │          │                  │
└─────────────────────┘           └──────────┴──────────────────┘
```

#### The sky panel

A live, weather- and time-driven scene. Five stacked layers:

1. **Gradient background** — a 4-stop vertical gradient chosen from a **4 × 10 matrix**: four day parts (`morning`, `noon`, `evening`, `night`) × ten conditions (`clear`, `partlyCloudy`, `cloudy`, `overcast`, `rainy`, `heavyRain`, `stormy`, `snowy`, `windy`, `foggy`). Forty hand-tuned gradients exist; e.g. clear noon `#4A9FCC → #6BB5D8 → #92CBE4 → #C0DFF0`, clear evening `#1C2850 → #5C3870 → #C06848 → #E8A040`, clear night `#060A14 → #0A1428 → #0E1E3C → #142850`.
2. **Celestial** — sun (position 0.15 / 0.5 / 0.85 across the sky for morning/noon/evening, opacity 0.9/1.0/0.8), moon at night, stars (opacity 0.15 morning, 0.3 evening, 1.0 night).
3. **Clouds** — 0 to 5 cloud shapes; count and opacity per condition (clear 0, partly 2, cloudy 4, overcast 5, foggy 2…), base opacity 0.25 night / 0.35 dawn-dusk / 0.4 day, plus a per-condition bump. Weather also dims the sun (0.5 cloudy, 0.0 overcast/rain/storm, 0.2 snow, 0.15 fog).
4. **Weather overlays** — rain (40 or 80 drops), snow (40 flakes), wind streaks, lightning flashes, fog wash.
5. **Content overlay** — see below.

*Day part* is computed from real sunrise/sunset: night before sunrise; morning = first 30 % of daylight; noon = middle; evening = last 20 % of daylight plus 60 min of twilight; then night. Weather codes are mapped from OpenWeatherMap ranges. **If no weather data is available**, the panel falls back to `clear` sky with clock-hour buckets (6–11 morning, 11–17 noon, 17–21 evening, else night) and **hides the weather card entirely**.

*Content overlay* (16 padding all round):

- **Portrait, centred:** clock `HH:mm` at 56 / weight 100 / tracking −1.5 · date `EEEE, d MMMM` at 14 · compact weather card (icon 16 + temp 16 bold + description 12).
- **Landscape, left-aligned, vertically centred:** clock 72 (48 compact) / weight 200 / tracking −2 · date 16 (14 compact) · full weather card (icon 22 + temp 22 bold, description 14 underneath) · **scene pills** as a `Wrap` capped at 4 rows (3 compact).
- Weather card is the frosted-glass component; tapping it opens the **weather detail page** for the display's weather location.
- ⚠️ **The sky panel ignores the display's temperature-unit override.** It formats the provider's raw value to 0 decimals and appends a bare `°` — no conversion, no unit symbol. The weather *tiles* and the weather *detail page* do convert properly, so on a display set to Fahrenheit while the provider reports Celsius, the sky panel and the tiles disagree. Treat the bare `°` as an implementation gap, not a deliberate style choice.
- **Text colour rule:** night and evening always use light text (`#E6FFFFFF` / `#80FFFFFF`). Morning and noon use dark ink (`#DD2A3E4A` / `#994A5E6A`) *except* under rain/heavy-rain/storm, which switch to white.

#### Scene pills

- Portrait: a horizontal scroll strip 30 high above the domain cards, gradient-masked at the edges.
- Landscape: rendered on the sky panel instead (glass-style pills on the gradient).
- Pill: 12 horizontal / 4 vertical padding, radius `base`, icon 14 + label 10 semibold. While triggering, the pill fills with primary and swaps the icon for a 12 px spinner.
- Scenes shown: all **enabled + triggerable** scenes for that space, ordered by category priority — movie, relax, night, work, party, morning, lighting, climate, media, then everything else.
- **Absent entirely when the space has no scenes.**

#### Domain cards

A 2-column grid, vertically scrolling with gradient edge masks, 8 gaps, 8 page padding.

- Height = `tileWidth / aspect` where aspect is 1.4 (compact) or 2.0, clamped to a max of 90 (compact) / 95.
- Card: fill = white (light) / `AppFillColorDark.light` (dark), radius `base`, 1 px border. Padding 8 vertical, 16 horizontal (8 when compact).
- **Active accent:** a 3 px left border in the domain colour, drawn as a foreground decoration.
- Content: a **28×28 rounded icon box** filled with the domain's `base` colour holding a white 16 icon; then a text column — title 12/w700, primary value 16/w700 on the same visual block, optionally followed by a small target value (arrow icon + 12/w700 placeholder-coloured); then a subtitle row of `icon + text` items at 10/w500 separated by "·"; then a row of **quick-action buttons** (outlined, tinted with the domain's outlined-button theme).
- Some subtitle items are marked `compactHidden` and drop out on small/landscape (e.g. illuminance).

Per-domain card contents:

| Domain | Primary value | Subtitle | Quick actions |
|---|---|---|---|
| **Lights** | Mode name when an intent is active and confirmed (`Work`/`Relax`/`Night`), else `Custom` when any light is on, else `Off` | "n of m on" or "m lights" | `Off` · `50%` · `100%` |
| **Climate** | `Off` when off, else target temperature, else current temperature, else device count | "n devices" | mode button (label + icon = current mode, opens a mode dialog) · `−` · `+` |
| **Shading** | Detected mode when intent-driven (`Open`/`Closed`/`Privacy`/`Daylight`), else `Closed` when all closed, else `Custom` | "fully closed" / "fully open" / "n % open" / device count | `Open` · `50%` · `Close` (icon-only on compact) |
| **Media** | Active activity name (`Watch`/`Listen`/`Gaming`/`Background`) or `Off`; icon changes to a filled play-circle when active | — | `play` · `pause` · `stop` — **disabled only when there is no active media *activity***. They stay enabled while an activity is running but paused or stopped, since the flag reads the activity state, not the playback status. |


**There is no Sensors card and no Energy card.** The card builder skips both domains outright, so only Lights, Climate, Shading and Media can ever produce a card — at most **four**. Sensor readings reach the room overview solely through the status pill strip, and energy solely through the energy pill. (The builder still contains an unreachable Sensors branch; ignore it.)

Tapping the card body navigates to that domain view. Tapping an action behaves differently per domain:

- **Lights, Climate, Shading** — fire an intent and apply an **optimistic override for up to 5 s** (cleared as soon as the backend agrees, or when it expires). These get the pending treatment.
- **Media (play / pause / stop)** — ⚠️ **no optimistic override at all.** They write the playback command straight onto the matching device properties; nothing is locked, nothing is held, and the card only changes once the real state arrives over the socket. Do not design a pending state for these three unless the behaviour is also implemented.

The climate mode action opens a **centred mode dialog**: a 180–220 wide card listing Heat (fire, danger), Cool (snowflake, info), Auto (autorenew, success), Off (power, neutral); each row 8 padded, active row `light9` fill + `light7` border + check mark.

#### Status pill strip

A horizontal scroll strip 22 high — **top** in landscape, **bottom** in portrait.

- **Sensor pills:** `light8` fill, radius `base`, 8/4 padding, icon 14 + value 10/w700 tracking 0.3, all in the sensor type's colour family. Built from the space's aggregated sensor state: average temperature, average humidity, average illuminance (each shown only if present).
- **Energy pill:** appended only when the space has a status widget of type `energy` configured in the Admin. Its settings drive `show_production` and the range (`today` by default). Tapping navigates to the room's Energy domain view if it exists, else to the standalone Energy view.

#### States

| State | Presentation |
|---|---|
| Loading | Centred spinner in the content area (sky panel still renders) |
| Error | Alert icon 64 (danger), message, **Retry** filled button |
| Empty (no domains, no scenes) | Success check-circle 48, "Nothing to control here" title + description naming the space |
| No room assigned / display not configured | Error variant with the corresponding message |

### 8.2 Master overview (synthetic "whole home" space)

A different, denser composition — this panel is a hallway/overview device.

- **Top bar** (`AppTopBar`, not `PageHeader`): title + home icon, with status badges on the right:
  - **Devices badge** — `n/m` online with a check-circle (success tint) or alert (warning tint) on a `light9` pill.
  - **Alerts badge** — only when > 0; danger `light9` pill with count.
  - **Energy pill** — only when energy is supported. Whole-home figures, and **tapping it navigates to the standalone Energy deck view**.
- **Summary row** — three equal stat cards (rooms · devices · scenes): 28 icon in primary, 16 bold value, 10 label; translucent page-overlay fill.
- **Quick actions** — a `Wrap` of `ActionChip`s, one per triggerable scene, with a spinner in the avatar slot while triggering. Hidden when there are no global scenes.
- **Rooms list** — a scrolling list of room cards: 32 primary icon, name (14/w600), "n/m devices" (10, success when all online else warning), optional current temperature (14/w500), chevron. Tapping **pushes** the Room overview as a normal route (not a deck page) and sets the room context intent.
- Loading / error (retry) states as elsewhere.

### 8.3 Entry overview (synthetic "entry" space)

For a door-side panel.

- **Top bar badges** — each independently conditional:
  - **Locks** — only when the space has locks; `all locked` or `n/m`, success when all locked else warning.
  - **Alarm** — only when the space has alarms; `Armed` (danger) / `Disarmed` (neutral).
  - **Energy pill** — only when energy is supported. Shows **whole-home** consumption/production (`spaceId: 'home'`), and **tapping it navigates to the standalone Energy deck view** — an interactive entry point, not a passive badge.
- **House modes section** — heading with icon, then either:
  - the configured house-mode **scenes** as a centred `Wrap` of 70×70 filled buttons with a 32 icon and a label below (active = primary theme, inactive = info theme; a spinner replaces the button while triggering) — these actually trigger the scene, or
  - **four default buttons** (Home / Away / Night / Movie) when no house-mode scenes exist. ⚠️ **These are cosmetic.** Their tap handlers only move a local highlight — no intent is fired, nothing in the house changes. Treat them as a visual placeholder for an unconfigured system, not as functional controls.
- **Security section** below.
- Loading / error (retry) states.

### 8.4 Signage info panel

The signage page itself is minimal and **read-only**:

- Transparent scaffold, 32 padding, **no page header of its own**.
- Left: clock `HH:mm` at 120 / weight 200, date "Weekday, Month D" at 28 / weight 300.
- Right: campaign icon 56 + panel title 22.
- Bottom: a placeholder announcements card (radius 16, white @ 6 %, 24 padding, icon 32 + copy).

**What the surrounding app actually does today** — the page's own source comment describes an intended "no chrome, never sleeps" surface, but that is *not* what a signage-assigned display currently renders:

| Intended | Actual behaviour today |
|---|---|
| No deck navigation | The deck still wraps **every** page — a signage display shows the **bottom nav bar** (portrait) or **side dock** (landscape) |
| Signage is the only page | The deck also contains the **Security view** (added unconditionally), the **standalone Energy view** whenever energy is supported (only a *room* space with its own Energy domain suppresses it), and any dashboard pages — so the panel is swipeable |
| Never blanks | The **inactivity overlay is registered globally** and fires whenever `screenLockDuration > 0` — a signage display will show the screen saver or the black lock screen like any other panel |

> ⚠️ **This screen is a stub, and its isolation is unimplemented.** Announcement, weather and feed rendering are not wired yet — only the clock and a welcome shell exist. It is also the one screen that does **not** use the app's date localisation (hard-coded English weekday/month names).
>
> **For the designer:** treat signage as a greenfield surface. Design it as the chrome-free, always-on board it is meant to be, but be aware the current build does not yet suppress the deck chrome or the idle overlay — that suppression is follow-up engineering work, not existing behaviour to preserve.

---

## 9. Domain views

All six domain views share a skeleton. Learn it once; the differences are in the hero and the secondary column.

### 9.1 Shared skeleton

```
┌───────────────────────────────────────────────┐
│ PageHeader: [icon] Title            [actions] │  ← subtitle carries live state
│             subtitle                 [chip]   │     landscape adds the mode chip
├───────────────────────────────────────────────┤
│                                               │
│  PORTRAIT                LANDSCAPE            │
│  ┌───────────────┐       ┌──────┬──────────┐  │
│  │  HERO CARD    │       │ 2nd  │  HERO    │  │
│  ├───────────────┤       │ col  │  CARD    │  │
│  │ role/mode sel.│       │flex 1│  flex 2  │  │
│  ├───────────────┤       │      │          │  │
│  │ secondary grid│       └──────┴──────────┘  │
│  └───────────────┘                            │
└───────────────────────────────────────────────┘
```

- **Header** is `PageHeader`: 8 horizontal padding, 8 vertical (4 on compact portrait); a leading icon container tinted by state; title 16/w600 (14 compact); subtitle 12 (10 compact) whose **colour turns to the state colour when the domain is active**; a trailing row of circular header icon buttons; a landscape-only rightmost slot for the mode chip.
- **Hero card** is `HeroCard` → `BaseCard`. In portrait it is height-capped at **48 % of screen height, max 500**; in landscape it fills the main column.
- The **secondary column** in landscape gets a distinct fill background (`AppFillColorDark.light` / `AppFillColorLight.light`) to separate it from the hero.
- Vertical scrolling regions have **gradient edge masks** that appear only when there is more content in that direction.
- Overflow in tile lists is handled by a **"+N more" tile** that opens a bottom sheet (portrait) or right drawer (landscape) with the full list.

### 9.2 Lights

**Header** — title "Lights"; icon `lightbulb-on`/`lightbulb-outline`; **status colour: all on → success, all off → neutral, mixed → warning**. Subtitle is intent-aware: "Work · 3 on" while a mode is active or pending, "Custom · 3 on" when the user has manually diverged from the last applied mode, else "3 of 7". Trailing: a scenes button — only in landscape and only when the scenes column doesn't fit.

**Hero card** (per selected role):

- **Badge** — a split pill, radius `round`, height 24:
  - *Left half* = power icon + role name (uppercase, w700, tracking 0.3) → **toggles the whole role**.
  - *Divider* = 1 px at 30 % alpha.
  - *Right half* = status icon + a filled circle containing the device count → **opens the role's light list** (sheet/drawer).
  - Status icon: `alert` when any device is offline, `tune` when the role's devices are in a mixed state, otherwise `lightbulb-group`.
  - On = colour family `base` on `light9`; off = secondary text on subtle fill.
- **Giant value** — DIN1451 numeral (brightness by default; falls back to colour temperature, then white channel), with a unit glyph top-right (sun icon for %, "K" for kelvin) and a **colour swatch** bottom-right (HSV colour when hue-capable, sampled gradient colour when temp-capable).
- **Capability switcher** — a `ModeSelector` shown only when the role supports **≥ 2** capabilities. Capabilities: brightness, colour temperature, hue, saturation, white channel. On small portrait screens it switches to icon-left, label-hidden.
- **Gradient slider** with step labels below. Gradients per capability:
  - brightness: dark fill → white, steps `0/25/50/75/100 %`
  - colour temp: `#FF9800 → #FFFAF0 → #E3F2FD → #64B5F6`, steps `min K / mid K / max K` (range read from the device's property format, default 2700–6500)
  - hue: full spectrum, steps `0° / 120° / 240° / 359°`
  - saturation: white → current hue, steps `0…100 %`
  - white: dark fill → white, steps `Off / 25 / 50 / 75 / 100 %`
  - The slider is **disabled when the role is off**.
- **Presets** — a horizontal scroll strip, 20 high: value chips for numeric capabilities (10 / 25 / 50 / 75 / 100 %), **colour swatches** for hue.
- **On/off-only roles** (no capabilities at all) get a simplified on/off hero instead of value + slider.

**Role selector** — one entry per configured role (`main`, `task`, `ambient`, `accent`, `night`; icons ceiling-light, desk-lamp, wall-sconce, spot, weather-night). Each entry shows the role name (10/w500) over a value line (14/w600) which is `Off`, `On`, or `NN%`. A dot status icon marks roles that are on. Horizontal `ModeSelector` in portrait; vertical role **tiles** in landscape (where tapping the tile's icon toggles the role and tapping the body selects it). Hidden when only one role exists.

**Scenes** — lighting-related scenes for the space:
- Portrait: a grid (2 columns on small, 3 otherwise) filling the remaining height, with a "+N" overflow tile.
- Landscape: a right-column list sized to fit, with a section title and a "+N more" tile; if it can't fit at all, the header shows a magic-wand button that opens the full list in a drawer.

**Role list sheet** — one row per light in the role (name, on/off/offline, brightness). A footer appears **only** when the role is in a mixed state (→ *Sync all*, info style) or has offline devices (→ *Retry*, warning style).

### 9.3 Climate

**Header** — "Climate"; thermostat icon tinted by mode; subtitle = status label, coloured when the system is actively heating/cooling. Trailing buttons appear conditionally: a **climate devices** sheet button when the room has > 1 climate actuator, and an **auxiliary devices** sheet button when auxiliaries (fan / humidifier / dehumidifier / purifier) exist.

**Hero card:**
- **Mode badge** — pill, radius `round`, height 24: an 8 px dot + the uppercase mode label, on the mode colour's `light9`. Tapping opens the mode popup.
- **Giant temperature** — DIN1451, unit symbol (`°C`/`°F`) at top-right. Goes to secondary text colour when the system is off.
- **Temperature slider** — gradient `#4FC3F7 → #81C784 → #FFB74D → #E57373` with a thumb border sampled from the gradient at the current position, and four step labels spanning min→max setpoint. **Disabled when off.**
- **± buttons** — two neutral filled buttons, centred, 32 apart. Step is **0.5 °C** or **1 °F**. Disabled when off.

**Mode options are capability-driven:** heater-only rooms offer Heat, cooler-only offer Cool, dual-capable offer both. (Auto is deliberately commented out pending a dual-setpoint control.) Off is always available.

**Sensors** — portrait: a grid below the hero (2 cols small / 3 otherwise, vertical tiles on medium+, horizontal tiles on small), with "+N more". Landscape: a fitted vertical list in the secondary column, distributing leftover space as extra gap. Tiles show value as the primary line and the sensor label as status — **inverted when offline** (label as primary, "Offline" as status, warning badge shown).

### 9.4 Shading

Same skeleton as Lights, with roles `primary`, `blackout`, `sheer`, `outdoor` (icons blinds-horizontal, blinds-horizontal-closed, curtains, blinds-vertical-closed).

- **Header** subtitle is intent-aware: mode name (`Open` / `Closed` / `Privacy` / `Daylight`) or `Custom`, followed by "· N"; falls back to a position description. Icon toggles between open/closed blinds and is coloured by position. Trailing: a devices sheet button.
- **Hero:** badge, **giant position percentage**, position slider, quick-action buttons (open / 50 % / close), presets.
- Role position comes from the **backend role target** when available (correct when individual devices have been moved manually), otherwise falls back to the device average.
- Device rows in the sheet also show a **cover type** (curtain / blind / roller / outdoor blind) with its own icon.

### 9.5 Media

The most state-heavy screen. Media is modelled as **activities** (Watch / Listen / Gaming / Background / Off) that map to endpoints.

**Six mutually exclusive body states:**

| State | Body |
|---|---|
| **Off / deactivating** | Hero card with a large "off" composition + the activity `ModeSelector` below (portrait) or activity tiles in the sidebar (landscape). Shown only if more than one activity is available. |
| **Activating** | A step list: each activation plan step with its own spinner/tick, tinted by the mode colour. |
| **Failed** | Failure summary + details + retry. |
| **Active** | Hero (now playing — **text only**: track / artist / album, progress bar, transport buttons, volume, source) · activity mode selector · **composition card** (a horizontal tile listing which devices are in play, tapping opens the full list). ⚠️ **No artwork today.** The view reads track, artist, album, position and duration and renders them as text; the media links model exposes no artwork URL and the panel has no network-image loader at all. Reserving an album-art region is a *new feature*, not a re-skin — design it if you want it, but flag it as such. |
| **No endpoints** | Full "no media devices" empty state with a pull-to-refresh list. |
| **No bindings** | The standard **not-configured** state ("Media not configured"). |

**Blocking WebSocket overlay:** media control requires a live socket. If the socket drops, a translucent scrim (75 % dark / 55 % light) covers the whole page with a centred card: wifi-off icon 40 in warning, title, description, and a primary **Retry** button. *This is unique to media* — no other domain hard-blocks.

**Header** — trailing buttons appear conditionally: devices sheet (when device groups exist), remote (only when media is on **and** a remote target is resolvable), and an always-present power button (primary when on, neutral when off; it deactivates when on, or activates the single available activity when off — disabled if there are several).

### 9.6 Sensors

**Header** — subtitle and accent colour escalate: alerts → danger ("N alerts active"); else stale/offline sensors → warning ("N sensors • 2 stale, 1 offline"); else primary ("N sensors • normal").

**Body:**
- **Alert banner** — only when a sensor is in alert; shows the first alerting sensor and navigates to its detail.
- **Environment summary** — average temperature (info), average humidity (success), and *either* illuminance (warning) *or* pressure (info). Rendered as a row of cards (portrait, medium+), a horizontal strip of compact tiles (small portrait), or a vertical stack in the landscape sidebar. Summary card: 18 icon + 10 label, then a 28/w300 value in the accent colour. **Hidden entirely when the space reports no environment averages** — which also frees an extra grid column in landscape.
- **Section title doubles as a filter**: "All sensors" (or the active category) + count + chevron; tapping opens a category filter popup.
- **Sensor grid** — portrait 2 cols (3 on medium+), aspect 1.0 / 0.9; landscape 2 cols (3 on large), +1 column when the summary sidebar is hidden, aspect 1.0 / 0.87. Each card carries the sensor icon, a **freshness dot**, the value, and a **trend indicator**.

### 9.7 Energy

Exists both as a **room domain view** and as a **standalone deck view** (the standalone one is added only when the room has no energy domain).

- **Header** — "Energy", flash icon in info; subtitle `"12.4 kWh"`, extended to `"12.4 kWh / 3.1 kWh production"` when production data exists; a **podium** trailing button appears only when a per-device breakdown is available.
- **Time range selector** — Energy is the one domain whose mode chip / bottom-nav mode button is not a mode at all but a **range picker: Today / Week / Month**, coloured `info`. Its icon and label reflect the current range. It appears once a summary has loaded and **stays visible while a range change reloads** — neither the room-domain nor the standalone energy screen clears the config during an in-flight range switch (the standalone one retains it explicitly while the repository is `loading`). It is absent only on the *initial* load and in a definitive no-data state. So the loading treatment for a range change must keep the selector on screen and interactive-looking rather than collapsing the header. Changing the range refetches summary, chart and breakdown together.
- **Portrait:** consumption card on top, time-series chart filling the rest.
- **Landscape:** chart in the main column; consumption card in the sidebar, plus a **production** card (solar icon, success) and a **net** card (swap icon; warning when net > 0, success when ≤ 0) — both only when production data exists.
- **Top consumers** open in a sheet/drawer as ranked rows with proportional bars.
- **Not-configured state** when no summary is available: flash-off icon + "no energy data" copy.

---

## 10. Security view

Always present in the deck; also reachable as a standalone route.

- **Hero:** a circular **status ring** — background circle plus a foreground arc — with an icon and a status label in the middle, and optional summary pills beneath. It **pulses** while the alarm is triggered. Colour follows the security state (armed / disarmed / triggered / alerts).
- **Tab selector** — ⚠️ *not* an arming control. It is a `ModeSelector` over three tabs — **Entry points · Alerts · Events** — and selecting one only switches the body. It is **always rendered**; only the *Entry points* option is conditional on entry points existing, because Alerts and Events are always available.
- There is **no arming / disarming control on this screen today.** The status ring reports the armed state; the only write actions are acknowledging alerts. If the new design introduces arm/disarm affordances, that is new functionality, not a re-skin.
- **Tabbed content:**
  - **Entry points** — a grid of door/window tiles with status badges; tapping opens that device's detail page.
  - **Alerts** — a scrolling list of active alerts, each with its own acknowledge button, plus an **Acknowledge all** action.
  - **Events** — a scrolling feed of recent security events with a refresh button and its own loading/error states.
- **Landscape** renders the tabs as tiles in a side column instead of a tab bar.
- When the user is *on* this screen, the security **overlay** (§15.2) is suppressed.

---

## 11. Dashboard pages and tiles

User-designed pages authored in the Admin. Three page types.

### 11.1 Tiles page

- Optional top bar (`showTopBar`): page title, the page's icon (default `view-dashboard-variant`), and, on the right, one small widget per page-level **data source**.
- Body: a grid with 8 padding. Two modes:
  - **fixed tile size** — when the page defines `tileSize`, that value is a **target, not an absolute**: the grid derives `floor(containerWidth / tileSize)` columns and `floor(containerHeight / tileSize)` rows (minimum 1 each), then divides the *full* container by those counts. Rendered cells therefore rarely equal `tileSize`, and if the target exceeds the container a single cell fills it entirely. Treat it as "approximately this big", never as a fixed pixel contract;
  - **fixed grid size** — otherwise the page's `rows × cols` define the grid and tiles scale to fit.
- Every tile declares `row`, `col`, `rowSpan`, `colSpan`.
- States: *page not found* (alert icon 64 in warning + copy) and *no tiles configured* (dashboard icon + copy).

### 11.2 Cards page

- Optional top bar (default icon `card-text`).
- Body: a vertical scroll of **cards**. Each card = optional `SectionTitle` (icon + title) plus an `AspectRatio(cols/rows)` grid of tiles. Cards can override rows/cols; otherwise they inherit the screen's grid.
- States: *page not found* and *no cards configured*.

### 11.3 Device detail page type

A page whose entire body is one device's detail screen (§12).

### 11.4 Tile widgets

| Tile | Content | Interaction |
|---|---|---|
| **Device preview** | Button tile: device icon (tile icon → device icon → category icon), device name as title, and a centred row of the tile's data-source values as subtitle | Body tap → device detail route. Icon tap → toggle on/off (only when the device exposes an on-state); failure raises an error toast. Renders an info-tinted spinner card while the device is unknown. |
| **Scene** | Card with a 32 icon (default `movie-open`), label, and status line. When on: elevation 4, primary `light8` fill, 2 px primary border, bold label | ⚠️ **None — the tile is read-only today.** It has no tap handler and cannot trigger its scene. It reflects state only. |
| **Time** | DIN1451 clock at 90 (bold, `height 0.95`) over a 25 date, left-aligned, auto-shrinking to fit | — |
| **Weather (current)** | ⚠️ Just three things: **condition icon, temperature (with unit symbol), and the condition description.** Nothing else — no feels-like, humidity, wind, precipitation, UV or cloud cover. Those exist in the weather *data* but no tile renders them; putting them on the tile is new functionality. | Tap → **weather detail page** (only when weather data is present) |
| **Weather (forecast)** | ⚠️ Per day: **short weekday name, condition icon, and two temperatures.** The two values are **fallbacks, not averages** — day = `temperatureDay ?? temperatureMorn`, night = `temperatureNight ?? temperatureEve` — and a **single** unit symbol is rendered for the pair, not one per value. No precipitation probability and no wind. | Tap → **weather detail page** |

---

## 12. Device detail screens

Opened via the route `/device/{id}`, from device-preview tiles, from domain sheets, and from the security entry-point grid.

**Three tiers.** 30 of the 32 device categories are registered in the detail registry and bring their **own** `Scaffold` + `PageHeader`; only unregistered categories fall through to the shared top bar. The important nuance for a designer is that "registered" does **not** mean "designed" — 12 of those 30 are registered placeholders.

| Tier | Shell | Categories | Body |
|---|---|---|---|
| **1 — Rich** (18) | Own `Scaffold` + `PageHeader` + portrait/landscape layouts | lighting, window covering, sensor, thermostat, air conditioner, air humidifier, air dehumidifier, air purifier, fan, heating unit, television, speaker, AV receiver, projector, set-top box, streaming service, game console, media | Full purpose-built controls |
| **2 — Registered placeholder** (12) | **Same** own `Scaffold` + `PageHeader` (back button + device icon + name, optional trailing) | alarm, camera, door, doorbell, lock, outlet, pump, robot vacuum, sprinkler, switcher, valve, water heater | A centred **"detail preparing"** state: warning-tinted alert icon 64, title, description. **No controls at all.** |
| **3 — Generic fallback** | Shared **`AppTopBar`** (device name + category icon, an **Offline** warning chip when disconnected, and a close ✕) | Anything *not* registered — `generic`, `terminal`, unknown | `GenericDeviceDetail` body |

The header of tiers 1 and 2 is configurable per call site (`DeviceDetailConfig`): the header can be suppressed entirely, the back button hidden, and the title/icon/trailing overridden — this is how a device detail gets embedded inside a dashboard "device detail" page rather than pushed as its own route.

> **Design opportunity:** tier 2 is 12 categories — including everything security-adjacent (alarm, lock, door, doorbell, camera) — currently showing a dead-end placeholder. These are prime candidates for the new design, and they already have the correct shell, so a design drops straight in.

Shared building blocks:

- **`DevicePortraitLayout`** — scrolling content with gradient edges plus an optional **sticky bottom** panel (used for channel selectors), separated by a 1 px top border.
- **`DeviceLandscapeLayout`** — main + side composition.
- **`DeviceOfflineState`** (in `device_offline_overlay.dart`) — a dimming layer over the controls when the device is unreachable. Used by all 18 rich detail screens; the generic fallback screen uses an *Offline* chip in its `AppTopBar` instead.
- **Power button** — a shared component for the primary on/off action.
- **Channels section** — for multi-channel devices, a selector of channels (e.g. a 4-gang dimmer, a two-motor blind).
- Media devices reuse a common kit: info card, playback card, volume card, source-select card, remote card (D-pad + transport), brightness card, and a playback sheet.
- Sensor devices get a **sensor detail** page with a custom-painted chart, freshness indicator and trend.

**Example — lighting device detail:** header with device name and state; a hero card carrying the value row, a capability mode selector (only when > 1 capability is enabled), and the sliders; a presets panel; a sticky channel selector when the device has several light channels.

---

## 13. Settings

**Entry:** swipe down anywhere. **Exit:** swipe up, or the ✕ in the header. Settings runs its own nested navigator with **200 ms fade** transitions.

### 13.1 General (landing)

A grid of large tiles — **2 columns portrait (aspect 1.3), 3 columns landscape (aspect 1.8)** — each with a coloured icon chip:

| Tile | Icon / colour | Shown when |
|---|---|---|
| Display settings | monitor-dashboard / primary | always |
| Language settings | translate / info | always |
| Audio settings | volume-high / warning | **only when the display reports speaker or microphone support** |
| Voice activation | account-voice / primary | **only when the display reports audio support** |
| Weather settings | cloud-outline / info | always |
| About | information-outline / success | always |
| Maintenance | wrench-outline / danger | always |

### 13.2 Display settings

- **Theme mode** — toggle (light/dark)
- **Screen saver** — toggle
- **Screen power off** — toggle (physically blanks the panel on idle; only takes effect when the screen saver is *off*)
- **Screen lock duration** — dropdown; `0` renders as **"Never"**
- **Brightness** — slider
- **Unit overrides section** — temperature, wind speed, pressure, precipitation, distance. Each is a dropdown whose first entry is **"System default"** (meaning: inherit the backend's configuration).

### 13.3 Language settings

Four cards, each opening a selection dialog:

- **Language** — the six supported languages
- **Timezone** ⚠️ *unwired, same as time format below — no clock applies it*
- **Time format** — 12 h / 24 h ⚠️ *see §20: this setting currently has no effect on any clock in the app*
- **Number format** — System default / `1,234.56` / `1.234,56` / `1 234,56` / none

### 13.4 Audio settings

Speaker toggle + speaker volume slider; microphone toggle + microphone volume slider, each under its own section heading. If the hardware supports neither, the page shows a "no audio support" message instead.

### 13.5 Voice activation

- **Detection** section — enable toggle. Its description names the current wake word; when the microphone is unavailable, the description switches to "microphone unavailable" and the toggle is disabled.
- **Sensitivity** section — slider.
- **Status** section — live text: Stopped / Listening / Recording (n of N s) / Processing.

### 13.6 Weather settings

Selects which configured weather location this display uses ("System default" = the primary location).

### 13.7 About

Version (with a loading and an error state), then a **device information** section: IP address, MAC address, CPU usage, memory usage (all falling back to "N/A"), plus about / developed-by / license blocks.

### 13.8 Maintenance

Three actions, split into a **System** heading and a **Danger** heading:

| Action | Confirmation |
|---|---|
| Restart | Confirm dialog (Cancel / Confirm, uppercase) |
| Power off | Confirm dialog |
| Factory reset | Confirm dialog |

Copy differs depending on whether the action targets **the display only** or **the whole system**. Failures raise an error toast.

---

## 14. Buddy AI assistant and voice

- **Entry point:** the floating robot FAB on the deck. **The FAB and the chat page disappear when the Buddy module is disabled** — design must not depend on them.
- ⚠️ **Scope note:** disabling Buddy does *not* remove the suggestion toast or the wake-word indicator. The toast is driven by the shared suggestion service, which the `spaces-home-control` plugin feeds independently, and voice activation is a separate globally-registered service toggled in Settings. Treat the three as independently optional (§18).
- **Chat page:** `PageHeader` + a message list of bubbles + an input row (text field, mic button, send button).
- **States:** empty (illustration + invitation copy), initialization failed (message + retry), provider not configured (title + description), typing indicator ("thinking…" with animated dots), and a family of error messages (load conversations / create conversation / load messages / send message / provider not configured / timeout / connection error / generic).
- **Input hint text** changes with state: default, "starting conversation…", "initialization failed", "provider not configured" (which also disables input).
- **Voice input overlay** — a dedicated recording overlay with waveform/level feedback.
- **Wake-word indicator** — the small top-centre pill on the deck: Listening / Recording (with an elapsed/limit counter) / Processing.
- **Suggestion toast** — a proactive card that animates in over the deck; a warning variant uses a heavier border. It carries an action button and a Dismiss button, and can also be swiped away or left to time out after 30 s (§6.6).

---

## 15. Overlays, interrupts and idle behaviour

All interrupts go through one **overlay manager** with a priority stack and three display types:

| Type | Behaviour |
|---|---|
| **banner** | Non-blocking bar at the top; content stays interactive |
| **overlay** | Dimmed background + a centred modal card |
| **fullScreen** | A blocking page |

Every overlay declares: an icon, a **colour scheme** (`error` / `warning` / `info` / `success` / `primary`), an optional progress spinner, a title, a message or custom content widget, and a list of **actions** (filled or outlined, each with its own loading state). Overlays may be closable or not — but see §15.1 for the catch: the closable flag only produces a dismissal path for `overlay` and `fullScreen` entries, never for banners. A few overlays bypass the standard layout with a custom builder (lock screen, screen saver).

Priority bands: `0–99` informational · `100–199` module (security = 100) · `200–299` core (connection = 200) · `300+` critical. Inactivity sits at 50.

### 15.1 Connection (priority 200)

A **single** entry that escalates over time:

**Two distinct paths — only one of them escalates over time.**

**Path A — generic disconnect** (the socket simply dropped). This is the timed escalation:

| Elapsed disconnect | Presentation |
|---|---|
| < 2 s | nothing (2 s debounce absorbs flapping) |
| ≥ 2 s | **banner** — warning, spinner, "Reconnecting…", outlined *Retry* |
| ≥ 10 s | **overlay** — warning, wifi-strength-2 icon, "Reconnecting", message changes after 30 s to "still trying…", filled *Retry* (shows "Retrying…" for 2 s after a tap) |
| ≥ 60 s | **fullScreen** "Connection lost" — not closable |

**Path B — a cause-specific failure.** Auth, network and server failures **jump straight to full screen with no delay at all** — the manager cancels the escalation timer and those three states report full-screen severity immediately. There is no banner or overlay stage for them.

| Cause | Timing | Icon | Scheme | Actions |
|---|---|---|---|---|
| Auth error | **immediate** | lock-alert | error | *Reset / change gateway* |
| Network unavailable | **immediate** | network-off | error | *Retry* |
| Server unavailable | **immediate** | server-off | warning | *Retry* |
| Offline (generic) | after 60 s (path A) | wifi-off | error | *Reconnect* (filled) + *Change gateway* (outlined) |

So a design must not assume the user always sees a gentle banner first — an auth failure takes the panel from fully working to a blocking screen in one step.

On recovery, a **success toast** ("Connected") is shown for 2 s. This includes recovery from the full-screen offline state: by the time the check runs the manager is already `online`, so severity is `none` and the toast is shown, then the full-screen overlay is torn down behind it. A 3 s recovery cooldown suppresses immediate re-warnings; a disconnect during that window is deferred, not dropped.

**Dismissal is not uniform across the three display types.** The renderer applies the tap-to-hide gesture only to `overlay` and `fullScreen` entries, and only when the entry is flagged closable. For the **connection** overlay specifically:

| Type | Can the user dismiss it? |
|---|---|
| **banner** | ❌ **No.** Despite being flagged closable, the banner offers no dismissal path — the renderer never wraps banners in the gesture, and the banner itself renders only its message and the *Retry* action. It disappears on its own when the connection state changes. |
| **overlay** | ✅ Tap to hide — but note the hit area is the **whole screen, including the card itself**. The renderer wraps the entire card in the opaque tap-to-hide gesture and the card installs no absorber, so any tap that is not consumed by an action button dismisses it. If the new design wants the card to be a safe area, that needs an absorber adding. |
| **fullScreen** | ❌ Not closable — the connection provider sets `closable: false` here. Note this is a per-entry choice, not a property of the type: the **inactivity** overlay is also `fullScreen` but *is* closable, which is exactly how a tap wakes the panel from the screen saver or lock screen (§15.4). |

If a design adds a close affordance to the banner, that is new behaviour and needs renderer work. When the user does dismiss an overlay, it stays dismissed **until the severity changes**.

### 15.2 Security alerts (priority 100)

An **overlay** card: shield-alert icon, error scheme, a title from the controller, and a content list of up to **3** alerts (severity-coloured type icon + message + relative time), followed by "+N more" when there are more. Actions: *Acknowledge* (filled, check icon) and *Open security* (outlined) which navigates to the Security deck item. Suppressed while the user is already on the Security screen, and while the connection is offline.

### 15.3 System actions

Progress / done / error overlays for reboot, power-off and factory reset, driven by backend events.

### 15.4 Inactivity → screen saver / lock (priority 50, closable)

After `screenLockDuration` seconds with no touch:

- **Screen saver enabled** → a full-screen **flip clock** (44 px digits with 1 px gaps and 4 px rounded caps, themed fills and borders) with the formatted date below in placeholder colour.
- **Screen saver disabled** → a plain **black lock screen**.
- If "screen power off" is on **and** the screen saver is off, the panel additionally powers the physical display down (and back up on dismissal).
- The overlay is **skipped** if another full-screen overlay is already active (the timer simply restarts).
- ⚠️ **An unhandled *tap* dismisses it — not "any touch".** The renderer wraps the closable full-screen entry in a `GestureDetector` with only `onTap`, and because the overlay sits *above* the app-wide interaction detector and is opaque, a pan or swipe reaches neither: swiping the screen saver does nothing. Dismissal restores screen power and restarts the timer. If the new design implies "touch anywhere to wake", a pan handler has to be added.
- `screenLockDuration = 0` disables the whole mechanism.

### 15.5 Toasts

Success / info / error toasts are used for action outcomes (scene triggered, partial success, action failed) and for connection recovery.

---

## 16. Shared UI components (the de-facto design system)

A redesign should re-skin these rather than replace them, because ~40 screens consume them.

| Component | What it is |
|---|---|
| **`PageHeader`** | The standard header: leading (back button / icon / custom), title + optional subtitle, trailing actions, landscape-only slot. Compact variant on small portrait. |
| **`HeaderMainIcon` / `HeaderIconButton`** | The circular tinted icon and the circular action buttons used in headers. |
| **`AppTopBar`** | An alternative, denser top bar used by Master/Entry overviews and generic device details (title + icon + arbitrary action widgets). |
| **`HeroCard` / `BaseCard`** | The big primary card. Height-capped in portrait, fills in landscape. |
| **`UniversalTile`** | The single tile primitive: vertical (icon over text, for grids) or horizontal (icon beside text, for lists). Supports active / offline / selected states, accent colour, icon-tap vs tile-tap, optional glow, warning badge, double border, accessories slot. **Used for roles, scenes, sensors, devices, channels, media modes — everything.** |
| **`ModeSelector`** | The segmented mode/role control. Horizontal or vertical, icon on top or left, optional labels, per-option colour, per-option status icons, and a custom label builder (used to render a two-line "name over value" cell). |
| **`SliderWithSteps`** | The gradient track slider with a thumb, an optional thumb border colour, and text step labels underneath. |
| **`CircularControlDial`** | Circular dial control (used by some device details). |
| **`ValueSelector`, `IconSwitch`, `CardSlider`, `ButtonTile`** | Secondary control primitives. |
| **`SectionTitle` / `SectionHeading`** | Icon + title (+ optional trailing) section markers. |
| **`AlertBanner`** | Inline coloured banner with a title, body and tap target. |
| **`Toast`** | Success / info / error transient messages. |
| **`showBottomSheetDialog` / `showRightDrawer`** | The portrait/landscape pair for secondary lists; `DeckItemSheet` / `DeckItemDrawer` wrap them for uniform item lists. |
| **`VerticalScrollWithGradient` / `HorizontalScrollWithGradient`** | Scroll containers that fade their edges **only when there is more content** in that direction. |
| **`FixedGridSizeGrid` / `FixedTileSizeGrid`** | The two dashboard grid engines. |
| **`FlipClock`** | The screen-saver clock. |
| **`PortraitViewLayout` / `LandscapeViewLayout` / `DevicePortraitLayout` / `DeviceLandscapeLayout`** | The four layout shells. |
| **`DomainStateView`** | The shared loading / error / empty / not-configured presenter for domain views. |
| **`IconContainer`** | Rounded, tinted icon box. |

---

## 17. State machine: loading, empty, error, not-configured, offline, pending

Every data-backed screen must be designed in **six** states, not one.

| State | Standard presentation |
|---|---|
| **Loading** | Centred circular progress in the content area. The header (and the sky panel, on the room overview) stays visible. |
| **Error** | Alert-circle icon **64** in danger, a localized message, and a **Retry** filled primary button with a refresh icon. |
| **Empty** | A neutral or success icon (48–64), a 16/w600 title, a 12 placeholder-coloured description. |
| **Not configured** | *Distinct from empty.* The **header is still rendered** with the subtitle "not configured", and the body carries a domain-specific icon + title + description (e.g. "No lighting roles assigned"). **Mostly transient** — see the note below. |
| **Offline (device)** | Tiles invert their two text lines (label becomes primary, "Offline" becomes status) and show a warning badge. Device details dim behind an offline overlay. |
| **Pending / settling** | See below. |

#### How long the "not configured" state actually lives

For the five **room domains** it is a **transient/startup state, not a resting one**. Deck construction and the page body use the same rule from opposite ends: `DomainCounts.hasDomain` drops Lights, Climate, Shading and Media when their configuration count is `0`, and drops Sensors when its reading count is `0` — so a fully-loaded room with nothing configured simply has **no page in the deck at all**. The not-configured body is what you see in the window where the counts are still `null` (not yet fetched), which is exactly the live-reconfiguration case in §19D.

**Two cases are genuinely persistent, though**, and both need a designed resting state:

1. **The standalone Energy view** — added whenever energy is supported, and it renders its not-configured body whenever no summary is available.
2. **An auxiliary-only Climate room** — the deck-side check counts any target whose role passes `isActuator`, and that predicate is *not sensor and not hidden*, so an `auxiliary` role (fan, humidifier, dehumidifier, purifier) satisfies it. The Climate page therefore stays in the deck. But the page itself only puts `heatingOnly` / `coolingOnly` / `auto` targets into its actuator list — `auxiliary` targets are routed to the auxiliary-devices sheet instead — so the actuator list is empty and the page renders **not-configured indefinitely**. A room with a smart fan and nothing else lands exactly here.

Design all three variants — but budget effort accordingly: for the ordinary room-domain case this is a sub-second flash worth making calm and non-alarming, whereas the Energy and auxiliary-only-Climate variants can sit on screen forever and deserve a genuinely useful empty state (ideally one that points at the auxiliary devices that *do* exist).

### Optimistic UI (this is a *visual* requirement)

Controls do not wait for the backend. The pattern is:

```
IDLE (shows the confirmed server value)
  ↓ user acts
PENDING (shows the desired value; the control is LOCKED)
  ↓ API accepted
SETTLING (still locked; waiting for the real value to match)
  ↓ values match, or the settling window expires
IDLE
  ← on failure: roll back to the previous IDLE value
```

**Settling windows differ per subsystem — there is no single global value.** This matters for design because it sets how long a pending treatment stays on screen, and a device-detail control settles more than twice as fast as a room-level one:

| Subsystem | Interaction | Settling window |
|---|---|---|
| **Device detail** (`DeviceControlStateService`, per device/channel/property) | ⚠️ **only the controls that actually enter the machine** — not every control on the screen. See the note below. | **800 ms** (the service default; individual group configs may override) |
| **Lights domain** | brightness / hue / saturation / colour temp / white | 2000 ms |
| | on/off | 3000 ms |
| | mode (off/work/relax/night) | 3000 ms |
| | role toggle | 2500 ms |
| **Shading domain** | position | 2000 ms |
| | mode (open/daylight/privacy/closed) | 3000 ms |
| **Media domain** | playback transport (play / pause / stop) | **3 s** — but this is *not* the state machine. See the scoping note below: immediate state flip + socket suppression only. |
| **Climate domain** | setpoint | 2500 ms (convergence tolerance ±0.5°) |
| | mode | 3000 ms |
| **Room overview** | domain quick actions | optimistic override expires after **5 s**, swept at **6 s** |

Slider drags are debounced at **300 ms** across lights, shading and climate before a command is sent.

There is also **mixed-state detection** across devices in a role, with tolerances: brightness ±3, hue ±5, saturation ±3, colour temperature ±100 K, white ±5. A mixed role shows a `tune` icon instead of the normal group icon, and its sheet offers *Sync all*.

**Within a device-detail screen, participation is per control, not per screen.** The rich screens mix both kinds freely. Taking the television detail as the worked example:

| Control | Path |
|---|---|
| Brightness, volume | `setPending` → `setSettling` — **the full state machine** |
| Power, source, seek, remote keys | **Direct write.** No pending, no lock, no rollback |
| Playback transport | A **local 3 s override**, like the media domain view — not the machine |

The pattern that holds across the rich screens is that continuous/slider values tend to run the machine while discrete commands tend to be direct writes — but treat that as a tendency to verify per screen, not a rule.

**Design requirement — scoped to the controls that run the shared state machine**: those device-detail controls that call `setPending`/`setSettling`, plus the lights / shading / climate domain and role controls. Those get the full treatment — locked/pending appearance *and* a defined rollback. Each of those needs a visible locked/pending treatment and a defined rollback appearance. Today that is expressed mostly by disabled styling and by the value simply showing the desired number; a redesign is free to make it richer but must not remove it.

**Do not add pending states to direct-write controls.** Some actions bypass every optimistic path and change nothing until real state arrives over the socket. Giving those a pending treatment would show feedback the implementation cannot honour.

⚠️ **Media has three different levels of feedback — do not flatten them:**

| Control | What it actually does | What to design |
|---|---|---|
| **Media *domain view*** transport (play / pause / stop) | The displayed playback state flips **immediately** and socket truth is suppressed for 3 s, after which the device is re-read. But the command is fire-and-forget: it is not awaited, there is **no failure branch and no rollback**, and the buttons stay **tappable** throughout. | An **immediate active-state change** on the transport buttons — nothing more. No lock, no spinner, no disabled state, no rollback animation: the implementation cannot drive any of them. |
| **Room-overview card** media buttons | Direct property write. No flip, no suppression, no lock — nothing changes until real state arrives (§8.1). | No pending affordance at all. |
| Everything else in the settling table above — i.e. **every row except Media** | The shared optimistic state machine | Full locked/pending + rollback. |

---

## 18. What is optional — full conditional-visibility matrix

Everything in this table can be absent. **A design that assumes any of it is present will break on a real installation.**

### 18.1 Whole screens

| Screen | Present when |
|---|---|
| Room overview + domain views | The display's space is of type **room** |
| Master overview | Space type **master** |
| Entry overview | Space type **entry** |
| Signage overview | Space type **signage info panel** |
| *(no system view)* | Space type **zone**, or the display has **no space** |
| Lights / Climate / Shading / Media / Sensors / Energy domain views | Per §5.3 — each independently |
| Security view | **Always** |
| Standalone Energy view | Energy supported **and** no room Energy domain view |
| Dashboard pages | Zero or more, authored in the Admin |

### 18.2 Elements inside screens

| Element | Present when |
|---|---|
| Bottom nav **Home** tab / side dock Home tab | A system view exists |
| Bottom nav **More** tab (+ its badge) | ≥ 1 dashboard page |
| Bottom nav **Mode** button / landscape mode chip | The active domain view registers a mode config — **Lights, Climate, Shading and Energy only**; Media and Sensors explicitly clear it (§6.1) |
| Nav tab **labels** | Portrait: tab is active **and** screen is not small · Landscape: screen is large |
| Buddy FAB and chat page | Buddy module enabled (`BuddyService.isModuleEnabled`) — this is the **only** element that checks it |
| Suggestion toast | **Not** gated on Buddy. The toast is mounted over the deck unconditionally and renders whenever *any* registered provider enqueues a suggestion — the `spaces-home-control` plugin registers its own provider and enqueues independently, so toasts still appear with Buddy disabled |
| Voice-activation (wake-word) indicator | The voice service is registered globally and can be enabled from Settings › Voice activation; the indicator hides only while its state is `stopped`. **Not** gated on Buddy |
| Weather card + weather-driven sky | Weather data available for the display's location |
| Scene pills (room) | The space has ≥ 1 enabled + triggerable scene |
| Energy pill (room status strip) | The space has an `energy` status widget configured |
| Energy pill (Master and Entry top bars) | Energy is supported. Whole-home figures; tapping navigates to the standalone Energy view |
| Entry **locks** badge | The space has ≥ 1 lock |
| Entry **alarm** badge | The space has ≥ 1 alarm |
| Sensor pills (room status strip) | Corresponding averages exist (temp / humidity / illuminance — each independently) |
| Room domain card **quick actions** | Per domain; media actions are rendered but **disabled only when there is no active media activity** — they stay enabled while an activity is paused or stopped (§8.1) |
| Room domain card **target value** | Hidden on landscape and small screens |
| Lights role selector | > 1 configured role |
| Lights capability switcher | The role supports ≥ 2 capabilities |
| Lights presets | The active capability has presets |
| Lights scenes column / grid / header button | Lighting scenes exist; the header button only when the landscape column can't fit them |
| Climate **climate-devices** header button | > 1 climate actuator |
| Climate **auxiliary-devices** header button | ≥ 1 fan / humidifier / dehumidifier / purifier |
| Climate mode options | Room capability (heater-only → Heat, cooler-only → Cool, dual → both). Auto is currently disabled. |
| Climate / sensors "+N more" tile | The list overflows the available height |
| Media **remote** button | Media is on **and** a remote target resolves |
| Media **devices** button | Device groups exist |
| Media activity selector | > 1 activity available |
| Media composition card | The active activity has composition entries |
| Sensors environment summary | The space reports environment averages (its absence adds a grid column in landscape) |
| Sensors alert banner | ≥ 1 sensor in alert |
| Energy production + net cards | Production data exists |
| Energy top-consumers button | A breakdown exists |
| Dashboard page top bar | The page sets `showTopBar` |
| Dashboard page data-source widgets | The page has data sources |
| Settings **Audio** and **Voice activation** tiles | The display reports speaker or microphone support |
| Screen saver | Enabled in display settings |
| Screen power-off | Enabled **and** screen saver disabled |
| Inactivity overlay at all | `screenLockDuration > 0`. **Note:** it is registered globally and currently fires on signage displays too (see §8.4) |
| Deck nav chrome on a signage display | Currently **always** present — signage does not suppress the bottom bar / side dock today (see §8.4) |
| Device offline indication | Device is unreachable. Two different mechanisms: the **rich** detail screens dim the controls behind a `DeviceOfflineState` widget (defined in `device_offline_overlay.dart`), while the **generic fallback** screen shows an *Offline* warning chip in its `AppTopBar` (§12) |
| Role sheet footer (*Sync all* / *Retry*) | The role is mixed, or has offline devices |

---

## 19. Worked examples from real installations

These are the shapes a designer should mock, because they are what actually ships.

### A. Living-room panel, landscape, well-configured

*Devices:* 4 Shelly Dimmer 2 (ceiling + wall sconces + 2 lamps), a Home Assistant thermostat, 2 Shelly 2.5 roller shutters, an LG TV + Sonos beam via Home Assistant, a Zigbee2MQTT temp/humidity sensor, and a Shelly PM plug. Roles fully assigned, media bindings configured.

*Deck:* `Room overview · Lights · Climate · Shading · Media · Sensors · Energy · Security · Dashboard "Kitchen"`
*Side dock:* 9 items → scrolls. Mode chip present on the Lights, Climate, Shading and Energy headers only (Media and Sensors do not register one).
*Room overview:* full sky panel with weather, scene pills on the sky, status strip on top with temp + humidity + energy pill, **4** domain cards in a 2-up grid (Lights, Climate, Shading, Media) — sensors and energy appear only as pills in the strip, never as cards.

### B. Bedroom panel, portrait, minimal

*Devices:* 2 WLED strips, one Zigbee temperature sensor with a sensor role assigned. No covers, no media, no metering.

*Deck:* `Room overview · Lights · Sensors · Security`
*Bottom bar:* Home + Lights + Sensors + Security. **No More tab** (no dashboard pages). Mode button appears only on Lights.
*Room overview:* sky panel (40 % height), **no scene pills** (no scenes), **1** domain card (Lights — sensors never produce a card), status strip with one temperature pill and **no energy pill**.

### C. Hallway panel assigned to the "entry" space

*Deck:* `Entry overview · Security`
*No domain views at all.* The screen is the house-mode grid + security panel with lock/alarm badges.

### D. Freshly installed panel, room has devices but nothing configured yet

*Deck:* `Room overview · Security` — because no roles/bindings exist yet, so no domain views qualify.
*Room overview:* ⚠️ **not** the empty state — it still shows domain cards for Lights, Climate, Shading and Media, and those cards are **dead ends**. The overview rebuilds its own `DomainCounts` from the raw device categories and does **not** pass the loaded target/binding counts, so they stay `null` and `hasDomain` returns true for anything with a device. Tapping such a card fires a navigation event for a deck item that `DeckService` has already removed, the lookup returns −1, and nothing happens.

The success-icon empty state ("Nothing to control here") only appears when the room has **no domain-classified devices at all** — not merely when nothing is configured.
If the installer assigns light roles in the Admin, a Lights view appears **live** without restarting the panel, and until the first fetch completes it may briefly show the *not-configured* state with the header intact.

### E. Panel that lost its backend

Deck stays on screen; after 2 s a warning banner appears; after 10 s a modal overlay; after 60 s a non-closable full-screen "Connection lost" with *Reconnect* and *Change gateway*. If the user was on the Media view, a blocking wifi-off card had already covered it at second 0.

---

## 20. Localization, units and formatting

- **Languages (6):** English `en_US`, Czech `cs_CZ`, German `de_DE`, Spanish `es_ES`, Polish `pl_PL`, Slovak `sk_SK`. The active language is pushed from the backend config and cached locally so the first frame after boot is already correct.
- **Text expansion:** German, Czech and Polish run noticeably longer than English. Nav labels, tile labels and mode names are all single-line and ellipsised — designs must survive ~1.6× English width in those slots, or accept truncation.
- **Time — ⚠️ every clock in the display app is 24-hour today.** A 12 h / 24 h setting exists in the backend config and is exposed in Settings › Language, but **no clock consumes it**. All four clock surfaces hard-code 24-hour output:

  | Surface | Implementation |
  |---|---|
  | Sky panel clock | `DateFormat('HH:mm')` |
  | Time tile | `getFormattedTime()`, whose format argument defaults to `'HH:mm'` |
  | Screen-saver flip clock | reads `DateTime.hour` directly (0–23) |
  | Signage clock | manually zero-pads `dt.hour` |

  **Do not design an AM/PM clock treatment on the assumption it can be dropped in.** If 12-hour support is wanted, say so explicitly — it is engineering work in all four places (and an AM/PM affix needs a designed slot, especially in the flip clock). Dates *are* properly localised everywhere except the signage panel.
- **Number format:** `comma_dot` (`1,234.56`), `dot_comma` (`1.234,56`), `space_comma` (`1 234,56`), `none`. Selectable in Settings › Language with a "System default" option.
- **Units** (each independently overridable per display, with a "system default" option):
  - Temperature: Celsius / Fahrenheit — also changes the ± step (0.5 °C vs 1 °F) and the setpoint rounding. ⚠️ **Not applied by the room sky panel** (§8.1), which renders the provider value with a bare `°`.
  - Wind speed: m/s, km/h, mph, knots
  - Pressure: hPa, mbar, inHg, mmHg
  - Precipitation: mm, inches
  - Distance: km, miles, meters, feet
- **Timezone — ⚠️ also unwired.** Settings › Language offers a timezone selection and it is persisted to the system configuration, but **no display surface applies it**: the sky panel, time tile, screen saver and signage clock all read `DateTime.now()`, i.e. the panel's OS timezone. A search for `timezone` across the panel finds consumers only in the settings page, the config models and the generated API client. On a panel whose OS timezone differs from the configured one, changing the setting changes nothing on screen.
- ⚠️ Minor gap: the suggestion toast's **Dismiss** button label is a hard-coded English literal rather than a localized string, so it does not translate.
- Temperatures render with **1 decimal** in summaries, **0 decimals** in the climate hero.
- Energy renders with a value-dependent decimal count.

---

## 21. Constraints and non-negotiables for a new design

**Hard constraints**

1. **Portrait and landscape are both first-class** and are different compositions, not reflows. Every screen needs both.
2. **Three size classes** (small / medium / large) per orientation, with real layout differences at each.
3. **Touch-only.** No hover states, no right-click, no keyboard shortcuts. Minimum comfortable target ≈ 40–44 px at the DPR-2 baseline (current nav pills are 36–40 and are already at the low end — increasing them is welcome).
4. **Both themes.** Dark mode is not an inversion: the `lightN` steps flip direction. Supply both.
5. **Six states per screen** (§17), plus a locked/pending + rollback treatment for the controls that run the **shared state machine** — *not* for everything in the settling table. Media transport is in that table but supports only an **immediate active-state change** (no lock, no rollback), and the room-card media buttons support nothing at all. See the three-level table in §17 before designing any media feedback.
6. **Everything is conditional** (§18). Mock the sparse variants, not just the full one.
7. **Bundled assets only.** No web fonts, no remote imagery. New icon needs should map to Material Design Icons or ship as vectors.
8. **Performance:** Raspberry Pi class GPU. Avoid multiple stacked `BackdropFilter`s, large blurs, per-frame custom painting outside the existing sky/charts/ring, and long shadow chains.
9. **Immersive kiosk:** no OS chrome; the vertical swipe-down for Settings and the horizontal deck swipe are the only *global* gestures (the suggestion toast adds its own local horizontal swipe, §6.5) — do not design a screen that fights them (e.g. a full-page vertical carousel).
10. **Signage should never blank** — but note this is a *target*, not current behaviour: today a signage display still carries the deck chrome and still runs the idle overlay (§8.4). Design for the intended end state and flag the gap.

**Strong conventions worth keeping**

- The **domain colour bindings** (lights = amber, climate = blue, shading = teal, media = red, sensors = cyan, energy = green) are used consistently across the deck, room cards, headers and nav — changing them means changing them everywhere at once.
- The **giant numeral + gradient slider + presets** hero pattern is the app's signature interaction and is shared by lights, climate and shading. Diverging per domain would cost a lot of code.
- **Sheets in portrait, drawers in landscape** for the same content — with one exception: the deck **"More" sheet is a bottom sheet in landscape too**, because the side dock calls the same unconditional `showBottomSheetDialog` helper as the bottom bar.
- **"+N more" overflow tiles** rather than scrolling secondary lists off-screen.
- **Header subtitle as the live-state line** (and its colour as the state indicator).

**Known weak spots — a redesign is explicitly welcome here**

- The **signage info panel** is a shell, and it does not yet suppress the deck chrome or the idle overlay (§8.4).
- **12 device-detail screens are registered placeholders** showing only a "detail preparing" message — alarm, camera, door, doorbell, lock, outlet, pump, robot vacuum, sprinkler, switcher, valve, water heater (§12, tier 2). The shell is already correct, so designs drop straight in.
- The **lock screen** is a plain black rectangle; there is no PIN keypad implemented in the display app today despite the concept appearing in older docs.
- **All clocks are 24-hour, and the timezone setting is unwired**; both are surfaced in Settings › Language but consumed by nothing (§20).
- **The sky panel ignores the temperature-unit override**, rendering a bare `°` while the weather tiles and detail page convert correctly (§8.1).
- **Master** and **Entry** overviews still use the older `AppTopBar` + ad-hoc cards idiom rather than the newer `PageHeader` + `HeroCard` design language used by the room and domain views. They look visibly older.
- **Climate Auto mode** is intentionally disabled pending a dual-setpoint control.
- **Auxiliary-only Climate rooms are a dead end** (§17): the deck keeps the page because `isActuator` accepts the `auxiliary` role, but the page has no actuators to show, so it renders not-configured forever while the fan/humidifier it *does* have sits unreachable behind the auxiliary sheet.
- **The Security screen has no arm/disarm control** — its selector is a tab switcher and the only write action is acknowledging alerts.
- **The room overview and the deck disagree about which domains exist.** The deck hides a domain once its target/binding count loads as `0`, but the overview rebuilds counts from raw device categories without those numbers, so it keeps rendering a card for the hidden domain. The card then navigates nowhere. Any redesign of the room overview should assume this gets fixed — do not design around the dead card.
- The **scene tile** (dashboard) uses a raw Material `Card` and does not match `UniversalTile`.
- **Visual density is build-time only** (§3.1) — there is no runtime density control despite the token system supporting three levels.

---

## 22. Deliverables checklist

For the new design to be droppable onto the current app, please deliver:

**Foundations**
- [ ] Colour: 12 families × 7 steps, light **and** dark; surfaces, borders, fills, text roles, shadows
- [ ] Type: the 6-step scale plus specs for the display numerals (hero, sky clock, time tile, signage clock, flip clock)
- [ ] Spacing, radius, elevation, motion tokens
- [ ] Icon direction (MDI-compatible) and the weather glyph set
- [ ] Tile geometry: aspect ratios, standard tile heights/widths

**Components** (each in default / active / pending / disabled / offline, light + dark)
- [ ] PageHeader (+ compact) · AppTopBar · header icon button · header main icon
- [ ] HeroCard / BaseCard
- [ ] UniversalTile — vertical and horizontal, all state flags
- [ ] ModeSelector — horizontal / vertical, icon-top / icon-left, with and without labels, two-line label variant
- [ ] SliderWithSteps — all five light gradients, the temperature gradient, the position slider
- [ ] Nav: bottom bar (small/medium/large), side dock (65 and 90), tab pill, badge, mode button, mode chip, mode popup
- [ ] Sheets and drawers, section titles, alert banner, toasts
- [ ] Overlay templates: banner, modal card, full-screen — in all five colour schemes, with 1 and 2 actions
- [ ] Empty / error / not-configured / loading templates

**Screens** (portrait + landscape, at least small and large)
- [ ] Room overview (full, sparse, empty) incl. the sky panel across ≥ 4 gradient/time combinations
- [ ] Lights, Climate, Shading, Media (all 6 body states), Sensors, Energy
- [ ] Security (all three tabs)
- [ ] Master overview · Entry overview · Signage panel
- [ ] Tiles page · Cards page · **all five rendered tile variants** — device preview, scene, time, weather *current*, weather *forecast* (weather is one plugin but two distinct layouts, so it needs two designs)
- [ ] Device detail: one rich example (lighting), one media example, the **tier-2 placeholder** shell, and the generic fallback
- [ ] Settings: general grid + each sub-page
- [ ] Buddy chat (empty / typing / error) + voice indicator + voice overlay
- [ ] Startup: loading, discovery (all six sub-states), space selection, fatal error
- [ ] Screen saver + lock screen

**Documentation**
- [ ] A mapping note for any component you rename or merge, so the implementation can be traced back to the widgets in §16.
