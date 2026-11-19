# Admin UI design brief (archived)

> **Archived on 2026-11-19. Superseded by [`docs/admin-ui-design-spec.md`](../admin-ui-design-spec.md).**
> This was the round 1 brief given to the designer. It records the admin's visual language and drift before the
> redesign. Do not use it for new work: its colours, breakpoints and component guidance are replaced by the spec.

A brief for a designer (human or Claude Design) who will produce a design system and screen designs for the
**FastyBird Smart Panel admin app** (`apps/admin`). It describes the product, the technical constraints, the
visual language that exists today, and where the newer screens have drifted from it.

**The goal:** one consistent design language across all admin screens, so new features slot in without each
one inventing its own layout. Older screens (Devices, Displays, Pages, System) set the pattern. Newer screens
(Automations, MCP, Remote access, Notifications, Buddy, Onboarding) mostly follow it but differ in many small,
visible ways.

**The one hard constraint:** keep **Element Plus** as the component library and theme. Every design decision
should be expressible as Element Plus theme variables (SCSS `$colors` map / CSS custom properties `--el-*`),
Element Plus component props, or a small number of shared wrapper components. No new UI kit.

---

## 1. Product context

**FastyBird Smart Panel** is a self-hosted smart-home hub. A backend (NestJS) runs on a Raspberry Pi or a
small server at home. It connects to devices (Shelly, Zigbee2MQTT, Home Assistant, HomeKit, Homey, Modbus,
WLED, virtual devices…) and drives one or more wall-mounted **displays** (a separate Flutter app, not in
scope here).

The **admin app** is the browser-based control room for all of this. Typical users:

- **The installer / power user.** Sets up integrations, adds and maps devices, builds spaces (rooms),
  configures the wall-display dashboards, writes automations. Technical, works on a laptop, long sessions.
- **The household admin.** Occasionally checks status, renames things, adds a user, reads notifications,
  restarts the system. Often on a phone or tablet.

Where it runs:

- Standalone in a browser (desktop, tablet, phone), usually on the local network.
- Inside **Home Assistant** as an ingress panel (an iframe inside HA's own chrome), so it must look good when
  embedded, without relying on full-window space.
- Through remote access (Cloudflare Tunnel / Tailscale).

Tone: calm, technical, trustworthy. It is an operations tool, not a consumer app: information density
matters, but so does clarity for occasional users.

## 2. Technical constraints

| Topic | Today |
|---|---|
| Framework | Vue 3 (`<script setup>`), Vue Router, Pinia |
| Component library | **Element Plus 2.13**, themed through SCSS (`src/assets/styles/base.scss`, `dark.scss`) |
| Utility CSS | **UnoCSS** (Tailwind-like, `uno.config.ts`), used heavily for layout (`flex`, `gap-2`, `mx-2`, …) |
| Icons | **Iconify**, almost exclusively **Material Design Icons** (`mdi:*`) |
| Charts / canvas | `@vue-flow/*` for the automation graph editor. No charting library. |
| Dark mode | Class-based (`html.dark`), toggled in the top bar, Element Plus dark CSS variables |
| i18n | 6 languages: English, Czech, German, Spanish, Polish, Slovak. **Design for ~35% text expansion** (German, Polish). |
| Breakpoints | Bootstrap 5: `sm 576`, `md 768`, `lg 992`, `xl 1200`, `xxl 1400` |
| Font | Element Plus default system font stack, no custom web font |
| Extensibility | Plugins inject their own forms, cards and wizards into module screens. The design system must cover plugin UIs too. |

What the designer can freely change: the colour palette, typography scale, spacing, radii, shadows, the
choice of Element Plus component for each job, page composition, and the shell (sidebar, top bar, mobile bar).

## 3. The current visual foundation

### Colours

Defined in `apps/admin/src/assets/styles/base.scss` (passed into Element Plus):

| Role | Light | Dark |
|---|---|---|
| Primary (brand red) | `#d9230f` | `#a91b0c` |
| Success | `#469408` | (EP default derivation) |
| Warning | `#d9831f` | |
| Danger / error | `#db2828` | |
| Info | `#029acf` | |
| Page background behind content (≥ sm) | `#f5f5f5` | transparent (EP dark bg) |
| Soft / mute backgrounds | `#fafafa` / `#f2f2f2` | `#242424` / `#2c2c2c` |
| Sidebar background | `#222` | `#0a0a0a` |
| Sidebar text / hover / active | `#808080` / `#a6a6a6` on `#191919` / `#fff` on `#191919` | same |

Known problems the designer should solve:

1. **Primary and danger are nearly the same red** (`#d9230f` vs `#db2828`). A "Save" and a "Delete" button
   look identical. Brand red needs to stay, but its role (primary action vs. accent only) must be decided.
2. **Two palettes exist.** `uno.config.ts` declares success/warning/danger/info as the *Element Plus default*
   colours (`#67c23a`, `#e6a23c`, `#f56c6c`, `#909399`), while the theme uses the custom ones above. Newer
   code (e.g. the automation canvas) hard-codes the EP defaults, plus `#409eff` blue, which is not in the
   theme at all. Result: two greens, two reds and two blues on screen.
3. **Raw grey utilities instead of theme tokens.** Many newer components use `text-gray-500`,
   `border-gray-200`, `bg-gray-50`, which do not adapt to dark mode. Heaviest: Onboarding, Buddy setup
   wizard, Spaces home-control plugin, Extensions, MCP, Remote access.

Deliverable: one token sheet (light + dark) mapped 1:1 onto Element Plus variables, plus a short list of
semantic tokens (text primary/secondary/muted, surface, surface-raised, border, status-*) for anything
Element Plus does not cover.

### Typography, spacing, shape

- No explicit type scale. Headings use UnoCSS ad hoc (`text-large font-600`, `text-3xl`, `font-bold`,
  `text-sm`). Card headers are sometimes bold, sometimes regular, sometimes plain text.
- Spacing is mostly an 8 px rhythm (`gap-2`, `mx-2`, `mt-2`, `p-2 md:px-4`), but pages differ in outer margin.
- Default button horizontal padding is overridden to **50 px** (wide buttons). In practice most screens then
  override it back with `px-4!`, so there are effectively two button widths.
- Cards almost always use `shadow="never"` (flat, bordered). Some new cards use `shadow="hover"`.
- Element Plus default radii.

Deliverable: a type scale (page title, section title, card title, body, secondary, caption, monospace for
URLs/IDs/tokens), spacing scale, radius and elevation rules, and a decision on button sizing.

### Brand assets

`src/assets/images/`: `fb_bird.svg` (bird mark), `fb_smartpanel.svg` (wordmark), `fb_row.svg`
(horizontal logo, used in the mobile app bar), `fb_fastybird.svg`. Logos render white on the red/dark
sidebar header; in dark mode the bird is red with a red glow.

## 4. App shell

### Desktop and tablet (≥ 768 px)

```
┌────────────┬──────────────────────────────────────────────────────────┐
│ [bird]     │ ☰  Home / Devices / Living room lamp      🔔  EN  ☾  (A) Adam │  top bar, 56px
│ SmartPanel ├──────────────────────────────────────────────────────────┤
├────────────┤ (◉) Devices                         [Wizard] [+ Add]       │  view header (page header)
│ ▸ Stats    ├──────────────────────────────────────────────────────────┤
│ ▸ Buddy    │  ┌ filter bar card ───────────────────────────────────┐  │
│ ▸ Spaces   │  └────────────────────────────────────────────────────┘  │
│ ▸ Pages    │  ┌ table card ────────────────────────────────────────┐  │
│ ▸ Devices  │  │ …                                                   │  │
│ …          │  │                       ‹ 1 2 3 › 20/page             │  │
│            │  └────────────────────────────────────────────────────┘  │
└────────────┴──────────────────────────────────────────────────────────┘
 220px (64px collapsed;                 #f5f5f5 content background
 collapsed by default below 1200px)
```

- **Sidebar**: dark (`#222`), red logo block at top (55 px), Element Plus `el-menu` with MDI icons, 40 px
  items, 0.8 rem text. Groups (Configuration, System) open as sub-menus.
- **Top bar**: collapse toggle, breadcrumbs (teleported from each page), notification bell, language
  switcher, light/dark switch, user avatar dropdown (profile, security, lock screen, sign out).
- **View header** (`common/components/view-header.vue`): Element Plus `el-page-header` with a back arrow,
  a 32 px round avatar holding the module icon, title, subtitle, and an `extra` slot for actions.

### Phone (< 768 px)

- A red **app bar** (50 px, primary colour, drop shadow) replaces the sidebar and top bar. Each page teleports
  into it: an icon + title + subtitle, a left button (back / "HOME"), and *one* right button
  (e.g. "ADD", "SAVE") in uppercase text.
- The menu opens as a drawer (80 % width) that also contains the user menu.
- The view header is hidden. Content gets 4 px side margins.

## 5. Navigation map

Sidebar order today (top to bottom). Items are hidden when their module is disabled.

| Menu item | Icon | Screens | Age |
|---|---|---|---|
| **Stats** (home) | `mdi:monitor-dashboard` | Overview dashboard: stat tiles (devices, spaces, CPU, memory, uptime), system info, logs, quick links | 2025 |
| **Buddy** | `mdi:robot-happy` | AI assistant chat: conversation list + chat pane, setup wizard | 2026-03 |
| **Spaces** | `mdi:home-group` | Rooms/zones list, add, edit, per-type wizard, plugin configure page (lighting/climate/covers/media roles) | 2025-12 |
| **Pages** | `mdi:view-dashboard` | Wall-display dashboard pages, tiles, cards, data sources (list + configure screens) | 2025 |
| **Devices** | `mdi:devices` | Device list, detail (info card + tabs), edit, control, channels and properties, add wizard per integration | 2025 (**reference**) |
| **MCP clients** | `mdi:robot-outline` | API clients for AI tools: endpoint card, client list, create/rotate/revoke tokens | 2026-08 |
| **MCP OAuth** | `mdi:shield-key-outline` | OAuth grants management; consent screen (standalone) | 2026-08 |
| **Displays** | `mdi:monitor` | Wall displays list, detail, edit, access tokens | 2025-12 |
| **Scenes** | `mdi:play-box-multiple` | Scenes list, add, edit | 2026-01 |
| **Automations** | `mdi:robot-outline` | List, add, edit, **flow editor canvas**, run history, templates, YAML import/export, suggestions | 2026-11 (**newest**) |
| **System** | `mdi:hammer` | Info, backups, logs (+ log detail); maintenance screens (reboot, power off, factory reset) | 2025 |
| **Weather** | `mdi:map-marker-multiple` | Locations list, add, edit, detail | 2025-12 |
| **Remote access** | `mdi:cloud-lock-outline` | Status banner, access URLs, provider cards, security advisories | 2026-09 |
| **Extensions** | `mdi:puzzle` | Installed modules/plugins catalogue, extension detail, services | 2025-12 |
| **Configuration** | `mdi:cog` | Tabs: Modules / Plugins, each opening a per-module/plugin settings form | 2025 |
| **Users** | `mdi:users-group` | Users list, add, edit | 2025 |
| **Notifications** | `mdi:bell-outline` | Inbox list with "load more", detail drawer; bell popover in the top bar | 2026-09 |

Outside the shell: sign in / sign up, lock screen, profile (general, security), **onboarding** (full-screen
first-run wizard: welcome, account, location, integrations, spaces, done), MCP OAuth consent, and the
maintenance/rebooting screens.

## 6. Established screen patterns (the ones to formalise)

These are what the older, consistent screens do. The designer should keep what works, fix what doesn't,
and write each one down as a template.

1. **List page** (Devices, Displays, Users, Scenes, Weather, Pages, Automations list)
   - View header with module icon, title, subtitle and actions on the right (primary action + secondary
     *plain* actions).
   - **Filter bar card**: search, a few quick filters, "adjust filters" button opening a 300 px right drawer,
     bulk-action toolbar that appears when rows are selected (enable / disable / delete, coloured by type).
   - **Table card** (`el-table`, selectable rows, sortable columns, icon/state/plugin columns, row actions)
     filling the remaining height, with `el-pagination` under it.
2. **Edit / add in a drawer** (desktop ≥ 992 px) **or full page** (smaller)
   - Drawer is 40 % wide. Its header reuses the app-bar component (icon, title, subtitle, close ×).
   - Body: `el-form` with labels on top, scrollable.
   - **Sticky footer** (48 px, top border + shadow): "Discard" (link, when dirty) or "Close", then primary
     "Save" that shows a spinner, then ✓ or ✗ inline.
3. **Detail page** (Device, Display, Weather location): view header with action buttons, a **summary card**
   on top, then `el-tabs` with icon labels (Overview, Channels, Logs, …).
4. **Settings form** (Configuration → Modules/Plugins, each module's `*-config-form`): form with sections.
5. **Wizards** (device add per integration, spaces wizard, virtual devices, Modbus, onboarding): `el-steps`
   on top, one step per screen, Back / Next footer.
6. **States**:
   - Loading: `v-loading` overlay with a sentence ("Loading device…").
   - Empty: `el-result` with a large module icon and a small ⓘ badge (`empty-state.vue`, `icon-with-child`).
   - Not found: `entity-not-found.vue` (icon, message, back button).
   - Errors/warnings: `el-alert` (used ~200 times; it is the main way of showing status and hints).
   - Status values: `el-tag` with success/warning/danger/info types.

## 7. Where the newer screens drift

Concrete inconsistencies found in the code. They are the reason for this brief.

| Area | What happens today |
|---|---|
| **Page chrome** | MCP clients and Buddy skip parts of the phone pattern (no breadcrumbs, or no app-bar actions). Automation add/edit and many edit screens have no view header at all and rely on the drawer header. The flow editor has its own toolbar row under the header. |
| **Header actions** | The primary action is sometimes `type="primary"`, sometimes `type="primary" plain`, sometimes `plain`. Icon-only and labelled buttons are mixed in the same header (Device detail). |
| **Page body composition** | Remote access is a single scroll of status alert, then a URLs card, then tabs containing a card grid. MCP is alert, then endpoint card, then table. Notifications use "load more" instead of pagination. Buddy is a two-pane layout with a fixed 250 px list. There is no shared "settings/status page" or "two-pane" template. |
| **Cards** | `shadow="never"` vs `shadow="hover"`, bold vs regular card titles, inconsistent header padding (`py-2!`, `py-3!`), card grids with different min widths. |
| **Status and hints** | The same kind of information is shown as `el-alert` banners, `el-tag`s, coloured text, or grey helper text, depending on the screen. Info alerts are stacked at the top of pages (MCP security note, capability ceiling hint). |
| **Colour** | Hard-coded EP-default hex values and `gray-*` utilities in newer modules (see §3). The automation canvas uses its own node/edge status colours. |
| **Dialogs vs drawers** | About 40 components use `el-dialog` and 28 use `el-drawer`, with no rule for which to use. Automations alone has template, YAML, import and test dialogs. |
| **Lists vs cards** | Providers and extensions show cards, devices show tables, notifications show a custom list. There is no rule for when to use which. |
| **Icons** | Automations and MCP clients share the same menu icon (`mdi:robot-outline`), and Buddy uses `mdi:robot-happy`, so three robots sit in the sidebar. |
| **Empty states** | `el-result` (50 uses) vs `empty-state` (10 uses) vs plain grey text with an icon (Automations load-failed). |

## 8. What we need from the designer

### A. Foundations (Element Plus theme)

- Colour tokens for light and dark, mapped to `$colors` / `--el-color-*`, `--el-text-color-*`,
  `--el-bg-color*`, `--el-border-color*`, `--el-fill-color*`. Resolve primary vs danger.
- A semantic status palette that is also used for graph nodes, tags, alerts and badges.
- Type scale, spacing scale, radius, elevation (when, if ever, a card gets a shadow).
- Button hierarchy: primary / secondary (plain) / tertiary (link) / danger, sizes, icon-only rules.
- Icon rules: MDI only, sizes (16 / 18 / 20 / 24 / 32), when a module icon appears.

### B. Component guidelines

Page header · breadcrumbs · phone app bar · filter bar and bulk-action toolbar · data table (columns, row
actions, selection, status column) · pagination vs load-more · card (and card grid) · summary/detail card ·
tabs · form layout (sections, label position, help text, inline validation, read-only values such as URLs,
tokens and IDs with copy) · sticky form footer · drawer vs dialog decision rule · confirmation dialogs
(destructive) · alert/banner usage rules · status tag · empty, loading, error, not-found states · wizard
stepper · notification bell popover · toasts/flash messages.

### C. Page templates

1. List page (table)
2. Catalogue page (card grid), e.g. extensions, providers, templates
3. Detail page (summary + tabs)
4. Edit/create form (drawer on desktop, full page on phone)
5. Settings / status page (health banner + sections), e.g. Remote access, MCP, module config
6. Dashboard (stat tiles + panels), e.g. Stats
7. Two-pane page (list + content), e.g. Buddy chat, Notifications with detail
8. Full-height editor (canvas + palette + inspector panel + toolbar), e.g. Automation flow
9. Wizard (in-shell and full-screen onboarding)
10. Auth / standalone (sign in, lock screen, OAuth consent, rebooting)

Each template: desktop (≥ 1200), tablet (768–1199), phone (< 768), and dark mode.

### D. Screen designs (priority order)

1. **Automations**: list, flow editor (palette, node cards, node inspector, issues list, run history,
   test run), template picker, YAML import/export.
2. **Devices** list and device detail, as the reference that everything else is checked against.
3. **Remote access** (status page).
4. **MCP clients** + **MCP OAuth** (credentials list, create/rotate token with one-time secret reveal).
5. **Notifications** (inbox + detail + bell popover).
6. **Buddy** chat and setup wizard.
7. **Onboarding** wizard.
8. **Stats** home dashboard.
9. **Configuration** (module/plugin settings forms), with a generic plugin settings form.
10. **Spaces** configure page (home-control roles: lighting, climate, covers, media).

## 9. Non-negotiables

- Element Plus components and theming. Designs must be buildable with stock EP components plus CSS
  variables, not custom-drawn widgets (the automation canvas is the one exception).
- Light and dark mode for every screen.
- Works at 360 px phone width and inside the Home Assistant iframe.
- Text expansion for 6 languages, no text baked into images.
- WCAG 2.1 AA contrast, visible focus states, icon-only buttons need a label/tooltip.
- Keep the FastyBird red as the brand colour.
- Plugins render their own forms inside module screens: patterns must be generic enough for third-party
  plugin authors to follow.

## 10. Source pointers (for anyone with repo access)

| What | Where |
|---|---|
| Theme tokens | `apps/admin/src/assets/styles/base.scss`, `dark.scss`, `apps/admin/uno.config.ts` |
| Shell | `apps/admin/src/common/layouts/layout-default.vue`, `common/components/app-*.vue` |
| Page header | `apps/admin/src/common/components/view-header.vue` |
| Empty / not-found | `common/components/empty-state.vue`, `entity-not-found.vue` |
| Reference list page | `apps/admin/src/modules/devices/views/view-devices.vue`, `components/devices/list-devices.vue` |
| Reference detail page | `apps/admin/src/modules/devices/views/view-device.vue` |
| Reference edit page | `apps/admin/src/modules/devices/views/view-device-edit.vue` |
| Newer screens | `modules/automations`, `modules/mcp`, `modules/remote-access`, `modules/notifications`, `modules/buddy`, `modules/onboarding` |
| Routes and menu | `apps/admin/src/modules/*/router/index.ts` (`meta.menu` = sort weight, higher first) |
| Panel (display) design, for brand alignment | `docs/display-app-design-spec.md` |

See also: [admin-ui-screens-and-plugins.md](admin-ui-screens-and-plugins.md), the full inventory of module screens and plugins.
