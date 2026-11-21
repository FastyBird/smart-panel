# Display UI design brief

> **Round 1 brief, 2026-11-21.** This is the work order for a designer (human or Claude Design) who will produce one
> design system and a complete set of screen designs for the **FastyBird Smart Panel display app**: the Flutter
> touch UI in `apps/panel/` that runs on wall-mounted panels.
>
> **The goal is one universal UI:** a single layout system that works on every supported panel, from a 4" square
> wall panel up to a 13" tablet, in portrait and landscape, in light and dark, without hand-made layouts per device.
>
> **How it relates to the other documents:**
>
> - [`display-app-design-spec.md`](display-app-design-spec.md) is the behaviour reference. It describes every
>   screen, rule and edge case as of July 2026, in more depth than this brief. Section references such as "spec §8.1"
>   point into it. Read the matching spec section before you design a screen.
> - This brief says what to design, adds what changed since July (room modes, schedules, occupancy, automations,
>   thermostats, device groups, hardware inputs), analyses screen sizes, lists the deliverables, and records the
>   product decisions for the redesign (§13.1): per-room accent colours, thermostat control on the panel, alarm
>   arming on the panel, and cameras with a video doorbell.
> - [`admin-ui-design-spec.md`](admin-ui-design-spec.md) is the approved admin redesign (November 2026). The display
>   should look like the same product. See §4.3.
>
> When this brief and the code disagree, the code wins. Report the difference instead of designing around it.

---

## Contents

1. [Product context](#1-product-context)
2. [Technical constraints](#2-technical-constraints)
3. [Screen sizes and the universal layout system](#3-screen-sizes-and-the-universal-layout-system)
4. [Current visual language](#4-current-visual-language)
5. [App shell, navigation and global layers](#5-app-shell-navigation-and-global-layers)
6. [Screen catalogue](#6-screen-catalogue)
7. [Shared state model](#7-shared-state-model)
8. [Configurations to mock](#8-configurations-to-mock)
9. [Where the UI drifts today](#9-where-the-ui-drifts-today)
10. [Copy, language and units](#10-copy-language-and-units)
11. [Non-negotiables](#11-non-negotiables)
12. [Deliverables](#12-deliverables)
13. [Open decisions](#13-open-decisions)
14. [Source pointers](#14-source-pointers)

---

## 1. Product context

**FastyBird Smart Panel** is a self-hosted smart-home hub. A backend runs on a Raspberry Pi or a small server and
connects to devices (Shelly, Zigbee2MQTT, Home Assistant, HomeKit, Homey, Modbus, WLED, virtual devices and more).
The **admin app** (browser) is where everything is set up. The **display app** is what people in the house touch.

**What the display app is:**

- A **kiosk**. It is full screen, always in the foreground and has no OS chrome. It sits on a wall at eye or chest
  height, or on a shelf.
- **Bound to one space.** At first boot the panel is assigned to a space: a room, a zone, or a synthetic space
  (whole home, entry, signage). That assignment decides which screens exist.
- **Generated, not authored.** Most screens are built from what is installed and configured: which devices are in
  the room, which roles they have, whether energy metering exists. Users can add their own dashboard pages in the
  admin. **Almost every screen and every element can be missing** (§8, spec §18).
- **A flat deck.** All top-level screens sit in one horizontal, swipeable carousel. Depth is used only for detail
  pages, sheets, drawers and overlays.

**Who uses it:**

| User | What they do | What they need |
|---|---|---|
| **Household member walking past** | Glances at the time, weather, temperature, whether lights are on or the door is locked. | Readable from 1–2 m. Big numerals, clear status colour, no reading required. |
| **Household member at the panel** | Turns lights on or off, sets a scene, changes the temperature, closes blinds, starts music or a TV activity, switches the room mode. | One or two taps for common actions. Large targets. Immediate feedback that the tap did something. |
| **Guest or child** | Uses the obvious controls. | No hidden gestures for essential actions. Nothing destructive within easy reach. |
| **Installer or power user** | Assigns the panel to a room, checks a device, reads diagnostics, restarts the panel. | Diagnostics and settings reachable, but kept out of the everyday path. |

**Tone:** calm, warm, glanceable. This is an appliance on a living-room wall, not an operations console. The admin is
the place for density and diagnostics; the display is the place for clarity.

## 2. Technical constraints

| Topic | Today |
|---|---|
| Framework | **Flutter** (Dart), one codebase. Material 3 is the base widget set, but most screens use the app's own components (§4.5). |
| Targets | **Linux via `flutter-pi`** on Raspberry Pi with DSI or HDMI touch panels, and **Android** tablets and commercial wall panels. Other Flutter targets exist in the repo but are not products. |
| GPU | Raspberry Pi 4 class. Must run at 30–60 fps. Flat fills, gradients and simple shadows only. There is one real blur in the app (the sky weather card). No stacked translucency, no large blurs, no per-frame shaders. |
| Input | **Touch only.** No hover, no right-click, no keyboard shortcuts. The on-screen keyboard appears only for the manual gateway URL, the Buddy chat field, and (today, wrongly) two thermostat screens (§9). Haptics on Android only. |
| Display mode | Immersive: no status bar, no navigation bar, no OS back gesture. The app owns every pixel. |
| Orientation | Fixed per installation (a wall panel does not rotate), but **portrait and landscape are both supported and are different compositions**, not reflows. One device (reTerminal) can auto-rotate. |
| Theme | Light and dark, switched in Settings. |
| Fonts | Bundled, no network: **Roboto** (UI) and **DIN 1451** (numerals and data readouts). |
| Icons | **Material Design Icons** (`material_design_icons_flutter`) everywhere, plus `weather_icons` for weather glyphs. Space and device icons come from backend-configured MDI names. |
| Images | No internet images and no photos. All imagery is icons, gradients and custom-painted shapes (sky, charts, cover visualisations). **Camera snapshots and live video from the local backend are the one exception** (§6.K). |
| Video | None today. Camera live view (§6.K) needs hardware video decoding. Plan for **one live stream on screen at a time**; grids of cameras use snapshots that refresh every few seconds. |
| Languages | English, Czech, German, Spanish, Polish, Slovak. Design for about **60 % text expansion** in single-line slots (nav labels, tiles, chips). |
| Extensibility | Pages, tiles and data sources are plugins. A tile only knows its grid cell size. Designs for tiles must work at any cell size from about 1×1 to 4×6 units. |

**You can change:** the colour palette, type scale, spacing, radii, elevation, iconography rules, component shapes
and states, every screen composition, the navigation chrome, motion, and copy tone.

**You cannot change (without asking):** the flat deck model, the space-driven screen generation, the touch-only
and kiosk nature, the bundled-assets rule, the six languages, and the GPU budget. New *functionality* (a control
that does something the app cannot do today) is welcome, but mark it as new (§12.5).

## 3. Screen sizes and the universal layout system

This is the part the designer must get right first, because every screen depends on it.

### 3.1 How a design value becomes pixels today

All dimensions in the code are written as **design pixels** at a DPR 2.0 baseline, then scaled:

```
logical size  = design value × (2.0 / devicePixelRatio) × densityMultiplier
physical size = logical size × devicePixelRatio
              = design value × 2 × densityMultiplier
```

So in practice **one design pixel is two physical pixels**, whatever the panel's DPR. A panel's **design canvas** is
its physical resolution divided by two. A 1280×800 panel is a 640×400 canvas.

`densityMultiplier` is `0.85` (compact), `1.0` (normal) or `1.15` (large). It is chosen once at startup: a build
flag if set, otherwise **compact when DPR ≥ 2.5**, normal below. It only reaches values that go through the token
helpers (spacing, font size, radius). Widgets that use raw Material defaults are not scaled at all (§9).

Where the DPR comes from:

- **flutter-pi:** `DPR = (10 × horizontal px) / (width_mm × 38)`, using the panel's reported width in millimetres.
  Without valid dimensions it is 1.0. The official Pi DSI panel is assumed to be 155 × 86 mm. Installers can override
  the millimetres with `FB_DISPLAY_DIMENSIONS` in `/etc/smart-panel/display`.
- **Android:** the OS density bucket (usually 1.33–2.0 for tablets, 2.5+ for high-density ones).

### 3.2 Supported panels

Numbers are for the panel in landscape. Portrait swaps width and height. DPR values are typical; the exact value
depends on the millimetres the panel reports.

| Panel | Physical px | Pixel density | DPR (typical) | **Design canvas** (L / P) | Size class today (L / P) | Density today |
|---|---|---|---|---|---|---|
| 4" square Android wall panel *(stretch target)* | 480 × 480 | ~170 ppi | 1.0–1.5 | **240 × 240** | small | normal |
| Raspberry Pi 7" Touch Display (v1) | 800 × 480 | ~133 ppi | 1.36 | **400 × 240** / 240 × 400 | small / small | normal |
| Generic 7" HDMI/DSI panel | 1024 × 600 | ~170 ppi | 1.75 | **512 × 300** / 300 × 512 | medium / small | normal |
| Raspberry Pi Touch Display 2 (7") | 1280 × 720 | ~210 ppi | ~2.2 | **640 × 360** / 360 × 640 | large / medium | normal |
| Seeed reTerminal (5") | 1280 × 720 | ~293 ppi | ~3.0 | **640 × 360** / 360 × 640 | large / medium | **compact** |
| 10.1" panel (reTerminal DM, Waveshare) | 1280 × 800 | ~150 ppi | ~1.55 | **640 × 400** / 400 × 640 | large / medium | normal |
| 8" Android tablet | 1280 × 800 | ~190 ppi | 1.33 | **640 × 400** / 400 × 640 | **medium** / medium | normal |
| 10–11" Android tablet | 1920 × 1200 | ~220 ppi | 2.0 | **960 × 600** / 600 × 960 | large / large | normal |
| 15.6" HDMI touch monitor on a Pi | 1920 × 1080 | ~140 ppi | ~1.47 | **960 × 540** / 540 × 960 | large / medium | normal |
| 12–13" Android tablet | 2560 × 1600 | ~240 ppi | 2.5 | **1280 × 800** / 800 × 1280 | large / large | **compact** |

Size classes today come from a width breakpoint that depends on orientation (`spec/displays/screen_breakpoints.json`):

| Class | Portrait width | Landscape width |
|---|---|---|
| small | ≤ 600 | ≤ 800 |
| medium | ≤ 800 | ≤ 1150 |
| large | > 800 | > 1150 |

The width is measured in **physical** pixels when DPR > 1.5 and in **logical** pixels otherwise.

### 3.3 Problems with the current model

1. **The same canvas lands in different classes.** A 640 × 400 canvas is *large* on a 10.1" Pi panel (DPR 1.55) and
   *medium* on an 8" Android tablet (DPR 1.33), because the breakpoint switches units at DPR 1.5. Two panels that
   show the same amount of content get different layouts.
2. **The design unit is tied to pixels, not to millimetres.** A 44 design px touch target is about 17 mm on the
   7" Pi panel and about 6.5 mm on the reTerminal, which also gets compact density. The UI is huge on low-density
   panels and too small on high-density ones. The installer docs tell reTerminal users to fake the panel size with
   `FB_DISPLAY_DIMENSIONS`, but that changes only the DPR, which the scaling cancels out. It makes almost no
   difference to the scaled UI.
3. **Density works backwards.** Compact is picked for *high-density* screens, where elements are already physically
   smallest.
4. **Unscaled widgets.** Newer screens use stock Material widgets (chips, switches, dialogs, app bars) that ignore
   the scaling. On a 3.0 DPR panel they render at a different physical size from the rest of the screen.

### 3.4 What we want designed: one layout system, five artboards

Design every screen on these **canonical artboards** (design pixels at normal density). They cover every row of the
table above. Engineering will map real panels onto them.

| Artboard | Landscape | Portrait | Stands for |
|---|---|---|---|
| **XS** | 400 × 240 | 240 × 400 | 7" 800 × 480 panels, and as the floor for the 4" square panel (240 × 240) |
| **S** | 512 × 300 | 300 × 512 | 7" 1024 × 600 panels |
| **M** | 640 × 360 | 360 × 640 | 5"–7" 720p panels (reTerminal, Pi Touch Display 2) |
| **M+** | 640 × 400 | 400 × 640 | 8"–10" 1280 × 800 panels and tablets |
| **L** | 960 × 600 | 600 × 960 | 10"–15" 1080p/1200p tablets and monitors |

Plus **one square artboard (240 × 240)** for the room overview, one domain view and the overlays, to prove the
smallest case.

**Size classes.** Please define the final rules, but start from this proposal. It is based on the canvas's **short
side**, so portrait and landscape of the same panel stay in the same class, and it does not depend on DPR:

| Class | Short side (design px) | Artboards |
|---|---|---|
| **Compact** | < 300 | XS, square |
| **Regular** | 300–479 | S, M, M+ |
| **Expanded** | ≥ 480 | L (and 1280 × 800) |

Orientation is a separate axis. That gives six layouts per screen (3 classes × 2 orientations) plus the square
case.

**Physical size floor.** Please give minimums in **millimetres** as well as design px, for:

- the smallest touch target (we suggest at least 9 mm, with 12 mm for primary controls),
- the smallest body text and the smallest caption,
- the hero numeral when read from 2 m.

Engineering will use these to pick the density per panel from its real pixel density, instead of from the DPR, so
the reTerminal gets a larger density, not a compact one. Your artboards stay the same.

**Glance distance.** Everything on a system view (§6.B) should be readable at 1.5 m on the XS artboard: clock, room
temperature, domain state, alerts.

### 3.5 What changes between classes today

Use this as the starting list of layout differences. Keep, change or extend it, but write down the rule for each.

| Element | Compact | Regular | Expanded |
|---|---|---|---|
| Deck nav (portrait) | Bottom bar, icons only | Bottom bar, label on the active tab | Same as regular |
| Deck nav (landscape) | Side dock 65 wide, icons only | Side dock 65 wide, icons only | Side dock 90 wide, icon + label |
| Room overview domain cards | 2 columns, aspect 1.4, max height 90, Shading quick actions icon-only | 2 columns, aspect 2.0, max height 95 | Same as regular |
| Domain hero numeral | 25 % of card height | 35 % of card height (clamped 48–160) | Same |
| Secondary grids (sensors, scenes) | 2 columns, horizontal tiles | 3 columns, vertical tiles | 3 columns (landscape), +1 when a sidebar is hidden |
| Page header | Compact in portrait: title 14, subtitle 10, 4 vertical padding | Title 16, subtitle 12 | Same |
| Sky panel clock (landscape) | 48 | 72 | 72 |

Questions the design should answer for every screen: what drops out on compact, what gets a second column on
expanded, and where the **"+N more" overflow** starts.

## 4. Current visual language

Full values are in spec §4. This is the summary you need to judge what to keep.

### 4.1 Tokens

| Group | Today |
|---|---|
| Spacing | `1, 2, 4, 8, 16, 32`. 8 is the workhorse (page padding, gaps, header padding). |
| Radius | `2` small, `6` base (cards, tiles, buttons, pills), `12` medium (popups, drawers, dock), `20` round (badges). |
| Type | `8, 10, 12, 14, 16, 18`. Plus computed display numerals: hero 48–160 (DIN, weight 200), sky clock 56/72, time tile 90, signage clock 120, flip clock 44. |
| Colour | 12 families × 7 steps (`base`, `dark2`, `light3`…`light9`) in light and dark. In dark mode the `lightN` steps get *darker*. Primary is FastyBird red `#D9230F`. |
| Surfaces | Page `#F2F3F5` / `#0A0A0A`, card `#FFFFFF` / `#141414`, overlay `#FFFFFF` / `#1D1E1F`. |
| Motion | 100 / 200 / 300 ms. Route transitions are fades (cheap on GPU). Adjacent deck pages slide; distant jumps crossfade. |
| Tile geometry | Aspect ratios 1.0 / 2.0 / 2.5 / 3.0. Horizontal tile height 50 (most lists use 42.5). |

### 4.2 Domain colours (load-bearing)

Each domain has one colour, used consistently on nav tabs, room cards, headers and heroes.

| Domain | Today (family) | Admin spec (approved) |
|---|---|---|
| Lights | warning (amber) | `#a35600` / dark `#f0a742` |
| Climate | info (blue) | `#0277a8` / dark `#4fb3e8` |
| Shading (covers) | teal | `#00796b` / dark `#4db6ac` |
| Media | danger (red) | **`#c2185b` (magenta)** / dark `#f06292` |
| Sensors | cyan | `#00838f` / dark `#4dd0e1` |
| Energy | success (green) | `#2e7d32` / dark `#6cc070` |
| Cameras *(new screens, §6.K)* | — | `#3949ab` / dark `#7986cb` |

Today media uses the same red as primary, danger and active alerts, so "media is playing" looks like "something is
wrong". The admin already moved media to magenta.

### 4.3 Alignment with the admin redesign

The admin redesign (approved 2026-11-19) made these decisions. The display should follow them unless you argue
otherwise:

- **Brand red is an accent only.** In the admin, primary is blue `#2563c9`, and red on screen always means danger.
  The display today uses red as primary (active nav tab, FAB, triggering scene pill, filled buttons), which collides
  with danger, alerts and media.
- **One palette, semantic tokens.** Status colours (ok, warn, danger, info, primary) each have a text, soft and border
  shade, tuned for AA contrast in both themes.
- **Domain colours** as in §4.2.

The display has its own needs the admin does not: the sky panel, giant numerals, domain-tinted heroes, glanceability.
It should feel like the same brand, not the same layout.

### 4.4 Accent themes per room (decided, new functionality)

A panel lives in a room, and people want it to match the room. The user picks an **accent colour** for each panel,
so a bedroom panel can be warm and a kitchen panel cool. Design the colour system so the accent is swappable:

- **Deliver a set of accent palettes** (we suggest 8, for example blue, teal, green, amber, terracotta, rose, violet,
  graphite). Each needs light and dark values, the same steps as every other family, and must pass AA contrast for
  text and filled controls in both themes. Mark one as the default; it follows the brand decision in §13.
- **What the accent colours:** primary buttons, the active nav tab and dock item, selection and focus, switches and
  slider thumbs outside a domain view, the assistant button, the screen saver clock, and optionally a tint on the
  page background and the sky panel's night gradient.
- **What the accent never colours:** status colours (ok, warning, danger, info), the domain colours (§4.2) and alert
  overlays. Those carry meaning and stay fixed on every panel.
- **Guard against collisions.** A red or amber accent must not be confused with danger or warning. Either leave
  those hues out of the set, or make sure status never relies on colour alone (icon + label + shape).
- **Where it is set:** a colour on the space in the admin is the default for every panel in that space; each panel
  can override it in Settings › Display. Design the picker for the panel (a row of swatches with a live preview)
  and show the same swatches in the master overview's rooms list, so whole-home panels show each room in its colour.
- Show the full room overview and one domain view in **at least three accents**, light and dark, to prove the system.

The backend has no room colour or display accent today: this needs a new field on spaces and displays.

### 4.5 The de-facto component set

About 40 screens are built from these. Spec §16 describes each one. Re-skin and rationalise them; do not replace
them with new primitives without a mapping (§12.6).

`PageHeader` (+ compact) · `HeaderMainIcon` / `HeaderIconButton` · `AppTopBar` (older, denser) · `HeroCard` /
`BaseCard` · `UniversalTile` (vertical and horizontal; active, offline, selected, glow, warning badge, double border,
icon-tap vs body-tap) · `ModeSelector` (horizontal or vertical, icon-top or icon-left, two-line labels) ·
`IntentModeSelector` · `SliderWithSteps` (gradient track + step labels) · `CircularControlDial` · `ValueSelector` ·
`IconSwitch` · `CardSlider` · `ButtonTile` · `SectionTitle` / `SectionHeading` · `AlertBanner` · `Toast` ·
bottom sheet / right drawer pair (`DeckItemSheet` / `DeckItemDrawer`) · scroll containers with gradient edge masks ·
`FixedGridSizeGrid` / `FixedTileSizeGrid` · `FlipClock` · `DomainStateView` (loading, error, empty, not configured)
· `IconContainer` · the four layout shells (`PortraitViewLayout`, `LandscapeViewLayout`, `DevicePortraitLayout`,
`DeviceLandscapeLayout`) · `DeviceOfflineState` · `DevicePowerButton` · the settings kit (`SettingsCard`,
`SettingsTile`, `SettingsToggle`, `SettingsSlider`, `SettingsSelectionDialog`).

## 5. App shell, navigation and global layers

Spec §5–§6 has every measurement. What the designer must cover:

### 5.1 The deck

The deck is one ordered list of full-screen pages:

```
[ system views for the space ] → [ Security ] → [ Energy (standalone) ] → [ dashboard pages 1…n ]
```

- **Room:** Room overview, then one domain view per present domain, always in the order Lights, Climate, Shading,
  Media, Sensors, Energy.
- **Master / Entry / Signage:** one overview each.
- **Zone:** no system view, so the deck starts on Security.
- **Security** is always present. **Standalone Energy** appears when energy is supported and the room has no Energy
  domain view. **Dashboard pages** are 0 to n.
- The landing page is the first page, or a page chosen in the admin.

The deck can have **2 pages** (entry panel: Entry overview, Security) or **12+** (a full room with dashboards).
Design the navigation for both ends.

### 5.2 Navigation chrome

| Element | Portrait | Landscape |
|---|---|---|
| Deck navigation | **Bottom bar**, 52 high: pinned Home tab, a horizontally scrolling strip of tabs that auto-centres the active one, a "More" tab, and a mode button on the right | **Side dock**, a floating card 65 or 90 wide, vertically centred: Home, divider, scrolling tabs. No mode button. |
| Mode control for the current domain | Icon button on the right of the bottom bar, opens a popup **above** the bar | **Mode chip** in the page header's right slot, opens a popup **below** it |
| "More" | A bottom sheet "All pages": a grid of every deck page, current one highlighted. Present only with ≥ 1 dashboard page; carries a count badge. | Same bottom sheet (not a drawer) |
| Secondary lists | Bottom sheet | Right drawer |

Only Lights, Climate, Shading and Energy have a mode control. For Energy it is a **range picker** (Today, Week,
Month), not a mode. Media and Sensors have none.

### 5.3 Global gestures

| Gesture | Result |
|---|---|
| Horizontal swipe | Previous or next deck page (blocked while dragging a slider or dial) |
| Swipe down anywhere | Opens **Settings** |
| Swipe up in Settings | Closes Settings |
| Tap | The only selection gesture. There is no long-press and no drag-to-reorder. |
| Swipe on the suggestion toast | Dismisses it |

Settings is reachable only by the swipe-down gesture. That is invisible to a new user. Please propose a visible
affordance that does not clutter the wall view (§13).

### 5.4 Floating layers on the deck

| Layer | Shown when | Notes |
|---|---|---|
| **Buddy button** (AI assistant) | Buddy module enabled | 48 circle, bottom right, clears the bottom bar in portrait |
| **Wake-word indicator** | Voice activation enabled in Settings and armed | Small pill top centre: Listening, Recording (with countdown), Processing |
| **Suggestion toast** | A suggestion arrives (not tied to Buddy) | Card with an action and Dismiss. Normal and warning variants. Swipe, Dismiss, action, or 30 s timeout removes it. |
| **Toasts** | After an action | Success, info, error. Short. |

### 5.5 Overlays and interrupts

All interrupts go through one overlay manager with a priority order. Each overlay has an icon, a colour scheme
(error, warning, info, success, primary), optional spinner, title, message or custom content, and 0–2 actions. Three
display types:

| Type | Behaviour |
|---|---|
| **Banner** | Top bar, page stays usable |
| **Overlay** | Dimmed page + centred card |
| **Full screen** | Blocking page |

Overlays in the app: connection loss (escalates banner → overlay → full screen over 60 s; auth, network and server
failures go straight to full screen), security alerts (up to 3 alerts + "+N more", Acknowledge, Open security),
system actions (restart, power off, factory reset in progress, done, failed), inactivity (screen saver flip clock,
or a black lock screen), and the media-only "live connection required" block. Details: spec §15.

**New interrupts to design** (decided features, §6.D and §6.K): **alarm entry delay** and **alarm triggered**
(full screen with keypad, above everything except connection loss), and **doorbell ring** (full screen with live view
and Unlock / Dismiss). All three must wake the panel from the screen saver and black lock screen. Define the priority
order of all interrupts, and what happens when two arrive at once (for example a ring during an entry delay).

## 6. Screen catalogue

Every screen below needs: **portrait and landscape**, the **three size classes**, **light and dark**, and the states
listed. "Functions" is what the user can do. "Variants" is what changes the composition. Spec section numbers point
to the full rules.

### A. Startup and provisioning

These are full-screen standalone pages. The deck and its chrome do not exist yet.

| Screen | Functions | Variants and states |
|---|---|---|
| **Loading** | — | Spinner, shown at least 500 ms. First frame already in the right theme and language. |
| **Gateway discovery** (spec §7.2) | Find the backend on the network, pick one, rescan, enter a URL by hand, retry, cancel | **Searching** (pulse rings, live "N found", Cancel) · **Found** (selectable list of gateways: name + address; Connect, Rescan, Manual) · **Not found** (Try again, Manual) · **Error** (Try again, Manual) · **Connecting** (spinner + address) · **Manual entry** (one URL field with keyboard; Back, Connect) · **Retry mode** (a stored gateway is unreachable; error shown inside discovery while a background retry runs every 5 s) |
| **Room selection** (spec §7.3) | Assign this panel to a room | List of rooms (icon + name) + Confirm · exactly one room (pre-selected) · many rooms (scroll) · **no rooms** empty state · **saving** · save failed. Lists rooms only; zones and synthetic spaces must be assigned in the admin. |
| **Fatal error** | Restart the app | Icon, localized message, raw error detail (optional), Restart |

### B. System views (one per space type)

#### B1. Room overview — the flagship (spec §8.1)

What most panels show most of the time.

**Composition:** a **sky panel** (live gradient for time of day × weather, sun, moon, stars, clouds, rain, snow,
lightning, fog) with clock, date and a weather card; **scene pills**; the new **room mode sections** (B1a);
**domain cards**; a **status pill strip**.

| Part | Content | Functions | Present when |
|---|---|---|---|
| Sky panel | Clock, date, weather card (icon, temperature, description) | Tap weather card → weather detail | Always. Weather card only with weather data. Text colour flips per time of day. 40 combinations of 4 day parts × 10 conditions. |
| Scene pills | Icon + name per scene, ordered by category | Tap → trigger scene (pill shows spinner, then a success or error toast) | The room has ≥ 1 triggerable scene |
| Domain cards (max 4: Lights, Climate, Shading, Media) | Icon, title, primary value (mode name, temperature, position, activity), subtitle, quick actions | Tap card → domain view. Lights: Off / 50 % / 100 %. Climate: mode, −, +. Shading: Open / 50 % / Close. Media: play / pause / stop. | Per domain. Sensors and Energy never have a card. |
| Status strip | Average temperature, humidity, illuminance pills; energy pill | Tap energy pill → Energy view | Each pill independently |

Portrait: sky on top (40 % of height), content below. Landscape: sky on the left (42 % of width) with scene pills on
it, content on the right.

**States:** loading (sky stays), error + Retry, **empty** ("Nothing to control here", which can sit above live
sensor pills: design that pairing), not assigned.

#### B1a. Room mode sections — new since the spec

Four independent sections stacked between the scene pills and the domain cards. Each one hides itself when not
relevant. **They are built from raw Material widgets today and have no design** (§9). Please design them as part of
the room overview, for all sizes. They compete for the same vertical space as the domain cards, which is tight on
XS.

| Section | Shown when | Content and functions | States |
|---|---|---|---|
| **Modes** (activity modes) | The room has enabled modes, or loading them failed | One chip per mode in admin order: **Work, Relax, Sleep, Entertainment, Away**, each with an icon. Tap a mode to activate it; tap the selected one, or the extra **Manual** chip, to clear it. An info button opens **Mode details**: per-domain outcome of the last activation (Lights, Climate, Shading, Media, Security → commands completed, failed, disabled, no matching devices, not supported) and a notice that these are command outcomes, not device state. | Loading · idle (Manual) · **sending** (chips disabled, spinner) · selected + completed · selected + **partial** (warning) · selected + **failed** (warning) · selected + **interrupted** (warning) · issue: **unconfirmed**, **conflict** (changed elsewhere), **unavailable**, each with Retry |
| **Schedule** | Time schedule is enabled for the room | Read-only. Planned current mode, next change (mode · date · time · timezone), "manual selection until the next trigger", last attempt failed. Caption: planned times are not device state. | Loading · running · no upcoming entry · clock uncertain (triggers paused) · unavailable or stopped · last attempt failed |
| **Room occupancy** | Occupancy automation is enabled | Read-only. Occupied, Vacant or Unknown, plus "automation enabled" or "manual mode: automation paused" | Occupied · vacant · unknown · manual override |
| **Automations** | The room owns ≥ 1 automation | One row per automation: name, status line (On / Off · needs attention in admin · suspended (triggered too often) · last run failed), and an enable switch. Nothing else can be edited on the panel. | Row: on · off · pending (switch disabled) · invalid · suspended · last run failed. Toggle errors: incomplete, not found, failed (error toast). List of 1 and of many (scroll). |

The word **"mode" means five different things** on this panel: room activity modes (Work, Relax, Sleep,
Entertainment, Away), the Lights domain mode (Off, Work, Relax, Night), the Shading mode (Open, Daylight, Privacy,
Closed), the Climate HVAC mode (Heat, Cool, Auto, Off), and the Entry house modes (Home, Away, Night, Movie). Media
has "activities" (Watch, Listen, Gaming, Background). The design must make it obvious which one the user is changing,
and where room activity modes sit relative to the domain modes. They can set the same lights.

#### B2. Master overview (whole home, spec §8.2)

For a hallway panel. Top bar with devices-online badge (n/m), alerts badge (when > 0), whole-home energy pill (tap
→ Energy). Summary row: rooms, devices, scenes. Quick actions: whole-home scenes. **Rooms list**: icon, name, n/m
devices online, current temperature, chevron. Tap a room → its Room overview opens as a pushed page (with back).

States: loading, error + Retry, no scenes (quick actions hidden), rooms with and without temperature, all online vs
some offline. Uses the older `AppTopBar` idiom. Bring it onto the same language as the room views.

#### B3. Entry overview (spec §8.3)

For a door-side panel. Top bar badges: locks (all locked or n/m), alarm (Armed or Disarmed), whole-home energy.
**House modes**: the configured house-mode scenes as large buttons (tap → trigger), or four default buttons (Home,
Away, Night, Movie) when none are configured. **The defaults do nothing today**; design them as an "unconfigured"
state, not as working controls. Below: a security summary.

**New for the entry panel** (decided): this is where people leave and come home, so it gets the security controls
first:

- **Arm / disarm** the alarm (the same control as the Security view, §6.D), prominent, one tap to start arming Away.
- **Front door camera or video doorbell** as a live tile or snapshot (§6.K), tap → camera view.
- **Locks** as controls, not only a badge: lock and unlock each door, with confirmation for unlock.

States: loading, error, with and without locks, with and without alarm, with and without a door camera, configured
vs default house modes, triggering, alarm arming / armed / entry delay / triggered (§6.D).

#### B4. Signage overview (spec §8.4)

A read-only board: large clock and date, title, an announcements area. **It is a stub.** Treat it as greenfield:
design the chrome-free, never-sleeping board it is meant to be (clock, weather, announcements, a feed). Today a
signage panel still shows the deck chrome and still goes to the screen saver; design the intended end state and
mark it as new.

### C. Domain views (room spaces, spec §9)

All share one skeleton: `PageHeader` (icon tinted by state, title, **subtitle as the live-state line**, trailing
icon buttons, landscape mode chip), then a hero card and a secondary area. Portrait stacks hero over secondary.
Landscape puts the secondary column (flex 1) left of the hero (flex 2). Overflowing lists end in a "+N more" tile
that opens the full list in a sheet or drawer.

Every domain view needs: **loading**, **error + Retry**, **not configured** (header stays, body explains), the
**control feedback states** of §7.2, and the **offline device** treatment.

| View | Hero | Secondary area | Header actions | Mode control | Variants to design |
|---|---|---|---|---|---|
| **Lights** (spec §9.2) | Role badge (tap left half: toggle role; right half: device list), giant value (brightness, colour temperature or white), unit and colour swatch, capability switcher, gradient slider with steps, presets (values or colour swatches) | Role selector (Main, Task, Ambient, Accent, Night: name over value), lighting scenes grid or list | Scenes (landscape, when they do not fit) | Off / Work / Relax / Night | 1 role vs many · on/off-only role (no slider) · each of the 5 capabilities (brightness, colour temperature, hue, saturation, white) · role mixed (`tune` icon) · offline devices · role off (slider disabled) · role list sheet with *Sync all* or *Retry* footer · with and without scenes |
| **Climate** (spec §9.3) | Mode badge, giant temperature, temperature slider (cold-to-warm gradient), − / + buttons | Room sensors grid or list | Climate devices (> 1 actuator), auxiliary devices (fan, humidifier, dehumidifier, purifier) | Heat / Cool / Off (by capability; Auto is off in this view) | Heater-only · cooler-only · both · system off · actively heating or cooling · **room temperature notice** (new: an error banner under the header when room sensors overlap or are unavailable) · **auxiliary-only room** (no actuators: today a dead-end "not configured"; design a useful state that points to the auxiliary devices) · auxiliary devices sheet |
| **Shading** (spec §9.4) | Role badge, giant position %, position slider, Open / 50 % / Close, presets | Role selector (Primary, Blackout, Sheer, Outdoor), devices sheet with cover type icons | Devices | Open / Daylight / Privacy / Closed | Roles · mixed positions · moving · offline · **grouped covers** (new, see below) |
| **Media** (spec §9.5) | Off: activity picker. Activating: step list with per-step progress. Active: now playing (text only: track, artist, album), progress, transport, volume, source. | Activity selector (Watch, Listen, Gaming, Background), composition card (devices in play) | Devices (when groups exist), remote (when on and a remote target exists), power | — | **Six body states:** off, activating, failed (summary, details, Retry), active, no media devices (pull to refresh), not configured. **Plus** the blocking "live connection required" card over the whole page when the socket drops. Album art does not exist today (new feature if you add it). |
| **Sensors** (spec §9.6) | — | Alert banner (first alerting sensor), environment summary (avg temperature, humidity, illuminance or pressure), sensor grid with category filter in the section title; each card: icon, freshness dot, value, trend | — | — (category filter popup instead) | Normal · alerts (header turns danger) · stale or offline sensors (warning) · with and without the environment summary · filter applied · many sensors (scroll) |
| **Energy** (spec §9.7) | Consumption card (big kWh value) | Time-series chart; production and net cards (when production exists); top consumers sheet (ranked rows with bars) | Top consumers (when a breakdown exists) | **Range**: Today / Week / Month | Consumption only · consumption + production (net positive and negative) · **range switching** (keep the range picker visible while reloading) · **no data** (a permanent resting state, not a flash) · standalone version (same screen outside a room) |

**Grouped covers (new).** When the room's covers are configured as a backend cover group, the **whole Shading view is
replaced** by a plain Material screen: "Reported physical feedback" (Unknown, Mixed or the position), an explanation
that Open/Close confirms motion started rather than full travel, *Open all*, *Close all*, *Stop all*, *Reload*,
*Devices*, and the group command outcome (Pending, Confirmed, Partial, Failed, Superseded, Timed out). Design this as
a variant of the Shading view (same header, same hero language) with the outcome states of §7.3.

### D. Security view (spec §10)

Always in the deck. **Status ring** hero (armed, disarmed, triggered, alerts; pulses while triggered) with summary
pills. A **tab selector**: Entry points (only when the space has doors or windows), Alerts, Events. Entry points: grid
of door and window tiles with status badges, tap → device detail. Alerts: list with per-alert Acknowledge and
Acknowledge all. Events: recent events feed with refresh, its own loading and error.

Landscape shows the tabs as tiles in a side column.

**Decided: the panel is an alarm keypad.** Arming and disarming must be possible on the panel. This is new
functionality; there is no arm or disarm control today. What exists to build on:

- Alarm devices have a writable **arming state**: `disarmed`, `armed_home`, `armed_away`, `armed_night`.
- They report an **alarm state**: `idle`, `pending` (entry delay running), `triggered`, `silenced`, plus a `fault`
  code, an `active` flag (alarm system operational), and a writable `siren`.
- The security module already aggregates arming state, alarm state and alerts for the whole home and per space.
- **There is no PIN or code** in the backend yet, and no exit-delay state. Both are new work; design them anyway.

Design:

| Part | Content |
|---|---|
| **Arm control** | Four choices: Disarmed, Home, Away, Night (only those the alarm supports). Part of the Security hero, also on the Entry overview, and reachable from the room overview's security status. |
| **PIN keypad** | Numeric keypad, masked digits, delete, cancel, wrong code (shake + message), lockout after repeated failures. Asked for when disarming; for arming it is a setting (some homes arm without a code). Must work on the XS artboard in portrait and landscape. |
| **Exit delay** | After arming: a countdown ("Leave now, armed in 0:45") with Cancel. |
| **Entry delay** | When a door opens while armed (`pending`): a **full-screen interrupt on every panel** with the countdown and the keypad. Highest priority after connection loss. |
| **Open entry points** | Arming with a door or window open: list what is open, then "Arm anyway" (bypass) or Cancel. |
| **Triggered** | Full-screen alarm: what triggered it, where, when; keypad to disarm; **Silence siren**; link to the camera covering that entry point when there is one. |
| **Silenced / fault / alarm offline** | Calm but visible states in the hero and the nav tab badge. |
| **Several alarm systems** | Usually one per home. If a space has several, show a list with one control each. |

States: disarmed · arming (exit delay) · armed home · armed away · armed night · entry delay · triggered · silenced
· fault · alarm offline · command pending · command failed · wrong code · locked out · alerts present (1, 3, many) ·
no entry points · empty alerts · empty events · events loading and failed.

A **Cameras** tab (or section) joins Entry points, Alerts and Events when the space has cameras (§6.K).

### E. Dashboard pages, tiles and data sources (spec §11)

User-built pages from the admin.

| Page type | Content | States |
|---|---|---|
| **Tiles page** | Optional top bar (title, icon, one small widget per page data source). A grid of tiles, each placed by row, column and span. Grid is either fixed rows × columns (default 4 × 6) or derived from a target tile size. | Page not found · no tiles configured |
| **Cards page** | Optional top bar. A vertical scroll of cards; each card has an optional section title and its own tile grid. | Page not found · no cards configured |
| **Device detail page** | One device detail screen (§F) embedded as a page, without back button | As the device detail |

| Tile | Shows | Does | Sizes to design |
|---|---|---|---|
| **Device preview** | Device icon, name, a row of data-source values | Tap → device detail. Icon tap → on/off (when the device has an on state). Loading spinner while the device is unknown. | 1×1, 2×1, 2×2, 4×2 |
| **Scene** | Icon, name, status; highlighted when active | **Nothing today (read-only).** Should trigger the scene; mark as new. | 1×1, 2×1 |
| **Time** | Big clock and date | — | 2×1, 4×2, 4×3 |
| **Weather (current)** | Condition icon, temperature, description | Tap → weather detail | 1×1, 2×1, 2×2 |
| **Weather (forecast)** | Per day: weekday, icon, day and night temperature | Tap → weather detail | 4×1, 4×2 |

| Data source (small widget in a tile or page top bar) | Shows |
|---|---|
| Device channel | Icon, value, unit; loading and unavailable placeholders |
| Weather current | Icon, temperature |
| Weather forecast day | Day, icon, temperatures |

Tiles must be designed for **any cell size**. Specify how each tile degrades from large to 1×1 (what drops first).

### F. Device detail screens (spec §12)

Opened from tiles, domain sheets, security entry points and dashboard detail pages. Header: back, device icon, name,
optional trailing actions. When the device is offline, controls dim behind an offline state.

| Group | Categories | Functions today | Design status |
|---|---|---|---|
| **Lighting** | lighting | Power, capability switcher (brightness, colour temperature, hue, saturation, white), gradient sliders, presets, channel selector for multi-channel devices (sticky at the bottom in portrait) | Rich |
| **Light group** (new) | lighting, when the device is a virtual group | Reported power, Turn on / off, per-property "Apply together", outcome text. Raw Material, **hard-coded English**. | **Needs design** |
| **Window covering** | window covering | Illustrated cover (blind, roller, curtain, sheers, outdoor blind) that follows the position, position slider, Open / Stop / Close, presets, tilt card, obstruction indicator; separate compact and large landscape layouts | Rich |
| **Climate devices** | thermostat, heating unit, air conditioner | Circular dial with modes, status section, room sensors, settings; AC adds fan mode, fan speed and timer | Rich |
| **Air devices** | fan, air humidifier, air dehumidifier, air purifier | Power, mode, speed, options, timer, sensors | Rich |
| **Native thermostat** (new) | thermostat controlled by HA or Zigbee2MQTT | Requested vs observed mode and targets, − / +, **a typed target field (°C) + Apply**, "apply auto with both targets", external-changes notice, request outcome (accepted / unconfirmed, refused, unknown), stale state disables controls | **Needs design** on the same dial as the other climate devices (see thermostat rule below) |
| **Virtual thermostat** (new) | thermostat of type virtual | Requested mode and setpoints, readiness and reasons, **members** (per-member evidence, freshness, protection, release history), **comfort** (Comfort, Eco, Away, Manual baseline; temporary override with a typed duration; clear the user OFF latch; configure comfort ranges and presets; server status, actor, revision), **dew point** protection | **Needs design.** Today it is an engineering diagnostics page with a Material app bar, list tiles, expansion tiles and text fields. Split it as in the thermostat rule below. |
| **Actuator group** (new) | any virtual composite group except lights | Reported feedback per field (power, speed, position, tilt…), "n/m contributing members", members with missing-member markers, readiness, Open / Close / Stop or field values, "Apply together", command outcome | **Needs design** (Material app bar today) |
| **Sensor** | sensor | Channel tiles → sensor channel page: chart, freshness, trend, events; virtual measurement diagnostics for virtual sensors | Rich (diagnostics panel needs design) |
| **Hardware inputs** (new) | input controller (physical buttons, binary and analog inputs, for example on a reTerminal) | **Read-only.** Buttons with last event, binary inputs ON/OFF, analog values with unit, battery %. No actuator controls by design. Status strings are hard-coded English. | Partly designed (uses `UniversalTile`) |
| **Media** | television, speaker, AV receiver, projector, set-top box, streaming service, game console, media | Info card, power, playback card and sheet, volume, source select, remote (D-pad + transport), brightness (TV, projector) | Rich |
| **Placeholders** | alarm, camera, door, doorbell, lock, outlet, pump, robot vacuum, sprinkler, switcher, valve, water heater | A "detail is being prepared" message. **No controls.** | **Greenfield** — these 12 need real designs. Alarm, camera and doorbell are specified in §6.D and §6.K; lock and door next. |
| **Generic fallback** | generic, terminal, anything unknown | Standard header and a "no detail available for this device" message. No controls and no property list. (The July spec still describes an older top bar here.) | Needs design: at least a read-only property list |

Each rich screen needs portrait and landscape, the three classes, and these states: loading, online, **offline**,
control pending, control never confirmed (§7.2), single channel vs multiple channels.

**Thermostat rule (decided): control on the panel, configuration in the admin.** Anyone who wants a different
temperature must be able to do it at the panel. The admin is only for setting the system up.

| On the panel (control) | In the admin only (configuration) | On the panel, read-only, behind "details" |
|---|---|---|
| Target temperature (heat, cool, or both for auto) with the dial, − / + and presets, **never a typed field** · HVAC mode · comfort preset (Comfort, Eco, Away, Manual) · temporary override with a duration picker (30 min, 1 h, 2 h, until a time, until the next schedule change) and Cancel override · clear the user OFF latch · fan mode and speed where supported | Comfort ranges and preset temperatures · enabling climate automation · member devices and the regulation policy · dew point and cooled-surface setup · sensor participation | Current and target temperature, what the system is doing (heating, cooling, idle, paused by a guard) and why in one short line · external changes · last command outcome (§7.3) · for installers: member status and protection guards, in plain language |

The same rule applies to the **Climate domain view**: when the room is regulated by a virtual thermostat, its comfort
presets and the temporary override belong in the room's Climate view too (new), not only in the device detail.

All thermostat kinds (plain, native, virtual) should share **one control layout**, so a user does not see a different
screen depending on how the installer wired the heating.

### G. Weather detail

Pushed from the sky weather card or weather tiles. A sky panel header (same visual system as the room overview, with
glass tiles), **hourly forecast** strip, **daily forecast** rows with a temperature range bar, **sunrise and sunset**
row. States: loading, **not configured**, no data for the sky.

### H. Settings (spec §13)

Opened by swiping down; closed by swiping up or ✕. Has its own navigation with fade transitions.

| Page | Content | Variants |
|---|---|---|
| **General** (landing) | Grid of large tiles with coloured icon chips: Display, Language, Audio, Voice activation, Weather, About, Maintenance. 2 columns portrait, 3 landscape. | Audio and Voice tiles only when the hardware supports audio |
| **Display** | Theme (light / dark), **accent colour** (new, §4.4: swatches with "Room default"), screen saver, screen power off, screen lock delay ("Never" = 0), brightness slider, unit overrides (temperature, wind, pressure, precipitation, distance; each with "System default") | Accent following the room vs overridden |
| **Language** | Language, timezone, time format, number format; each opens a selection dialog | Timezone and time format have no effect today (§10) |
| **Audio** | Speaker (toggle + volume), Microphone (toggle + volume) | **Three layouts**: both, speaker only, microphone only |
| **Voice activation** | Detection toggle (names the wake word), sensitivity slider, live status (Stopped, Listening, Recording n/N s, Processing) | Microphone unavailable (toggle disabled) |
| **Weather** | Pick the weather location ("System default" = primary) | No locations |
| **About** | Version, IP, MAC, CPU, memory, about, developer, licence | Loading, error, "N/A" values |
| **Maintenance** | System: Restart, Power off. Danger: Factory reset. Each with a confirm dialog. Copy differs for display-only vs whole system. | Confirm dialog · in progress · done · failed (overlays) |

### I. Buddy assistant and voice (spec §14)

Only when the Buddy module is enabled.

- **Chat page:** header, message list (user and assistant bubbles with time), input row (text field, mic, send).
  States: empty (invitation), loading conversation, typing ("thinking…"), provider not configured (input disabled),
  initialization failed + retry, error messages (load, create, send, timeout, connection).
- **Voice input overlay:** recording with level feedback, processing, cancel.
- **Wake-word indicator** and **suggestion toast** (§5.4).

### J. Idle and lock

| Screen | Content | Notes |
|---|---|---|
| **Screen saver** | Flip clock + date | After the lock delay, when the screen saver is on. A tap wakes it. Consider burn-in on always-on panels (subtle drift). |
| **Lock screen** | Plain black today | When the screen saver is off. There is no PIN keypad. |

### K. Cameras and video doorbell (decided, new functionality)

The panel has no camera UI today. The backend cameras module already lets a display list cameras, fetch **snapshots**
(cached, per stream profile, optional high quality) and open a short-lived **live view session** relayed by the
backend. A **doorbell** device has a button-press channel, optional camera channels and an optional lock, and the
spec lists microphone and speaker channels for talking to the visitor.

| Surface | Content and functions | States |
|---|---|---|
| **Camera tile** (dashboard, room, security, entry) | Snapshot refreshed every few seconds, camera name, "live" badge when streaming, motion or person indicator when the camera reports one. Tap → camera view. | Loading · snapshot · snapshot stale (age shown) · offline · no permission · camera hidden or removed |
| **Camera grid** (Security tab or section, dashboard card) | 1, 2, 4 or more cameras as snapshot tiles; never several live streams at once | 1 camera · 2 · 4 · many (scroll) · all offline |
| **Camera view** (full screen) | Live video, name, stream quality switch when there are several profiles, snapshot fallback, close. Actions when the device has them: unlock the linked door, switch a light, talk (new). | Connecting · live · reconnecting · live unavailable (snapshot fallback) · offline · relay not running |
| **Doorbell ring** (interrupt) | **Full-screen interrupt on every panel** (or the panels chosen in the admin): "Someone is at the front door", live view or latest snapshot, ring time; actions **Unlock** (when a lock is linked, with confirmation), **Talk** (new), **Dismiss**; auto-dismiss after a timeout; chime volume follows audio settings | Ringing · answered elsewhere · unlocked · unlock failed · no camera (text and icon only) · panel in screen saver (wakes up) |
| **Missed rings** | A list of recent rings with snapshot and time, in the doorbell detail and in Security › Events | Empty · several |
| **Doorbell device detail** | Live view, last rings, linked lock, battery | Online · offline · battery low |
| **Camera device detail** | Camera view plus device info and stream profiles | As camera view |

Constraints: one live stream on screen at a time, hardware-decoded; snapshots everywhere else. Camera images must
be fitted to tiles of any aspect ratio (crop rules). Privacy: design a "camera hidden on this panel" state, since
not every panel in the house should show every camera.

## 7. Shared state model

### 7.1 Screen states

Every data-backed screen needs six states (spec §17). Design them as **templates** that every screen uses:

| State | Today | Ask |
|---|---|---|
| **Loading** | Centred spinner; header and sky stay | Prefer skeletons that keep the layout stable on a wall |
| **Error** | Danger icon 64, message, Retry | Calm, actionable |
| **Empty** | Neutral or success icon, title, description | — |
| **Not configured** | Header stays; domain icon, title, description ("No lighting roles assigned") | Distinguish from empty. Point to the admin. Usually a sub-second flash, but permanent for Energy and auxiliary-only Climate. |
| **Offline device** | Tile labels swap (name becomes primary, "Offline" becomes status) + warning badge; detail controls dim | One consistent offline language for tile, list row, hero and detail |
| **Disconnected from backend** | Overlays (§5.5); Media blocks the page | Decide what stale data looks like underneath |

### 7.2 Control feedback: the panel does not wait for the backend

Controls update immediately, then wait for the device to confirm. Spec §17 has the full table of six feedback levels
and timings. In short:

```
IDLE (confirmed value)
  → tap → PENDING (shows the new value; control locked)
  → SETTLING (still locked; waiting for the device to report it)
      → matches → IDLE
      → times out → MIXED: "we asked, we never heard back" (still locked)
  → failure → rolls back to the previous value (except Climate, which stays put)
```

What to design:

- A **pending/settling** look for a control and for the value it drives (hero numeral, slider thumb, tile).
- A distinct **never confirmed (MIXED)** look. Today it looks the same as settling. This is the biggest gap in control
  feedback.
- A **rollback** moment (value snaps back, plus an error toast).
- Several controls give **less** feedback on purpose (room card quick actions, landscape role tiles, sheet toggles,
  media transport): the value changes instantly and nothing locks. Do not design a lock or spinner for those (spec
  §17 table).

Settling windows are 0.8–3 s, so pending looks are brief. A never-confirmed look can stay until the next update and,
for device groups, indefinitely.

### 7.3 Outcome vocabulary (new features)

Room modes, schedules, device groups and native thermostats report **command outcomes**, separately from device
state. The backend is careful never to claim the physical result. One visual vocabulary for all of them:

| Outcome | Used by | Meaning |
|---|---|---|
| Sending / pending / accepted | modes, groups, native thermostat | Request on its way or accepted, not confirmed |
| Confirmed / completed | groups, modes | Commands completed |
| Partial | modes, groups | Some parts did not complete |
| Failed / refused | modes, groups, native thermostat | Did not complete or was refused |
| Interrupted / superseded | modes, groups | Replaced by a newer request |
| Timed out / unconfirmed / unknown | groups, modes, native thermostat | No answer; refresh before trying again |
| Conflict | modes | Changed elsewhere; review and retry |
| Mixed | groups, lights roles | Members disagree |
| Unavailable / stale | all | No current data; controls disabled |

Design a small **outcome indicator** (icon + short label + optional "details" tap) and a **details sheet** pattern.
Long engineering sentences in the code today should become short labels plus a "details" layer (§10).

## 8. Configurations to mock

A design that assumes a full room will break on real installations. Mock at least these (spec §19 has more):

| # | Panel | Space and setup | Deck |
|---|---|---|---|
| 1 | M+ landscape | **Full living room**: 4 dimmers, thermostat, 2 roller shutters, TV + soundbar, temp/humidity sensor, energy plug, 4 scenes, room modes, schedule, 2 automations, 1 dashboard page | Room overview, Lights, Climate, Shading, Media, Sensors, Energy, Security, Dashboard |
| 2 | XS portrait | **Minimal bedroom**: 2 LED strips, 1 temperature sensor, no scenes | Room overview, Lights, Sensors, Security (no "More") |
| 3 | M landscape | **Hallway entry panel** with 2 locks, an alarm and a video doorbell | Entry overview, Security. Also: arming with exit delay, entry delay, triggered, and a doorbell ring |
| 4 | L landscape | **Whole-home master panel**, 8 rooms, energy | Master overview, Security, Energy |
| 5 | S portrait | **Fresh install**: devices exist, nothing configured | Room overview (empty or not configured), Security |
| 6 | M portrait | **Zone panel** with 2 dashboard pages | Security (landing), Dashboard 1, Dashboard 2 |
| 7 | XS landscape | **Room with only a smart fan** | Room overview (empty + sensor pills), Climate (auxiliary-only), Security |
| 8 | Square 240 × 240 | Bedroom of #2 | Room overview, Lights |
| 9 | Any | **Backend lost**, then recovered | Banner at 2 s, overlay at 10 s, full screen at 60 s, "Connected" toast |
| 10 | L portrait | **Signage** board | Signage overview |
| 11 | XS portrait | **Bedroom panel at night**, alarm armed Night, someone rings | Doorbell ring over the black lock screen; disarm keypad on the smallest artboard |
| 12 | M+ landscape | Living room of #1 with a **virtual thermostat** | Climate view with comfort presets and a 2 h override running; thermostat detail with the "details" layer open |
| 13 | M landscape | Three panels (kitchen, bedroom, office) in **three accent colours** | Room overview of each |

## 9. Where the UI drifts today

Concrete problems found in the code. They are the reason this brief asks for a component and state system and not
just a re-skin.

| Area | What happens today |
|---|---|
| **New features skip the design system** | Room Modes, Schedule, Occupancy and Automations sections use stock `FilterChip`, `ActionChip`, `Switch`, `AlertDialog` and Material text styles, with no domain colour, no tokens and no scaling. Grouped covers, light groups, actuator groups and both new thermostat screens use `AppBar`, `ListTile`, `SwitchListTile`, `ExpansionTile`, `TextButton` and plain `Text`. |
| **Two header idioms** | Room and domain views use `PageHeader` + `HeroCard`. Master and Entry overviews and the generic device detail use the older `AppTopBar` + ad-hoc cards. Actuator group and virtual thermostat use a Material `AppBar`. |
| **Configuration and diagnostics on the wall** | The panel shows virtual thermostat members (evidence, generation, latch, drain, quality…), comfort revisions and actors, dew point probe UUIDs and group membership repair in engineering language, and lets the user **edit comfort configuration**. Configuration belongs in the admin; control and a plain-language status stay on the panel (§6.F thermostat rule). |
| **Keyboard input on a touch panel** | The native thermostat asks for a typed target temperature, the comfort override for a typed duration in minutes, and the light group and actuator group controls for typed values. Everywhere else numbers are set with sliders, dials or ± buttons. |
| **Hard-coded English** | Light group controls ("Reported power", "Turn on", "Apply together"), hardware input status ("Detected", "Idle", "ON", "OFF"), suggestion toast "Dismiss", signage weekday and month names. |
| **Placeholders** | 12 device categories show "detail is being prepared", including all security devices (lock, door, doorbell, alarm, camera). |
| **No security control** | The panel cannot arm or disarm, unlock a door, or show a camera, although the backend supports writing the arming state and serving camera snapshots and live views. |
| **Read-only by accident** | The dashboard scene tile cannot trigger its scene. Entry default house modes only move a highlight. |
| **Colour collisions** | Primary, danger, active alert and media domain all use red. |
| **Feedback gaps** | Never-confirmed (MIXED) looks like settling. Climate does not roll back a failed command. |
| **Inconsistent tiles** | The scene tile uses a raw Material `Card` instead of `UniversalTile`. |
| **Data faces** | DIN 1451 is used for hero numerals and also for 12 px tile labels and loading placeholders. Decide where it belongs. |
| **Sizing** | See §3.3: pixel-based scaling, a DPR-dependent breakpoint, compact density on the highest-density panels, unscaled Material widgets. |
| **Settings discoverability** | Settings opens only with a hidden swipe-down. |

## 10. Copy, language and units

- **Six languages**, about 60 % expansion in short slots. Nav labels, chips and tile names are single line and
  truncate.
- **Rewrite the long status sentences** from the new features into a short label plus a details layer. Examples
  from the code: "Selected · some commands could not complete", "OPEN/CLOSE confirms motion begun or an already
  reached endpoint, not full travel. STOP requires qualified stopped feedback.", "User OFF is latched. Presets and
  automation cannot resume output." Please supply the short versions with the designs.
- **Time is always 24-hour today** in all nine time surfaces, and the timezone setting is not applied. If you design
  12-hour time, every clock needs a slot for AM/PM (the flip clock has none). Spec §20.
- **Units** are overridable per display: temperature °C/°F, wind, pressure, precipitation, distance. Numbers follow
  a number-format setting (`1,234.56`, `1.234,56`, `1 234,56`). Temperatures: 1 decimal in summaries, 0 in heroes.
- Mode names, room names and device names come from users and can be long. Truncate gracefully; never let a name
  push a control off screen.

## 11. Non-negotiables

1. **Portrait and landscape** for every screen, as different compositions.
2. **Three size classes** and the five artboards (§3.4), plus the square case for key screens.
3. **Touch only**, kiosk, no OS chrome. Touch targets at or above the physical floor you define.
4. **Light and dark** for every screen. Dark mode is not an inversion.
5. **Every screen in all its states** (§7.1) and every control in its feedback states (§7.2).
6. **Everything is optional** (§8). Show the sparse versions.
7. **Bundled assets only.** No web fonts, no internet images. Icons from Material Design Icons or delivered as SVG.
   Camera snapshots and live video from the local backend are the only images loaded at run time.
8. **Raspberry Pi GPU budget.** At most one real blur on screen. No stacked transparency or heavy shadows.
9. **Do not fight the global gestures.** No full-page vertical carousels; horizontal swipe belongs to the deck.
10. **No keyboard for everyday controls.** Numbers are set with sliders, dials, steppers or presets.
11. **WCAG AA contrast** in both themes, also on the sky gradients.
12. **Same brand as the admin** (§4.3), with a per-panel accent colour (§4.4).
13. **Everyday control happens on the panel.** The admin configures the system; anything a household member wants to
    change day to day (temperature, comfort preset, arming, unlocking, lights) must be possible at the panel.
14. **Security actions are deliberate.** Disarm and unlock need a confirmation or a code; nothing security-related
    sits where a swipe or an accidental tap can trigger it.

## 12. Deliverables

### 12.1 Foundations

- [ ] Colour tokens, light and dark: surfaces, text roles, borders, fills; status colours (ok, warn, danger, info,
      primary) with text, soft and border shades; the seven domain colours; the primary/brand decision; the
      **accent palette set** (§4.4) with the rules for what the accent may colour.
- [ ] Type scale for UI text, plus the display numerals (hero, sky clock, time tile, signage clock, flip clock) and
      the rule for DIN 1451 vs Roboto.
- [ ] Spacing, radius, elevation and motion tokens.
- [ ] **Size system:** the five artboards, size class rules, what changes per class, physical minimums in mm (§3.4).
- [ ] Icon rules (sizes, filled vs outline for on/off) and the weather glyph set.
- [ ] Sky panel: the 4 × 10 gradient matrix (or a reduced, systematic version), text colours per combination,
      weather overlays.

### 12.2 Components

Each in default, active, pressed, disabled, pending, never confirmed and offline where relevant, light and dark, at
compact, regular and expanded.

- [ ] Page header (+ compact) and its icon buttons; one top bar for every screen type (retire `AppTopBar` or define it)
- [ ] Hero card: numeral + unit + swatch, badge, slider, presets
- [ ] Universal tile, vertical and horizontal
- [ ] Mode selector (horizontal, vertical, two-line), mode chip and popup, range picker
- [ ] Sliders: brightness, colour temperature, hue, saturation, white, temperature, position; circular dial; stepper
- [ ] Deck navigation: bottom bar, side dock (both widths), tab, badge, "More" sheet
- [ ] Sheets, drawers, dialogs (confirm, selection), section titles, alert banner, toasts
- [ ] Room-level pills and chips: scene pill, status pill, activity mode chip, outcome indicator (§7.3)
- [ ] List row with switch (for automations and settings)
- [ ] Overlay templates: banner, modal card, full screen, in all five colour schemes, with 0, 1 and 2 actions
- [ ] State templates: loading (skeleton), error, empty, not configured, offline, disconnected
- [ ] Dashboard tiles at their size steps; data-source widgets
- [ ] Security: arm control, PIN keypad (with wrong code and lockout), countdown (exit and entry delay)
- [ ] Camera tile, camera grid, live video frame with its connection states
- [ ] Thermostat control: dial with one or two setpoints, comfort preset selector, override duration picker
- [ ] Accent swatch picker

### 12.3 Screens, in priority order

1. **Room overview** with the new mode sections (full, sparse, empty, square), and the sky panel at four
   time-of-day/weather combinations.
2. **Lights, Climate, Shading** domain views, including grouped covers and the auxiliary-only climate state.
3. **Navigation and overlays**: bottom bar, side dock, More sheet, connection escalation, security alert overlay,
   alarm entry delay and triggered, doorbell ring.
4. **Security** view with arm/disarm, keypad and all alarm states; **Entry** overview with arm control, locks and the
   door camera; **cameras** (tile, grid, camera view) and the **doorbell** (ring, missed rings, detail).
5. **Thermostat control**: one layout for plain, native and virtual thermostats (dial, presets, override), the
   "details" layer, and comfort presets in the Climate view.
6. **Media** (all six body states + live connection block), **Sensors**, **Energy**.
7. **Device details**: lighting, window covering, one media device, sensor detail; then the new ones (actuator
   group, light group, hardware inputs); then the remaining placeholders (lock, door, outlet/switcher first).
8. **Master** overview on the new design language, with room accent colours.
9. **Dashboard** tiles page, cards page and all tiles.
10. **Settings** (all pages and variants, including the accent picker), **weather detail**.
11. **Startup**: discovery (all states), room selection, loading, fatal error.
12. **Buddy** chat, voice overlay; screen saver, lock screen; **signage** board.

### 12.4 Variant matrix

For each screen in 12.3, deliver at least:

| | XS | S | M | M+ | L |
|---|---|---|---|---|---|
| Landscape | ✔ | — | ✔ | ✔ | ✔ |
| Portrait | ✔ | ✔ | ✔ | — | ✔ |

Dark mode for every board in XS, M+ and L. Then one board per state from the screen's state list, at M (the most
common panel). Screens marked *Rich* and the room overview get the full matrix; settings and startup can stop at XS
and M+.

### 12.5 Marking new functionality

Anything the app cannot do today (arm/disarm, PIN keypad, exit delay, unlocking from the panel, cameras and the
doorbell, room accent colours, comfort presets in the Climate view, scene tile triggering, album art, signage content,
12-hour clock, a visible settings button) must carry a visible **"new"** marker on the board, so it is
planned as engineering work and not treated as a re-skin.

### 12.6 Handoff format

- A design canvas (boards grouped by foundations, components, templates, screens) and an implementation handoff,
  as was done for the admin redesign.
- A **component mapping table**: each designed component → the existing widget it replaces or re-skins (§4.5), or
  "new".
- Token values as a table that can become `apps/panel/lib/core/utils/theme.dart`.
- Short copy for every status label you introduce, in English.

## 13. Decisions

### 13.1 Decided

| Topic | Decision |
|---|---|
| **Colour per room** | Each panel gets a user-selectable accent colour, defaulting from its room (§4.4). Status and domain colours stay fixed. |
| **Thermostats** | All everyday control is on the panel: temperature, mode, comfort preset, temporary override, clearing the OFF latch. The admin is only for configuration. Diagnostics stay on the panel as a read-only, plain-language "details" layer (§6.F). |
| **Security** | The panel is an alarm keypad: arm (Home, Away, Night), disarm with a code, exit and entry delays, triggered and silenced states (§6.D). |
| **Cameras and doorbell** | In scope: camera tiles and grid, full-screen camera view, doorbell ring interrupt with Unlock, missed rings (§6.K). |

### 13.2 Still open

Please give a recommendation for each.

1. **Default accent and brand.** Which accent is the default, and does red stay in the accent set given that red
   means danger? Follow the admin's blue primary for the default?
2. **Physical sizing.** Accept the per-panel density approach of §3.4 and give the mm floors.
3. **Room modes vs domain modes.** How room activity modes (Work, Relax, Sleep, Entertainment, Away) relate visually
   to the Lights, Shading and Climate modes and to scenes. One concept on the overview or several?
4. **Alarm codes.** One household code or one per user? Is a code needed to arm, or only to disarm? A duress code?
5. **Panel lock.** Should the lock screen itself ask for a PIN (for example on an entry panel facing outside)?
6. **Doorbell talk.** Two-way audio needs the panel's microphone and speaker. Design it now or later?
7. **Settings entry point**: keep the swipe-down only, or add a visible affordance?
8. **Signage**: design the full board now?
9. **Burn-in**: should always-on screens (signage, screen saver) shift content over time?

## 14. Source pointers

| What | Where |
|---|---|
| Behaviour reference (every screen, every rule) | [`docs/display-app-design-spec.md`](display-app-design-spec.md) |
| Approved admin design (brand alignment) | [`docs/admin-ui-design-spec.md`](admin-ui-design-spec.md) |
| Room activity modes, schedules, occupancy | [`docs/space-activity-modes.md`](space-activity-modes.md) |
| Optimistic UI and feedback levels | [`docs/optimistic-ui-architecture.md`](optimistic-ui-architecture.md) |
| Climate, media domains | [`docs/climate-architecture.md`](climate-architecture.md), [`docs/media-architecture.md`](media-architecture.md) |
| Tokens and theme | `apps/panel/lib/core/utils/theme.dart` |
| Scaling and size classes | `apps/panel/lib/core/services/screen.dart`, `core/services/visual_density.dart`, `spec/displays/screen_breakpoints.json`, `spec/displays/grid.json` |
| Panel install and display size override | `build/raspbian/modules/configure/files/display`, website "Raspberry Pi image" install page |
| Shared components | `apps/panel/lib/core/widgets/` |
| Deck and navigation | `apps/panel/lib/modules/deck/` |
| Room overview, domain views, room mode sections | `apps/panel/lib/plugins/spaces-home-control/presentation/` |
| Master, entry, signage | `apps/panel/lib/plugins/spaces-synthetic-*/`, `plugins/spaces-signage-info-panel/` |
| Device details | `apps/panel/lib/modules/devices/presentation/device_details/` (registry in `modules/devices/mappers/device.dart`) |
| Security, energy, weather, Buddy | `apps/panel/lib/modules/{security,energy,weather,buddy}/presentation/` |
| Alarm, doorbell, camera and lock capabilities | `spec/devices/channels.yaml` (`alarm`, `doorbell`, `camera`, `lock`), `spec/devices/devices.yaml` |
| Security aggregation (arming and alarm states) | `apps/backend/src/modules/security/security.constants.ts` |
| Cameras module (snapshots, live sessions) | [`docs/cameras-architecture.md`](cameras-architecture.md) |
| Dashboard pages and tiles | `apps/panel/lib/plugins/pages-*`, `plugins/tiles-*`, `plugins/data-sources-*` |
| Startup, discovery, settings, overlays, suggestions | `apps/panel/lib/app/`, `apps/panel/lib/features/` |
| Strings (all six languages) | `apps/panel/lib/l10n/app_*.arb` |
