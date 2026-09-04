# Task: Notifications module translations

ID: FEATURE-NOTIFICATIONS-ADMIN-LOCALES
Type: feature
Scope: admin
Size: tiny
Parent: EPIC-NOTIFICATIONS-MODULE
Status: done

## 1. Business goal

In order to use the notifications module in their preferred language,
As a Smart Panel administrator,
I want the bell, page and config form translated into every locale the admin already supports.

## 2. Context

- This is task N-7; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Depends on `FEATURE-NOTIFICATIONS-ADMIN-PAGE` (N-6), which finishes introducing every
  `notificationsModule.*` key in `en-US.json`.
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-7 section.
- Existing locale set and tone reference: `apps/admin/src/modules/extensions/locales/*.json`.
- The six locales supported throughout the admin: `en-US`, `cs-CZ`, `de-DE`, `es-ES`, `pl-PL`, `sk-SK`.

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/892 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- `locales/cs-CZ.json`, `locales/de-DE.json`, `locales/es-ES.json`, `locales/pl-PL.json`,
  `locales/sk-SK.json`, and `locales/index.ts`.
- `notification-popover.spec.ts` and `notification-detail-drawer.spec.ts` covering rendering.
- A spec that diffs the key trees of all six locale files to prove they stay identical.

**Out of scope**

- Any new `notificationsModule.*` key (belongs to whichever earlier task introduces the UI text).
- Non-admin scopes.

## 4. Acceptance criteria

- [ ] `cs-CZ.json`, `de-DE.json`, `es-ES.json`, `pl-PL.json` and `sk-SK.json` each translate every
      `notificationsModule.*` key present in `en-US.json`.
- [ ] Wording tone matches `apps/admin/src/modules/extensions/locales/*.json`.
- [ ] A spec diffs the key trees of all six locale files and fails if any key is missing or extra in any
      file.
- [ ] `notification-popover.spec.ts` covers rendering of the popover (items, footer actions, empty state).
- [ ] `notification-detail-drawer.spec.ts` covers rendering of the drawer (message, data table, actions,
      timestamps).
- [ ] `cd apps/admin && npx vitest run src/modules/notifications` passes.
- [ ] `pnpm --filter ./apps/admin run type-check` passes.

## 6. Technical constraints

- Depends on: N-6 / FEATURE-NOTIFICATIONS-ADMIN-PAGE.
- Match the tone and terminology of `apps/admin/src/modules/extensions/locales/*.json`.
- Admin tests use `@vue/test-utils`; isolated runs use `npx vitest run <path>` from `apps/admin`.
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `feat(admin): translate the notifications module`
- Suggested worker tier: implementer sonnet / low, reviewer sonnet / low.

## 7. Implementation hints

From the plan's Task N-7: "Behaviour: key sets identical across all six files (add a spec that diffs the key
trees); wording mirrors the tone of `modules/extensions/locales/*.json`."

No TypeScript interface snippet is given for this task in the plan; translate key-for-key from `en-US.json`
(as delivered by `FEATURE-NOTIFICATIONS-ADMIN-PAGE`), keeping placeholder syntax (e.g. `{count}`, `{title}`)
identical across every locale.

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`) and plan
  (`docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-7 section) in full before making any
  code changes.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
