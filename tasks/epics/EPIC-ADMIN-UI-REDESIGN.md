# Task: Admin UI redesign

ID: EPIC-ADMIN-UI-REDESIGN
Type: epic
Scope: admin
Size: large
Parent: (none)
Status: planned
Created: 2026-11-19
GitHub: (no milestone yet)

## 1. Business goal

In order to configure my home in one consistent, modern tool on a large monitor or a tablet,
As a Smart Panel administrator,
I want every admin screen, including the newer ones and every plugin form, to follow one design system.

## 2. Context

- **Design spec (authoritative):** [`docs/admin-ui-design-spec.md`](../../docs/admin-ui-design-spec.md). It holds the
  tokens, UnoCSS rules, shared components, page templates, screen sizes, plugin slot contract, the cameras screens
  and the migration plan. Read it before any task in this epic.
- **Theme files:** [`docs/admin-ui-theme/`](../../docs/admin-ui-theme/) (`base.scss`, `dark.scss`, `uno.theme.ts`),
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

- [ ] Phase 1, theme and lint: theme files merged into `apps/admin`, button override and `px-4!` removed, cards flat,
      `bg-primary/5` and `border-primary/20` replaced, lint rules on in warn mode, `docs/admin-ui-theme/` removed and
      the spec pointing at the `apps/admin` files.
- [ ] Phase 2, shell and shared components: wrappers built with unit tests, sidebar regrouped, rail and tablet
      drawer, dark phone app bar, `view-header` on every routed screen, `size="large"` on touch.
- [ ] Phase 3, reference modules: Devices, Automations, Remote access, MCP, Notifications and the Cameras screens on
      their templates; lint errors for these folders.
- [ ] Phase 4, everything else and plugins: remaining modules on templates, plugin forms on `plugin-form-section`,
      slot contract in the plugin docs, lint errors everywhere.
- [ ] Every migrated screen keeps the content listed in the inventory, works at 390, 744, 1024, 1440 and 1920 px,
      and in dark mode.

## 5. Tasks

Create one task file per phase (or per module in phases 3 and 4) when the work starts, and link it here.

## 6. Technical constraints

- Element Plus stays; no new UI kit and no new dependencies without a strong reason.
- Plugins must keep working during the migration: change a slot's host frame and its plugins in the same phase.
- i18n: all six languages; allow about 35 % longer labels.

## 7. AI instructions

- Read [`docs/admin-ui-design-spec.md`](../../docs/admin-ui-design-spec.md) before any change in this epic.
- Where an older spec, plan or feature task describes admin layout or styling differently, the design spec wins.
- Keep each PR to one phase or one module.
