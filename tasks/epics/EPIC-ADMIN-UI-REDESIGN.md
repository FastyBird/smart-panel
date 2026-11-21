# Task: Admin UI redesign

ID: EPIC-ADMIN-UI-REDESIGN
Type: epic
Scope: admin
Size: large
Parent: (none)
Status: in-progress
Created: 2026-11-19
GitHub: #1657 (milestone: Admin UI redesign)

## 1. Business goal

In order to configure my home in one consistent, modern tool on a large monitor or a tablet,
As a Smart Panel administrator,
I want every admin screen, including the newer ones and every plugin form, to follow one design system.

## 2. Context

- **Design spec (authoritative):** [`docs/admin-ui-design-spec.md`](../../docs/admin-ui-design-spec.md). It holds the
  tokens, UnoCSS rules, shared components, page templates, screen sizes, plugin slot contract, the cameras screens
  and the migration plan. Read it before any task in this epic.
- **Theme files:** [`apps/admin/src/assets/styles/base.scss`](../../apps/admin/src/assets/styles/base.scss),
  [`dark.scss`](../../apps/admin/src/assets/styles/dark.scss) and [`apps/admin/uno.theme.ts`](../../apps/admin/uno.theme.ts),
  approved after three design rounds and checked against Element Plus 2.13.5 and UnoCSS.
- **Current-state inventory:** [`docs/admin-ui-screens-and-plugins.md`](../../docs/admin-ui-screens-and-plugins.md).
- **Visual source:** the design canvas linked from the spec (about 170 boards: desktop, dark, tablet portrait,
  tablet landscape, wide and phone).
- The cameras screens depend on the UniFi Protect epic ([`EPIC-UNIFI-PROTECT`](EPIC-UNIFI-PROTECT.md), UP-11 and
  UP-12); this epic defines how they look.

## 3. Scope

**In scope**

- Theme, lint rules and UnoCSS migration.
- The app shell for five size classes, the twelve shared wrappers and the two plugin wrappers.
- Every module screen moved onto one of the ten page templates.
- Every plugin settings form, device form and wizard moved onto the slot contract.
- The cameras module screens and the UniFi Protect plugin screens (with the UniFi Protect epic).

**Out of scope**

- The three "Later" camera features in spec section 8 (doorbell overlay switch, snapshot attachments and "Hold for"
  on triggers, notification thumbnails); they need backend work first.
- Two-factor sign-in.
- The wall display app.

## 4. Acceptance criteria

- [x] Phase 1, theme and lint: theme files merged into `apps/admin`, button override and `px-4!` removed, cards flat,
      `bg-primary/5` and `border-primary/20` replaced, lint rules on in warn mode, `docs/admin-ui-theme/` removed, and
      every reference to it updated to the `apps/admin` files: the spec header and section 10, section 2 of this
      epic, and the documentation tree in `docs/readme.md`.
- [ ] Phase 2, shell and shared components: wrappers built with unit tests, sidebar regrouped, rail and tablet
      drawer, dark phone app bar, `view-header` on every routed screen, `size="large"` on touch.
- [ ] Phase 3, reference modules: Devices, Automations, Remote access, MCP, Notifications and the Cameras screens on
      their templates; lint errors for these folders.
- [ ] Phase 4, everything else and plugins: remaining modules on templates, plugin forms on `plugin-form-section`,
      slot contract in the plugin docs, lint errors everywhere.
- [ ] Every migrated screen keeps the content listed in the inventory, works at 390, 744, 1024, 1440 and 1920 px,
      and in dark mode.

## 5. Tasks

Sub-issues of #1657 in the [Admin UI redesign](https://github.com/FastyBird/smart-panel/milestone/21) milestone. PR titles
are the issue titles. The issue bodies carry the full acceptance criteria; the notes below are the summary. Every task
that changes screens also keeps the inventory content, is checked at 390, 744, 1024, 1440 and 1920 px in light and
dark, and updates all six locales.

| ID | Issue | Phase | Task | Depends on | Status |
|---|---|---|---|---|---|
| AR-1 | #1658 | 1 | `feat(admin): adopt the redesign theme and UnoCSS tokens` | — | merged in #1690 |
| AR-2 | #1659 | 1 | `chore(admin): add the design system lint rules in warn mode` | AR-1 | merged in #1692 |
| AR-3 | #1660 | 2 | `feat(admin): add state, status and data display components` | AR-1 | merged in #1701 |
| AR-4 | #1661 | 2 | `feat(admin): add form footer, secret input and type picker components` | AR-1 | merged in #1702 |
| AR-5 | #1662 | 2 | `feat(admin): add list filter bar and wizard shell components` | AR-1, AR-4 | merged in #1704 |
| AR-6 | #1663 | 2 | `feat(admin): add plugin form section and test connection components` | AR-3, AR-4 | open |
| AR-7 | #1664 | 2 | `feat(admin): add the size-class shell with icon rail and tablet drawer` | AR-1 | merged in #1703 |
| AR-8 | #1665 | 2 | `feat(admin): show the page header on every screen and darken the phone app bar` | AR-7 | in review |
| AR-9 | #1666 | 3 | `refactor(admin): move the devices list and detail onto the page templates` | AR-3, AR-5, AR-8 | open |
| AR-10 | #1667 | 3 | `refactor(admin): move device add and edit onto the edit drawer` | AR-4, AR-6, AR-9 | open |
| AR-11 | #1668 | 3 | `refactor(admin): move device plugin forms onto the slot contract` | AR-6, AR-10 | open |
| AR-12 | #1669 | 3 | `refactor(admin): move the device wizards onto the wizard shell` | AR-4, AR-5, AR-9 | open |
| AR-13 | #1670 | 3 | `refactor(admin): move automations onto the list and editor templates` | AR-3, AR-5, AR-8 | open |
| AR-14 | #1671 | 3 | `refactor(admin): move remote access onto the settings and catalogue templates` | AR-3, AR-4, AR-5, AR-6, AR-8 | open |
| AR-15 | #1672 | 3 | `refactor(admin): move MCP clients onto the page templates` | AR-3, AR-4, AR-5, AR-8 | open |
| AR-16 | #1673 | 3 | `feat(admin): turn notifications into a two-pane inbox` | AR-3, AR-5, AR-8 | open |
| AR-17 | #1674 | 4 | `refactor(admin): move spaces onto the page templates` | AR-9, AR-10 | open |
| AR-18 | #1675 | 4 | `refactor(admin): move scenes onto the page templates` | AR-9, AR-10 | open |
| AR-19 | #1676 | 4 | `refactor(admin): move displays onto the page templates` | AR-9, AR-10 | open |
| AR-20 | #1677 | 4 | `refactor(admin): move pages and tiles onto the page templates` | AR-9, AR-10, AR-13 | open |
| AR-21 | #1678 | 4 | `refactor(admin): move weather onto the page templates` | AR-9, AR-10 | open |
| AR-22 | #1679 | 4 | `refactor(admin): rebuild the overview as a dashboard` | AR-3, AR-8 | open |
| AR-23 | #1680 | 4 | `refactor(admin): move buddy onto the two-pane and wizard templates` | AR-5, AR-8 | open |
| AR-24 | #1681 | 4 | `refactor(admin): move users, extensions and system onto the page templates` | AR-3, AR-5, AR-8 | open |
| AR-25 | #1682 | 4 | `refactor(admin): move sign-in, system state and onboarding screens onto the standalone template` | AR-4, AR-5 | open |
| AR-26 | #1683 | 4 | `refactor(admin): move configuration and plugin settings onto the slot contract` | AR-3, AR-4, AR-6, AR-8 | open |
| AR-27 | #1684 | 4 | `docs(cross): publish the admin slot contract and lint rules for plugin authors` | AR-2, AR-6, AR-26 | open |
| AR-28 | #1685 | 4 | `chore(admin): turn the design system lint rules to error everywhere` | AR-9 … AR-26 | open |
| AR-29 | #1686 | 4 | Integrated verification on real devices | phases 1–4 merged, UP-11, UP-12 | open |
| UP-11 | #1187 | 3 | `feat(admin): add camera live view and snapshot components` (UniFi Protect epic) | AR-3, AR-4, AR-7, AR-8 | open |
| UP-12 | #1188 | 3 | `feat(admin): add UniFi Protect plugin configuration and adoption wizard` (UniFi Protect epic) | AR-4, AR-6, AR-12 | open |

### Execution order

1. **Phase 1:** AR-1 → AR-2.
2. **Phase 2:** AR-3, AR-4 and AR-7 in parallel after AR-1; AR-5 after AR-4; AR-6 after AR-3 and AR-4; AR-8 after
   AR-7.
3. **Phase 3:** AR-9 → (AR-10 ∥ AR-12) → AR-11. In parallel once phase 2 is merged: AR-13, AR-14, AR-15, AR-16, and
   UP-11 / UP-12 from the UniFi Protect epic.
4. **Phase 4:** AR-17 … AR-26 in any order once their dependencies merge; AR-27 after AR-26; AR-28 after all module
   tasks; AR-29 closes the epic.

A task that migrates a folder switches that folder's lint rules to error in the same PR. A slot's host frame and its
plugins change in the same task (AR-26 may split into several PRs inside phase 4).

### Issue summaries

**AR-1 — adopt the redesign theme and UnoCSS tokens**
The admin runs on the approved theme: blue primary, one palette for light and dark, flat cards and Element Plus default button sizes. Nothing else in the layout changes yet. Files: `apps/admin/src/assets/styles/base.scss`, `dark.scss`, `apps/admin/uno.config.ts`, buttons with `px-4!`, cards with a shadow, the 11 `bg-primary/5` / `border-primary/20` uses; `docs/admin-ui-theme/` (deleted), `docs/admin-ui-design-spec.md`, `tasks/epics/EPIC-ADMIN-UI-REDESIGN.md`, `docs/readme.md`. Spec: §1, §2, §3, §10 phase 1.

**AR-2 — add the design system lint rules in warn mode**
CI reports every place that breaks the design system, as warnings, and each later task can switch its folders to errors with one config line. Files: `apps/admin/eslint.config.ts`, `apps/admin/tools/**` (local rules), `package.json` scripts. Spec: §3 (rules 1–5).

**AR-3 — add state, status and data display components**
Screens and plugins have one way to show empty, loading, error and not-found states, a status, a key-value grid, a copyable value and a domain icon. Files: `apps/admin/src/common/components/` (new `state-view`, `status-tag`, `kv-grid`, `copy-field`, `domain-icon`), `components.ts`, locales. Spec: §2 (domain colours), §4.

**AR-4 — add form footer, secret input and type picker components**
Every add and edit form gets the same sticky Save footer, secrets are never echoed back, and every plugin-type choice uses one picker. Files: `apps/admin/src/common/components/` (new `form-footer`, `secret-input`, `type-picker`), `components.ts`, locales. Spec: §4, §6 (on-screen keyboard).

**AR-5 — add list filter bar and wizard shell components**
Lists share one search, filter and bulk-action bar, and every multi-step flow shares one stepper and footer. Files: `apps/admin/src/common/components/` (new `list-filter-bar`, `wizard-shell`), `components.ts`, locales. Spec: §4, §5 (templates 1 and 9).

**AR-6 — add plugin form section and test connection components**
Plugin authors have the two building blocks the slot contract asks for. Files: `apps/admin/src/common/components/` (new `plugin-form-section`, `test-connection`), `components.ts`, locales. Spec: §7.

**AR-7 — add the size-class shell with icon rail and tablet drawer**
The shell fits phone, tablet portrait, tablet landscape, desktop and wide screens, with the regrouped sidebar, and controls grow on touch screens. Files: `apps/admin/src/common/components/app-sidebar*`, `app-navigation*`, `app-top-bar*`, `src/common/composables/useBreakpoints.ts`, the root layout, `useMenu`, module menu registrations. Spec: §6, §9 (sidebar, icons).

**AR-8 — show the page header on every screen and darken the phone app bar**
Every routed screen has one header that renders as the page header on desktop and as the dark app bar on phone. Files: `apps/admin/src/common/components/view-header*`, `app-bar*`, `app-breadcrumbs*`, every routed view in `src/modules/**` and `src/plugins/**`. Spec: §1, §4 (`view-header`, `app-bar`).

**AR-9 — move the devices list and detail onto the page templates**
Devices is the reference list and detail screen that later modules copy. Files: `apps/admin/src/modules/devices/**` (list, detail, channels), plugins that register `deviceDetailTabs`. Spec: §5 (templates 1 and 3), §6 (wide tables), §7 (`deviceDetailTabs`).

**AR-10 — move device add and edit onto the edit drawer**
Adding and editing a device or channel property uses the edit template and the host side of the slot contract. Files: `apps/admin/src/modules/devices/**` (add, edit, channel and property forms). Spec: §5 (template 4), §7 (`deviceAddForm`, `deviceEditForm`, `channelPropertyAddForm`).

**AR-11 — move device plugin forms onto the slot contract**
Every device integration renders one "<Integration> connection" section and nothing else in the device forms. Files: `apps/admin/src/plugins/devices-*/**`, `apps/admin/src/plugins/simulator/**` (device forms only). Spec: §7.

**AR-12 — move the device wizards onto the wizard shell**
All nine device wizards share one picker and one Discover → Select → Confirm → Results flow. Files: `apps/admin/src/modules/devices/**` (wizard host, type picker), `deviceWizard` adapters in `apps/admin/src/plugins/devices-*` and `simulator`. Spec: §5 (template 9), §7 (`deviceWizard`).

**AR-13 — move automations onto the list and editor templates**
Automations follows the list and full-height editor templates and can be edited on a tablet. Files: `apps/admin/src/modules/automations/**`. Spec: §5 (templates 1 and 8), §6 (automation editor).

**AR-14 — move remote access onto the settings and catalogue templates**
Remote access shows one health banner, section cards and a provider catalogue, with provider setup as a wizard. Files: `apps/admin/src/modules/remote-access/**`, `apps/admin/src/plugins/remote-access-*/**`. Spec: §5 (templates 2 and 5), §7 (`providerCard`).

**AR-15 — move MCP clients onto the page templates**
MCP settings, clients and OAuth screens follow the settings and list templates. Files: `apps/admin/src/modules/mcp/**`. Spec: §5 (templates 1, 4, 5 and 10), §9 (icon).

**AR-16 — turn notifications into a two-pane inbox**
Notifications reads like an inbox: list and detail side by side from tablet landscape, with Mark all as read and Mark as unread. Files: `apps/admin/src/modules/notifications/**`. Spec: §5 (template 7), §9 (notifications layout).

**AR-17 — move spaces onto the page templates**
Spaces list, detail, configure and add screens follow the templates, and the space plugins follow the slot contract. Files: `apps/admin/src/modules/spaces/**`, `apps/admin/src/plugins/spaces-*/**`. Spec: §5 (templates 1, 3, 4 and 5), §7 (`spaceAddForm`).

**AR-18 — move scenes onto the page templates**
Scenes follow the list and edit templates, and scene actions use the `sceneActionCard` frame. Files: `apps/admin/src/modules/scenes/**`, `apps/admin/src/plugins/scenes-local/**`. Spec: §5 (templates 1 and 4), §7 (`sceneActionCard`).

**AR-19 — move displays onto the page templates**
Displays list, detail, edit and tokens screens follow the templates. Files: `apps/admin/src/modules/displays/**`. Spec: §5 (templates 1, 3 and 4), §8 (Later: doorbell overlay is out of scope).

**AR-20 — move pages and tiles onto the page templates**
Wall-display pages and tiles follow the templates, and tile previews look like the display. Files: `apps/admin/src/modules/dashboard/**`, `apps/admin/src/plugins/{pages-*,tiles-*,data-sources-*}/**`. Spec: §5 (templates 1, 4 and 8), §7 (`pageAddForm`, `tileAddForm`, `dataSourceAddForm`, `tilePreview`), §9 (tile font).

**AR-21 — move weather onto the page templates**
Weather locations follow the list, detail and edit templates, and the weather providers follow the slot contract. Files: `apps/admin/src/modules/weather/**`, `apps/admin/src/plugins/weather-*/**`. Spec: §5 (templates 1, 3 and 4), §7 (`locationAddForm`).

**AR-22 — rebuild the overview as a dashboard**
The home screen is a dashboard of stat tiles and panels. Files: `apps/admin/src/modules/stats/**`. Spec: §5 (template 6), §8 (Overview panel).

**AR-23 — move buddy onto the two-pane and wizard templates**
Buddy chat is a two-pane screen and Buddy setup is a wizard. Files: `apps/admin/src/modules/buddy/**`. Spec: §5 (templates 7 and 9).

**AR-24 — move users, extensions and system onto the page templates**
Users, Extensions, System info, backups and logs follow the templates. Files: `apps/admin/src/modules/{users,extensions,system}/**`. Spec: §5 (templates 1, 2, 3, 5 and 7).

**AR-25 — move sign-in, system state and onboarding screens onto the standalone template**
Every screen outside the shell is a centred standalone card, and onboarding is a wizard without the shell. Files: `apps/admin/src/modules/{auth,onboarding}/**`, `apps/admin/src/modules/system/views/view-{rebooting,power-off,factory-reset,service-restarting}.vue`. Spec: §5 (templates 9 and 10), §9 (no two-factor sign-in).

**AR-26 — move configuration and plugin settings onto the slot contract**
Configuration follows the settings template, and every plugin settings form sits in the same host frame. Files: `apps/admin/src/modules/config/**`, the `pluginConfigEditForm` component of every plugin in `apps/admin/src/plugins/**`. Spec: §5 (template 5), §7 (`pluginConfigEditForm`).

**AR-27 — publish the admin slot contract and lint rules for plugin authors**
Third-party plugin authors know what each slot renders and get the same lint checks. Files: `docs/extensions.md`, `docs/admin-devices-architecture.md`, `apps/website/**` (plugin docs), `packages/example-extension/**`, `packages/extension-sdk/**` (lint preset). Spec: §3 (rule 6), §7.

**AR-28 — turn the design system lint rules to error everywhere**
The migration is finished and the rules keep it that way. Files: `apps/admin/eslint.config.ts`, `apps/admin/uno.config.ts`, `docs/admin-ui-design-spec.md`, `tasks/epics/EPIC-ADMIN-UI-REDESIGN.md`. Spec: §3, §10 phase 4.

**AR-29 — admin UI redesign integrated verification**
The redesign is checked as a whole on real devices before the epic closes. Files: none (verification only). Spec: §6, epic acceptance criteria.

## 6. Technical constraints

- Element Plus stays; no new UI kit and no new dependencies without a strong reason.
- Plugins must keep working during the migration: change a slot's host frame and its plugins in the same phase.
- i18n: all six languages; allow about 35 % longer labels.

## 7. AI instructions

- Read [`docs/admin-ui-design-spec.md`](../../docs/admin-ui-design-spec.md) before any change in this epic.
- Where an older spec, plan or feature task describes admin layout or styling differently, the design spec wins.
- Keep each PR to one phase or one module.
