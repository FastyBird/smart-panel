# Task: Admin notifications page and CTA execution

ID: FEATURE-NOTIFICATIONS-ADMIN-PAGE
Type: feature
Scope: admin
Size: medium
Parent: EPIC-NOTIFICATIONS-MODULE
Status: planned

## 1. Business goal

In order to review, filter, bulk-manage and act on every notification, not just the most recent ones in the
bell,
As a Smart Panel administrator,
I want a `/notifications` page with filters, bulk actions, a detail drawer, and the ability to execute any of
the three CTA types directly.

## 2. Context

- This is task N-6; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Depends on `FEATURE-NOTIFICATIONS-ADMIN-BELL` (N-5) for the store, constants and bell.
- Spec: `docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "Admin surface" section (Page
  bullet) and "Actions" section (the three CTA types).
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-6 section.
- CTA execution reuses existing composables: `useActions().executeAction(extension_type, action_id, params)`
  (`apps/admin/src/modules/extensions/composables/useActions.ts:136`, which already shows the
  dangerous-action confirmation dialog, from `FEATURE-EXTENSION-ACTIONS-MVP`) and
  `useServiceActions().restartService | startService | stopService(extension_kind, extension_type,
  service_id)` (`apps/admin/src/modules/extensions/composables/useServiceActions.ts:9-11`, calling the same
  endpoints as `apps/backend/src/modules/extensions/controllers/services.controller.ts`).
- Filter persistence pattern: `useListQuery`, as used elsewhere in the admin for query-string-synced filters.
- Config form pattern: the module config element registered with `CONFIG_MODULE_MODULE_TYPE`, as other
  modules' settings forms do.

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/891 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- `router/index.ts` with the `notifications` route (`RouteNames.NOTIFICATIONS`, roles admin and owner, menu
  entry).
- `views/view-notifications.vue`, `components/list-notifications.vue`, `components/notifications-filter.vue`,
  `components/notification-detail-drawer.vue`, `components/notification-actions.vue`,
  `components/notifications-config-form.vue`.
- `composables/useNotificationAction.ts` (executes the three CTA types) and
  `composables/useNotificationsDataSource.ts`.
- `schemas/config.schemas.ts`, `schemas/list.schemas.ts`.
- Wiring the route and the module config element into `notifications.module.ts`.
- Updating `notification-popover.vue` (from `FEATURE-NOTIFICATIONS-ADMIN-BELL`) to use
  `useNotificationAction` for its primary button.

**Out of scope**

- The bell, store and sockets handler (already built in `FEATURE-NOTIFICATIONS-ADMIN-BELL`).
- Non-English locales (`FEATURE-NOTIFICATIONS-ADMIN-LOCALES`).
- Any channel plugin config form.

## 4. Acceptance criteria

- [ ] `useNotificationAction().execute(notification, action)` routes a `link` action to `router.push(url)`
      when relative, or `window.open(url, '_blank', 'noopener')` when an absolute `http(s)` URL.
- [ ] `useNotificationAction().execute` routes an `extension_action` to
      `useActions().executeAction(extension_type, action_id, params)` from
      `modules/extensions/composables/useActions.ts:136`, which already applies the dangerous-action
      confirmation.
- [ ] `useNotificationAction().execute` routes a `service` action to `useServiceActions().restartService |
      startService | stopService(extension_kind, extension_type, service_id)` from
      `modules/extensions/composables/useServiceActions.ts:9-11`, confirming first via `ElMessageBox.confirm`
      for `stop` and `restart`.
- [ ] `useNotificationAction` exposes `isExecuting` for a loading state.
- [ ] The route is registered as `{ path: 'notifications', name: RouteNames.NOTIFICATIONS, meta: { guards: {
      authenticated: true, roles: [admin, owner] }, title, icon: 'mdi:bell-outline', menu: 500 } }`.
- [ ] The filter bar offers status (select), severity (multi-select), source (built from loaded rows) and an
      unread toggle, synced to the query string through `useListQuery` and `NotificationsFilterSchema`;
      filters are applied server-side through `store.fetch`, never filtered locally.
- [ ] `useNotificationsDataSource` forwards the active filters to `store.fetch` and calls it with
      `append: false` whenever a filter changes, so the list is rebuilt from the first page.
- [ ] The table has a selection column, severity tag, title, source, occurrences, relative time and an
      actions column, styled like the existing logs table.
- [ ] The bulk bar offers mark read, mark unread, dismiss and delete; delete asks for confirmation before
      calling the bulk-remove endpoint.
- [ ] "Load more" appears and works when `hasMore` is true, using `next_cursor`.
- [ ] Clicking a row opens `notification-detail-drawer.vue` showing the message with preserved newlines, the
      `data` key/value table, all of the notification's actions rendered via `notification-actions.vue`, the
      lifecycle timestamps, and delete/dismiss buttons.
- [ ] `notifications-config-form.vue` exposes `retention_days` and `max_notifications` through the module
      config element, validating their ranges (1-365 and 50-5000 respectively).
- [ ] `useNotificationAction.spec.ts` proves each action type is routed to the correct mocked collaborator.
- [ ] A test proves the filter schema round-trips correctly through the query string.
- [ ] A test proves the config form rejects out-of-range values.
- [ ] `cd apps/admin && npx vitest run src/modules/notifications` passes.
- [ ] `pnpm --filter ./apps/admin run type-check && pnpm --filter ./apps/admin run lint:js` passes.
- [ ] Manual: on the dev stack, triggering a failed login shows the bell count rising and the row appearing
      on the page without a reload.

## 6. Technical constraints

- Depends on: N-5 / FEATURE-NOTIFICATIONS-ADMIN-BELL.
- Tabs, single quotes, semicolons, trailing commas; print width 150; import ordering as elsewhere.
- Confirmation and the request itself belong in separate `try` blocks for every destructive action (delete,
  bulk delete, service stop/restart).
- Reuse the existing extension-action and managed-service composables rather than building new execution
  paths.
- Never hand-edit generated files.
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `feat(admin): add the notifications page with bulk actions and CTAs`
- Suggested worker tier: implementer sonnet / high, reviewer sonnet / medium.

## 7. Implementation hints

Copy verbatim from the plan's Task N-6 "Interfaces" block:

```ts
export function useNotificationAction(): {
	execute(notification: INotification, action: INotificationAction): Promise<void>;
	isExecuting: Ref<boolean>;
}
// link: relative -> router.push(url); absolute http(s) -> window.open(url, '_blank', 'noopener')
// extension_action: `useActions().executeAction(extension_type, action_id, params)` from `modules/extensions/composables/useActions.ts:136`; the action's `dangerous` confirmation lives there already
// service: `useServiceActions().restartService | startService | stopService(extension_kind, extension_type, service_id)` from `modules/extensions/composables/useServiceActions.ts:9-11`, preceded by `ElMessageBox.confirm` for stop and restart
```

Route: `{ path: 'notifications', name: RouteNames.NOTIFICATIONS, meta: { guards: { authenticated: true, roles: [admin, owner] }, title, icon: 'mdi:bell-outline', menu: 500 } }`.

Page: filter bar (status select, severity multi-select, source select built from loaded rows, unread switch)
synced through `useListQuery` with `NotificationsFilterSchema`; `useNotificationsDataSource` forwards the
filters to `store.fetch` (server-side filtering) and calls it with `append: false` whenever a filter changes,
so `listIds` is rebuilt from the first page; table with selection column, severity tag, title, source,
occurrences, relative time, actions column; bulk bar with mark read, mark unread, dismiss, delete (delete
confirms first); "Load more" through `next_cursor`; row click opens the drawer (message with preserved
newlines, `data` key/value table, all actions via `notification-actions.vue`, lifecycle timestamps, delete
and dismiss buttons).

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "Actions" and "Admin
  surface" sections) and plan (`docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-6 section)
  in full before making any code changes.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
