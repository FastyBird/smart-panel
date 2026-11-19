# Admin UI design specification

> **Status:** approved on 2026-11-19 after three design rounds. Implementation has not started; it is tracked in
> [`tasks/epics/EPIC-ADMIN-UI-REDESIGN.md`](../tasks/epics/EPIC-ADMIN-UI-REDESIGN.md).
>
> **Scope:** the Vue admin app (`apps/admin/`) and every admin plugin. The wall display app has its own spec,
> [`display-app-design-spec.md`](display-app-design-spec.md).
>
> **Sources:** the design canvas (about 170 boards on 14 pages: foundations, components, plugin slot frames,
> 10 page templates and every screen at desktop, dark, tablet, wide and phone) and the designer's implementation
> handoff. Both are claude.ai artifacts shared with maintainers:
> [design canvas](https://claude.ai/artifact/YKSBrWoQ2Xq7KMfaFWPRBP),
> [implementation handoff](https://claude.ai/artifact/FJwhyVns5dZmyqxECU7aWJ). This file is the repo copy of the
> handoff and is authoritative when they differ.
>
> **Theme files:** [`admin-ui-theme/`](admin-ui-theme/) holds the approved `base.scss`, `dark.scss` and
> `uno.theme.ts`. Phase 1 merges them into `apps/admin`; from then on the copies in `apps/admin` are the source.

## How to use this spec

- Read it before any change to an admin screen, shared component, plugin form or style.
- It **overrides** layout, colour, spacing and component choices in older documents: the "Admin" sections of
  `docs/superpowers/specs/*`, `docs/superpowers/plans/*`, `docs/admin-devices-architecture.md` and feature task
  files. Those stay valid for behaviour, data and API contracts.
- A screen not yet migrated may still look different. New work follows this spec; changes to an old screen move it
  onto its template when practical.
- [`admin-ui-screens-and-plugins.md`](admin-ui-screens-and-plugins.md) inventories what each screen and plugin
  shows today. Use it to check that a migrated screen keeps all its content.

## 1. Principles

- **Element Plus stays.** The redesign changes the theme, twelve shared wrapper components (plus two for plugins)
  and the page composition of every module. No new UI kit.
- **Brand red is an accent only.** `#d9230f` stays on the logo block, the active sidebar marker and auth screens.
  `--el-color-primary` is blue `#2563c9`. Red on screen always means danger.
- **One palette.** Colours are defined once in `base.scss` and `dark.scss`; UnoCSS reads the same CSS variables.
  No `gray-*` utilities and no hex values in `.vue` files.
- **Flat surfaces.** Cards and tables never get a shadow. Shadows are for overlays and sticky footers only.
- **One button width.** Buttons use Element Plus 2.13.5 default padding (20 / 16 / 12 px) at three heights
  (40 / 32 / 24 px). The old 50 px override and every `px-4!` on buttons go.
- **Every routed screen has a page header** on desktop and the dark app bar on phone. Breadcrumbs live only in the
  top bar.
- **Plugins draw only inside slots.** The host renders identity, status and the Save footer; plugins render form
  sections (section 7).

## 2. Theme tokens

Element Plus variables carry almost everything; `--fb-*` tokens cover the rest. Light values live in `base.scss`
(the `$colors` map and `:root`), dark values in `dark.scss` under `html.dark`. Every pair meets WCAG AA for its use.

| Role | Variable | Light | Dark |
| --- | --- | --- | --- |
| Primary (actions, focus, switches) | `--el-color-primary` | `#2563c9` | `#3570d8` |
| Primary as text (links, active tab) | `--fb-primary-text` | `#2563c9` | `#8ab4f8` |
| Success | `--el-color-success` | `#2e7d32` | `#2e7d32` (text `#6cc070`) |
| Warning | `--el-color-warning` | `#b25e00` | `#b25e00` (text `#f0a742`) |
| Danger / error | `--el-color-danger`, `--el-color-error` | `#c62828` | `#c62828` (text `#f2706b`) |
| Info / neutral | `--el-color-info` | `#5b6675` | `#5b6675` (text `#a3acb9`) |
| Text primary | `--el-text-color-primary` | `#1b1f26` | `#e9eaec` |
| Text regular | `--el-text-color-regular` | `#343a45` | `#cfd2d6` |
| Text secondary | `--el-text-color-secondary` | `#5b6270` | `#a2a7af` |
| Text muted (captions) | `--fb-text-muted` | `#6e7581` | `#8a9099` |
| Placeholder / disabled | `--el-text-color-placeholder` | `#8b919b` | `#6b7079` |
| Page background | `--el-bg-color-page` | `#f3f4f6` | `#121315` |
| Surface (cards, tables) | `--el-bg-color` | `#ffffff` | `#1b1c1f` |
| Overlay (popover, dialog) | `--el-bg-color-overlay` | `#ffffff` | `#232428` |
| Fill light (table head, read-only) | `--el-fill-color-light` | `#f6f7f9` | `#222327` |
| Fill (hover, segmented track) | `--el-fill-color` | `#eceef1` | `#2a2b30` |
| Border | `--el-border-color` | `#dcdfe5` | `#33353a` |
| Border light (cards, rows) | `--el-border-color-light` | `#e8eaee` | `#2a2c30` |
| Brand | `--fb-brand` | `#d9230f` | `#d9230f` |
| Sidebar / phone app bar | `--fb-sidebar-bg` | `#1b1c1f` | `#0e0f10` |
| Sidebar text | `--fb-sidebar-text` | `#a1a3aa` | `#9a9ca3` |
| Sidebar active item | `--fb-sidebar-active-bg` | `#2b2c31` | `#1e1f22` |

**Status colours in dark mode.** Filled controls (buttons, badges, the filled critical tag) keep the base colour with
white text. Anything that draws a status colour as text on a dark surface uses the lighter `--fb-status-*-text`
shade: soft tags, alerts and their descriptions, messages, links, and plain, text and link buttons. This covers
primary as well as success, warning, danger and info. Element Plus names red `danger` on tags, buttons and links
but `error` on alerts and messages, so `dark.scss` loops over the two name sets separately. Element Plus's
automatic `--el-color-*-light-*` mixes stay untouched and only drive backgrounds and borders.

**Status soft colours** (`--fb-status-{ok,warn,danger,info,primary}-{text,soft,border}`) back `status-tag`,
alerts, graph nodes and selected cards.

**Domain colours** (`--fb-domain-*`) mirror the wall display and appear only as a tinted icon tile beside a domain
name, never as status:

| Domain | Light | Light soft | Dark | Dark soft |
| --- | --- | --- | --- | --- |
| Lights | `#a35600` | `#fdf1e2` | `#f0a742` | `#33261a` |
| Climate | `#0277a8` | `#e3f2fa` | `#4fb3e8` | `#16293a` |
| Covers | `#00796b` | `#e0f2f1` | `#4db6ac` | `#14302d` |
| Media | `#c2185b` | `#fce4ec` | `#f06292` | `#3a1a28` |
| Sensors | `#00838f` | `#e0f7fa` | `#4dd0e1` | `#133236` |
| Energy | `#2e7d32` | `#e8f3e9` | `#6cc070` | `#1d2e1f` |
| Cameras | `#3949ab` | `#e8eaf6` | `#7986cb` | `#1f2340` |

**Notification severity** maps to info, warning and danger tags. Critical is the only filled tag (danger fill,
white text).

**Shape and type.** Radius 4 small, 6 base, 8 card, 12 dialog. 4 px spacing grid, system font, 14 px body.

| Style | Size / line height | Weight | Uno shortcut |
| --- | --- | --- | --- |
| Page title | 20 / 28 | 600 | `text-title` |
| Section title | 16 / 24 | 600 | `text-section` |
| Card title | 14 / 22 | 600 | `text-card-title` |
| Body | 14 / 22 | 400 | `text-body` |
| Label | 13 / 20 | 500 | `text-label` |
| Help, secondary | 13 / 20 | 400 | `text-help` |
| Caption | 12 / 16 | 400 | `text-caption` |
| Mono | 13 / 20 | 400 | `text-mono` |
| Stat value | 28 / 34 | 600, tabular numbers | `text-stat` |

## 3. UnoCSS and lint

UnoCSS has no palette of its own: `uno.theme.ts` points every theme colour at an Element Plus or `--fb-*` variable
and adds shortcuts for the semantic tokens, so utilities follow dark mode. The main text colour is `text-default`;
`text-primary` stays the blue primary utility.

| Replace | With |
| --- | --- |
| `text-gray-900`, `text-gray-700` | `text-default`, `text-regular` |
| `text-gray-500`, `text-gray-400` | `text-secondary`, `text-muted` |
| `bg-gray-50`, `bg-gray-100` | `bg-fill-light`, `bg-fill` |
| `border-gray-200`, `border-gray-300` | `border-light`, `border-default` |
| `#67c23a`, `#469408` | `var(--el-color-success)` |
| `#e6a23c`, `#d9831f` | `var(--el-color-warning)` |
| `#f56c6c`, `#db2828` | `var(--el-color-danger)` |
| `#409eff`, `#029acf` | `var(--el-color-primary)` |
| `#909399` | `var(--el-color-info)` |
| `text-large font-600`, `text-3xl font-bold` (headings) | `text-title`, `text-section`, `text-card-title` |
| `px-4!` on buttons | remove |
| `bg-brand-primary`, `fill-brand-primary`, `bg-menu-background` (aliases during migration) | `bg-brand`, `fill-brand`, `bg-[var(--fb-sidebar-bg)]` |
| `shadow-top` (sticky footers) | keep; it now resolves to `var(--fb-shadow-sticky)` |
| `bg-primary/5`, `bg-primary/10`, `border-primary/20` | `bg-primary-soft`, `border-primary-soft` |
| `md:`, `lg:`, `xl:` in layout rules | `tp:`, `tl:`, `dt:`, `wd:` (section 6) |

`DEPRECATED_CLASSES` in `uno.theme.ts` is the full migration map. Opacity modifiers on theme colours
(`bg-primary/10`) do not work, because the colours are CSS variables: UnoCSS renders them solid. Use the `*-soft`
shortcuts.

Enforce in CI (warn during migration, error once a folder is migrated):

1. No hex colours and no `gray-*` utilities in `src/**/*.vue` (allow-list: the automation canvas during migration).
2. No opacity modifiers on theme colours: `/\b(bg|text|border|fill)-(primary|success|warning|danger|info|brand)\/\d+/`.
3. No `text-primary` for body text.
4. No `shadow="hover"` or `shadow="always"` on `el-card`; `shadow="never"` is the global default.
5. No keys of `DEPRECATED_CLASSES`.
6. The same checks in the plugin template repository, so third-party plugins inherit them.

## 4. Shared components

Twelve wrappers in `src/common/components` carry the system. Screens and plugins compose them and never restyle
Element Plus directly. Props are the minimum the designs need.

| Component | Props · slots | Replaces |
| --- | --- | --- |
| `view-header` (update) | `icon`, `title`, `subtitle`, `back?: RouteLocation` · slots `actions`, `tags` | current `view-header.vue`; also the phone app-bar teleport (one source for both) |
| `app-bar` (update) | `title`, `subtitle`, `left: 'menu' \| 'back' \| 'close'`, `actions: {icon, label, handler}[]` (max 2) or `primaryLabel` · dark sidebar colour, sentence case | red app bar with uppercase buttons |
| `list-filter-bar` | `search`, `quickFilters`, `activeCount` · slots `filters` (drawer body), `bulk` · emits `reset` | per-module filter cards and bulk toolbars |
| `state-view` | `kind: 'empty' \| 'loading' \| 'error' \| 'not-found'`, `icon`, `title`, `description` · slot `action` | `el-result` (about 50 uses), `empty-state`, `entity-not-found`, ad-hoc grey text |
| `status-tag` | `status: 'ok' \| 'warn' \| 'danger' \| 'info' \| 'critical' \| 'primary'`, `label` · always a dot plus text | coloured text and raw `el-tag` types |
| `kv-grid` | `items: {label, value, mono?, href?}[]`, `cols` (2–4) | `el-descriptions`, hand-made info grids |
| `copy-field` | `value`, `mono = true`, `label` · copy button with tooltip and toast | URL, token and ID boxes in MCP, remote access, devices |
| `secret-input` | `modelValue`, `savedHint` (for example "ends in …k3Fq") · Replace button reveals an empty input | masked inputs that echo secrets |
| `form-footer` | `dirty`, `saving`, `canSave` · emits `save`, `discard`, `close` · 56 px sticky, sticky shadow | drawer footers in each module |
| `type-picker` | `options: {id, icon, name, description, badge?, disabled?}[]`, `modelValue` · dialog, skipped when there is one option | the six plugin-type pickers |
| `wizard-shell` | `steps: {id, label}[]`, `current`, `canContinue`, `selectedCount?`, `skippable?` · default slot = step body · emits `back`, `next`, `cancel` | per-wizard steppers and footers |
| `domain-icon` | `domain: 'lights' \| 'climate' \| 'covers' \| 'media' \| 'sensors' \| 'energy' \| 'cameras'`, `size` | ad-hoc domain icons in spaces, scenes, automations |

Plugins also get `plugin-form-section` and `test-connection` (section 7).

Rules: one primary button per region, rightmost. Icon-only buttons only for edit, delete, refresh, copy and more,
always with `aria-label` and a tooltip. Destructive actions live in the ⋯ menu and confirm in a dialog whose button
repeats the verb and object ("Delete 3 devices").

## 5. Page templates

Every screen is one of ten templates; a new module picks one and fills its slots.

| Template | Desktop composition | Phone (< 720 px) | Used by |
| --- | --- | --- | --- |
| 1 List page | header · one card with filter bar, table and pagination | app bar with search and add, row list | Devices, Displays, Users, Scenes, Weather, Pages, Automations |
| 2 Catalogue | header · filter card · grid `minmax(280px, 1fr)` | single column of cards | Extensions, remote-access providers, templates |
| 3 Detail | header · summary card · `el-tabs` with icons · cards per tab | summary and scrolling tabs | Device, Display, Weather location, Extension |
| 4 Edit / create | tablet landscape and up: 640 px drawer over the list; wide: the drawer docks beside the list; tablet portrait: full-width drawer | own route: full page, app bar with close and Save | every add and edit, plugin forms |
| 5 Settings / status | header · one health banner · anchor nav 168 px (desktop and up) · section cards | banner and stacked cards | Remote access, MCP, Configuration, Spaces configure |
| 6 Dashboard | stat tiles `minmax(150px, 1fr)` · panels 2:1 | tiles 2 per row | Overview |
| 7 Two-pane | list 320 px and content, independent scroll (tablet landscape and up) | list, then content as its own route (also tablet portrait) | Buddy, Notifications, logs |
| 8 Full-height editor | header with toolbar actions · palette 240 · canvas · inspector 340 (360 at wide) · bottom panel | read-only step list | Automation flow, Tiles page configure |
| 9 Wizard | header · stepper card · centred step card (max 720 px for form steps, 960 px for steps with a table: Select, Confirm) · sticky footer | progress bar and one column | device wizards, Buddy setup, Onboarding (no shell) |
| 10 Standalone | centred card 400–480 px, brand mark, large buttons | same | Sign in, Lock, OAuth consent, Rebooting |

Page padding is 12 px on phone, 16 px from tablet portrait, 24 px from desktop (`page-pad`); card gap 16 px. Long
lists keep pagination; only chronological feeds (notifications, run history, chat) use "Load more".

## 6. Screen sizes and touch

The main target is a large desktop monitor; tablets come second (people configure the house while walking around
it); phones are for checking and quick fixes. Five size classes are the only widths any layout rule may use. The
Bootstrap breakpoints (`sm` 576 … `xxl` 1400) stay in code for existing utilities during the migration, but no
design rule refers to 768, 992 or 1200.

| Size class | Width | Uno prefix | Shell | Notes |
| --- | --- | --- | --- | --- |
| Phone | 0–719 px | none | dark app bar, menu drawer | one column; automations read-only |
| Tablet portrait | 720–1023 px | `tp` | no sidebar; "Open menu" opens a 280 px modal drawer | drawers full width; two-pane layouts become list, then detail |
| Tablet landscape | 1024–1279 px | `tl` | 64 px icon rail; "Expand menu" opens the same drawer | drawers 640 px |
| Desktop | 1280–1599 px | `dt` | sidebar 220 px, collapsible to 64 | reference size for every screen (1440 px boards) |
| Wide | 1600 px and up | `wd` | sidebar 220 px | the 640 px edit drawer docks beside the list (no scrim); no separate preview pane |

- **iPad mini.** Tablet starts at 720 px, so an iPad mini held upright (744 px) gets the tablet layout.
- **Home Assistant panel and zoom.** The Home Assistant iframe (about 1024 px) lands in tablet landscape without
  touch. A 1440 px screen at 200 % browser zoom gets tablet portrait. Nothing relies on fixed pixel heights; text
  wraps, never clips.
- **Touch.** When `(pointer: coarse)` matches, `ElConfigProvider` sets `size="large"` for the whole app: controls
  and icon buttons 40 × 40 px, table rows 52 px, row actions 40 px. Nothing depends on hover; row actions stay
  visible and information tooltips become tap popovers.
- **On-screen keyboard.** The sticky form footer rides above the keyboard (positioned from `visualViewport`); the
  focused field scrolls into view inside the drawer body. Number fields use `inputmode="decimal"`, host fields
  `inputmode="url"` without autocorrect.
- **Wide screens.** Tables may grow; forms stay at most 720 px, settings pages 1200 px with the anchor nav. The
  Overview and Cameras grid add columns instead of growing tiles. Detail pages put secondary cards side by side.
- **Wide tables** scroll inside their card with the name column pinned (`position: sticky; left: 0` plus a 1 px
  shadow). On tablet portrait the Devices list drops Integration and Last seen, and the wizard Confirm table
  becomes one card per device.
- **Automation editor** is editable on tablets. Landscape narrows the palette to 208 px and keeps the inspector at
  340 px. Portrait hides the palette behind an "Add block" button (bottom sheet) and opens the inspector as a
  drawer over the canvas. Drag and drop uses a 400 ms long press on touch.

## 7. Plugin slot contract

The host owns chrome, status and saving in every slot; the plugin returns content and a few flags. Plugin authors
get `plugin-form-section` (`title`, `description`, collapsible `advanced`), `test-connection`
(`run: () => Promise<{ok, message}>`, result shown inline in status colour) and `secret-input`.

| Slot | Host renders | Plugin renders | Plugin must not |
| --- | --- | --- | --- |
| `pluginConfigEditForm` | identity row (icon, name, type · version, connection `status-tag`, Enabled switch), `form-footer` | `plugin-form-section`s, `test-connection` at the end of the section it tests | render Save, toasts, its own header or cards |
| `deviceAddForm` / `deviceEditForm` | General section (name, category, space, enabled) first, Identifiers last, footer | one section headed "&lt;Integration&gt; connection" with the integration tag | add tabs; multi-step forms become a `wizard-shell` |
| `channelPropertyAddForm`, `spaceAddForm`, `pageAddForm`, `tileAddForm`, `dataSourceAddForm`, `locationAddForm` | same frame | same as above | same as above |
| `deviceWizard` | `type-picker` tile from `{icon, name, description, order, badge}`, `wizard-shell` (Discover → Select → Confirm → Results), selection count | each step body and `canContinue` | own stepper or footer |
| `deviceCategorySection` | the device page, the Overview tab and the section order (`order`) | its content for the listed device categories, as cards above the channel list | render chrome, a tab or a save footer |
| `deviceDetailTabs` | tab with icon and label (≤ 16 characters) | cards only inside the tab | bare tables or full-width forms |
| `providerCard` | card frame, equal heights, active = 2 px primary border | icon, name, `status-tag`, one line, up to 2 endpoints (mono), one action | extra buttons; the action opens the plugin's `wizard-shell` |
| `sceneActionCard` | list, add row with device → channel → property picker | value summary chip and edit form | colour the row; the host adds `domain-icon` |
| `tilePreview` | grid cell, selection ring (2 px primary), resize handles | the tile drawn in the wall display's tokens (Roboto, radius 6, display surfaces) for the target display's theme | use admin tokens inside the tile |

Setup wizards outside Devices (HomeKit, Cloudflare Tunnel, Tailscale, Buddy) use `wizard-shell` with their own step
names; skippable steps show Skip as a tertiary button left of Back.

## 8. Cameras and UniFi Protect

Cameras is a core module in the sidebar under Home, after Spaces, with icon `mdi:cctv`. UniFi Protect is its first
provider plugin. A camera is any device of category `camera` or `doorbell`, whatever its plugin; one that cannot
stream is listed with live view off. Backend reference: [`cameras-architecture.md`](cameras-architecture.md).

| Screen | Route or place | Content |
| --- | --- | --- |
| Cameras grid | Cameras | tiles `minmax(320px, 1fr)` (300 px on tablet), space filter chips, relay chip; snapshots refresh every 10 s |
| Live view | dialog over the grid; full screen on tablet landscape | profile switch, snapshot, mute, full screen, transport line ("MSE · H.264 · AAC · 1280×720 · 25 fps"; latency is not measured), other-camera switcher |
| Device detail camera section | device detail of any camera or doorbell | player above the channels; stream profiles table with resolution, fps, video and audio codec, and the unavailable reason as a sentence |
| Cameras module settings | Configuration › Modules › Cameras | relay mode Managed / External / Disabled, binary path, external URL, sessions 1–32 (default 8), per camera 1–16 (default 4), relay status panel |
| Protect settings | Configuration › Plugins › UniFi Protect | discovered consoles, host and port, write-only API key, certificate trust, collapsed Advanced section, Test connection, connection status panel |
| Protect adoption wizard | Devices › Adopt from UniFi Protect | space and stream quality per device, non-blocking warnings, partial success with retry |
| Elsewhere | Notifications, Automations, Overview, Onboarding | notification rows with an "Open camera" link; "Front door: person detected" block summary; Overview panel with snapshots and relay state (no live streams); Protect pre-ticked in onboarding when discovered |

**Live view states.** One player component with the same nine states in the tile and the large player: snapshot
(with its age), connecting (dimmed snapshot and spinner), playing (LIVE pill), codec unsupported (names the
browsers that can play it), offline (last seen), relay unavailable (links to the relay status), limit reached per
camera (`max_sessions_per_camera`), limit reached in total (`max_sessions`), and error. On error the player retries
5 times with backoff (2, 4, 8, 16, 30 s), then stops and shows Retry. Video is MSE over a websocket (fMP4 from the
go2rtc relay); WebRTC is off.

**Relay status.** The status API returns `mode`, `state`, `reason`, `version`, `active`, `max` and
`max_per_camera`, nothing else: no uptime, restart, crash count or log link. The banner title is the state; the
line under it comes from `reason`:

| Reason code | Banner text |
| --- | --- |
| `mode_disabled` | Live view is turned off. Snapshots still work. |
| `module_disabled` | The Cameras module is turned off. |
| `binary_path_invalid` | The go2rtc path must be an absolute path to a file named go2rtc. |
| `binary_missing` | go2rtc was not found at this path. |
| `binary_not_executable` | go2rtc was found but cannot be run. Check its permissions. |
| `external_url_missing` | External mode needs the go2rtc URL. |
| `external_unreachable` | The external go2rtc does not answer. |
| `start_timeout` | go2rtc did not start in time. |
| `port_in_use` | Another program is using the relay port. |
| `crashed` | go2rtc stopped unexpectedly. It restarts automatically. |

**UniFi Protect settings.** Fields: host, port, API key (write-only), certificate trust mode (verify with
`server_name`, or pin with `fingerprint_sha256`), and a collapsed Advanced section with `stream_host_override`,
`default_stream_quality` (high / medium / low), `snapshot_min_interval_ms` and `poll_interval_ms`. In verify mode,
Test connection's `suggested_server_name` and the console's `direct_connect_domain` are offered as one-click fills.

**Test connection** returns success, console name and model, Protect version, minimum version and whether it is
supported, NVR name, an error category and message, and the certificate (subject, issuer, alternative names,
validity, self-signed, trusted, SHA-256). It returns no timing or device counts. An untrusted certificate shows its
details and a "Trust this certificate" button, which switches to pin mode.

**Connection status** shows only `connection_state`, `service_state`, enabled, configured, healthy, TLS mode,
Protect and minimum version, NVR id and name, `last_connected_at`, last error, `reconnect_attempt`,
`next_retry_at`, `realtime_state` (stopped, connecting, priming, streaming, polling) and `ignored_event_count`. The
real-time line reads "Streaming" or "Polling every N s" from the configured `poll_interval_ms` (default 30 s). The
version check uses the API's `minimum_version`; never hard-code it.

**Detection channels.** `object_detection` and `sound_detection` render through the generic channel list and
property form, with no camera-specific code. Each has exactly four properties: `detected`, `object_type` or
`sound_type`, `active` and `tampered`. There is no confidence, type list or last-event property.

### Later features

Drawn and badged "Later" on the canvas. They need backend work; implementation does not wait for them. Today's
version is drawn next to each.

| Feature | Needs | Build today |
| --- | --- | --- |
| "Show doorbell overlay" switch on a display (60 s, choice of doorbells) | a display setting and the panel overlay (UP-14) | display edit without the switch |
| "Attach snapshot" and "Hold for" on a camera trigger | trigger options | generic device property trigger, for example Smart detection › `object_type` = person |
| Snapshot thumbnail and "Save snapshot" on notifications | an image or camera reference on notifications | notification row with an "Open camera" link, no thumbnail |

The Cameras page needs no new API and stays in scope: ship the device detail camera section first, the Cameras
page right after.

## 9. Product decisions

| Topic | Decision |
| --- | --- |
| Primary colour across apps | Admin moves primary to blue; the wall display keeps red until its own redesign |
| Media domain colour | Rose `#c2185b` in the admin so it never reads as an error; the display is revisited in its redesign |
| Two-factor sign-in | Out of scope; no screen shows 2FA |
| Notifications layout | Two-pane inbox from tablet landscape; list, then detail route below. "Mark all as read" and "Mark as unread" are new UI on the existing API |
| Sidebar | Groups Home, Wall displays, Integrations, System; Cameras after Spaces |
| Icons | Automations `mdi:sitemap-outline`, MCP clients `mdi:power-plug-outline`, Weather `mdi:weather-partly-cloudy`, System `mdi:wrench-outline`, Cameras `mdi:cctv` |
| Tile preview font | Roboto, to match the display; DIN 1451 is not bundled in the admin |

## 10. Migration plan

Four phases, each visible on its own, none breaking plugins mid-way. Progress is tracked in
[`EPIC-ADMIN-UI-REDESIGN`](../tasks/epics/EPIC-ADMIN-UI-REDESIGN.md).

1. **Theme and lint.** Merge the files from `admin-ui-theme/` into `apps/admin` (`src/assets/styles/base.scss`,
   `src/assets/styles/dark.scss`, `uno.config.ts`); remove the 50 px button override and `px-4!`; set cards to
   `shadow="never"`; replace the 11 `bg-primary/5` and `border-primary/20` uses; turn on the lint rules in warn mode;
   delete `docs/admin-ui-theme/` and point every reference to it (this spec, the epic, the tree in `docs/readme.md`)
   at the `apps/admin` files.
2. **Shell and shared components.** Build the twelve wrappers and the two plugin wrappers; regroup the sidebar; add
   the size-class shell (rail, tablet drawer); switch the phone app bar to the dark style; put `view-header` on
   every routed screen; global `size="large"` on touch.
3. **Reference modules.** Rebuild Devices (list, detail, edit drawer, wizard) as the reference; then Automations,
   Remote access, MCP, Notifications and the new Cameras screens. Turn lint to error for these folders.
4. **Everything else and plugins.** Move the remaining modules onto templates; migrate the plugin settings forms to
   `plugin-form-section`; publish the slot contract in the plugin docs; turn lint to error everywhere.

## Related documents

- [`admin-ui-screens-and-plugins.md`](admin-ui-screens-and-plugins.md): what every screen and plugin shows today.
- [`admin-devices-architecture.md`](admin-devices-architecture.md): device wizard and detail-tab registration.
- [`extensions.md`](extensions.md): how admin plugins register their elements.
- [`cameras-architecture.md`](cameras-architecture.md): cameras module, relay and live view protocol.
- [`display-app-design-spec.md`](display-app-design-spec.md): the wall display app (tile previews use its tokens).
