# Task: Admin notifications store and bell

ID: FEATURE-NOTIFICATIONS-ADMIN-BELL
Type: feature
Scope: admin
Size: medium
Parent: EPIC-NOTIFICATIONS-MODULE
Status: planned

## 1. Business goal

In order to see notifications live in the admin interface without opening a dedicated page,
As a Smart Panel administrator,
I want a bell icon in the top bar with an unread badge, a popover of recent active notifications, and toasts
for new errors and critical items.

## 2. Context

- This is task N-5; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Depends on `FEATURE-NOTIFICATIONS-BACKEND-API` (N-2) for the generated REST/websocket types.
- Spec: `docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "Admin surface" section (Bell,
  Toasts, Live updates bullets).
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-5 section.
- Store pattern to mirror: the devices store's mutation-token ordering (`commit/forget`, `requestedAt`
  captured before the request), referenced directly in the plan.
- Existing ad-hoc notification being replaced:
  `apps/admin/src/modules/system/components/system-info/update-notification-badge.vue`, mounted in
  `apps/admin/src/common/components/app-top-bar.vue:22`; `useUpdateStatus` stays (still used by the update
  page) but the badge component and its export in `components.ts` are deleted.
- `apps/admin/src/common/layouts/layout-default.vue` mounts the bell in the mobile layout's right slot.
- `apps/admin/src/openapi.constants.ts` is manually maintained (see `CLAUDE.md` "Generated Code" note) and
  needs new aliases for the generated notification schemas.

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/890 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- `notifications.module.ts`, `notifications.constants.ts` (prefix, event prefix, `EventType`, `RouteNames`,
  `SEVERITY_RANK`).
- `store/notifications.store.ts` and `store/notifications.store.schemas.ts` bound to the generated
  `NotificationsModuleDataNotification` type.
- `composables/useNotifications.ts`, `composables/useNotificationsActions.ts` (read/dismiss/remove/bulk,
  confirmation and request in separate `try` blocks).
- `components/notification-bell.vue`, `notification-popover.vue`, `notification-item.vue`,
  `notification-severity-tag.vue`.
- `locales/en-US.json` (other locales copy it for now; translated in `FEATURE-NOTIFICATIONS-ADMIN-LOCALES`).
- Module install: locale merge, store registration, empty route array (routes land in
  `FEATURE-NOTIFICATIONS-ADMIN-PAGE`), `dataRefreshRegistry` registration, sockets handler for
  `Created`/`Updated`/`Deleted`.
- Mounting the bell in `app-top-bar.vue` and `layout-default.vue`; removing `update-notification-badge.vue`
  and its references.
- Aliases in `apps/admin/src/openapi.constants.ts`.

**Out of scope**

- The `/notifications` page, filters, bulk bar, detail drawer, CTA execution
  (`FEATURE-NOTIFICATIONS-ADMIN-PAGE`).
- Non-English locales (`FEATURE-NOTIFICATIONS-ADMIN-LOCALES`).
- Any channel plugin admin UI.

## 4. Acceptance criteria

- [ ] The store exposes `fetch({ status?, severity?, source?, kind?, unread?, afterId?, append? })`,
      `get({ id })`, `set({ id, data })`, `unset({ id })`, `onEvent({ id, data })`, `markRead`, `dismiss`,
      `remove`, `bulkUpdate`, `bulkRemove`, `isLoaded()`, `refresh()`; `fetch` forwards `status`, `severity`,
      `source`, `kind` and `unread` as query parameters to the API and never filters `items` locally.
- [ ] The store exposes getters `findAll`, `findById`, `active` (`dismissedAt === null && resolvedAt ===
      null`), `unreadCount`, `highestActiveSeverity`, `hasMore`, `nextCursor`.
- [ ] The store keeps every fetched row in `items` by id, plus a separate `listIds` (the ordered ids of the
      current query), `hasMore` and `nextCursor` for that query.
- [ ] Schemas bind the response type to the generated `NotificationsModuleDataNotification` interface and use
      `z.nativeEnum` for the severity/kind enums, per the config-contract convention.
- [ ] The store applies the same mutation-token ordering as `devices.store.ts` (`requestedAt` captured before
      the request; a stale response is discarded).
- [ ] `fetch` with `append: true` merges the new page into `items` by id and appends the page's ids to
      `listIds`; `append: false` (the default) resets `listIds` before applying the first page.
- [ ] The sockets handler calls `store.get({ id })` on `Created` and `Updated`, and `store.unset({ id })` on
      `Deleted`.
- [ ] On a `Created` pointer with severity `error` or `critical`, after the row is fetched,
      `useFlashMessage().error(title)` is shown; `warning` and `info` only update the badge/store.
- [ ] `dataRefreshRegistry` is registered so the active list is re-fetched on reconnect.
- [ ] `notification-bell.vue` shows an `el-badge` with `:value="unreadCount"` hidden when `unreadCount === 0`,
      and switches its icon to the danger colour when `highestActiveSeverity` is `error` or `critical`.
- [ ] Clicking the bell opens `notification-popover.vue` showing up to 8 active notifications sorted by
      severity rank then `createdAt` descending; opening the popover does not mark anything read.
- [ ] Each popover item shows a severity tag, title, source, relative time (via `formatTimeAgo` from
      `@vueuse/core`, as in `system-logs-table.vue:155`), an occurrence badge when `occurrences > 1`, a
      primary action button, and a dismiss control; clicking a row marks it read.
- [ ] The popover footer offers "Mark all as read" (through `bulkUpdate`) and "View all" (routes to
      `RouteNames.NOTIFICATIONS`).
- [ ] `update-notification-badge.vue` and its export in `components.ts` are deleted; `useUpdateStatus` is
      kept because the update page still uses it; the bell is mounted in `app-top-bar.vue` in its place and
      in `layout-default.vue`'s mobile right slot.
- [ ] `apps/admin/src/openapi.constants.ts` gains the notification, action, severity/kind enum, bulk request
      and config schema aliases.
- [ ] Store spec covers `set`/`unset`/`onEvent` parsing and validation, `fetch` append-merge by id, the
      ordering token skipping a stale response, `unreadCount` and `highestActiveSeverity`.
- [ ] `notification-bell.spec.ts` proves the badge is hidden at zero unread and shows the count otherwise.
- [ ] `useNotificationsActions.spec.ts` proves `dismiss` keeps the confirmation and the request in separate
      `try` blocks.
- [ ] `pnpm run generate:openapi` is run first, then `cd apps/admin && npx vitest run src/modules/notifications`
      passes.
- [ ] `pnpm --filter ./apps/admin run type-check` passes with no dangling references to the deleted badge
      component.
- [ ] `pnpm --filter ./apps/admin run lint:js` stays at the documented baseline (0 errors).

## 6. Technical constraints

- Depends on: N-2 / FEATURE-NOTIFICATIONS-BACKEND-API.
- Tabs, single quotes, semicolons, trailing commas; print width 150 (admin); import ordering as elsewhere.
- Admin tests use `@vue/test-utils`, not `@testing-library/vue`; isolated runs use `npx vitest run <path>`
  from `apps/admin` (the CLI filter flag is a no-op).
- Confirmation and the request itself belong in separate `try` blocks (see `useNotificationsActions`).
- Never hand-edit generated files; only consume the regenerated `apps/admin/src/openapi.ts`.
- Prettier is scoped to touched files (the baseline has pre-existing failures elsewhere).
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `feat(admin): add the notifications bell and live store`
- Suggested worker tier: implementer sonnet / high, reviewer sonnet / medium.

## 7. Implementation hints

Copy verbatim from the plan's Task N-5 "Interfaces" block:

```ts
// notifications.constants.ts
export const NOTIFICATIONS_MODULE_PREFIX = 'notifications';
export const NOTIFICATIONS_MODULE_NAME = 'notifications-module';
export const NOTIFICATIONS_MODULE_EVENT_PREFIX = 'NotificationsModule.';
export enum EventType {
	NOTIFICATION_CREATED = 'NotificationsModule.Notification.Created',
	NOTIFICATION_UPDATED = 'NotificationsModule.Notification.Updated',
	NOTIFICATION_DELETED = 'NotificationsModule.Notification.Deleted',
}
export enum RouteNames { NOTIFICATIONS = 'notifications_module-notifications' }
export const SEVERITY_RANK: Record<NotificationsModuleNotificationSeverity, number>;

// store/notifications.store.ts (defineStore('notifications_module-notifications'))
interface NotificationsStoreActions {
	fetch(payload?: {
		status?: 'active' | 'dismissed' | 'resolved' | 'all';
		severity?: NotificationsModuleNotificationSeverity[];
		source?: string;
		kind?: NotificationsModuleNotificationKind;
		unread?: boolean;
		afterId?: string;
		append?: boolean;   // false (default) resets listIds before applying the page; true appends the page
	}): Promise<INotification[]>;   // filters are sent as query parameters, never applied locally
	get(payload: { id: string }): Promise<INotification>;
	set(payload: { id: string; data: Partial<INotification> }): INotification;
	unset(payload: { id: string }): void;
	onEvent(payload: { id: string; data: Record<string, unknown> }): INotification;
	markRead(payload: { id: string; read: boolean }): Promise<INotification>;   // PATCH
	dismiss(payload: { id: string; dismissed: boolean }): Promise<INotification>;
	remove(payload: { id: string }): Promise<void>;
	bulkUpdate(payload: { ids: string[]; read?: boolean; dismissed?: boolean }): Promise<IBulkResult>;
	bulkRemove(payload: { ids: string[] }): Promise<IBulkResult>;
	isLoaded(): boolean; refresh(): Promise<void>;
}
// state: items by id (every row ever fetched), listIds (ordered ids of the current query), hasMore, nextCursor
// getters: findAll, findById, active (dismissedAt === null && resolvedAt === null), unreadCount, highestActiveSeverity, hasMore, nextCursor
```

Schemas bind the response schema to the generated interface (`ZodType<NotificationsModuleNotificationSchema>`)
and use `z.nativeEnum` over the generated enums, per the config-contract convention. The store applies the
mutation-token ordering of `devices.store.ts` (`commit/forget`, `requestedAt` captured before the request).

Module install (`notifications.module.ts`): merge `notificationsModule` locale; register and provide the
store; register routes on `AppRouteNames.ROOT` (route file delivered later, so this task registers an empty
array); `dataRefreshRegistry.register`; sockets handler: on `Created`/`Updated` call `store.get({ id })` and,
for `Created` with severity `error` or `critical`, `flashMessage.error(title)` after the row arrives; on
`Deleted` call `unset`.

Bell: `notification-bell.vue` uses `el-badge` (`:value="unreadCount" :hidden="unreadCount === 0"`) around an
`mdi:bell-outline` icon that switches to `mdi:bell-alert` in the danger colour when `highestActiveSeverity`
is `error` or `critical`; `el-popover` shows `notification-popover.vue` (top 8 active by severity rank then
`createdAt` desc, "Mark all as read" through `bulkUpdate`, "View all" routes to `RouteNames.NOTIFICATIONS`).
Each item: severity tag, title, source, relative time, occurrences badge when above 1 (relative time through
`formatTimeAgo` from `@vueuse/core`, as in `system-logs-table.vue:155`), primary action button (delegates to
`useNotificationAction` from `FEATURE-NOTIFICATIONS-ADMIN-PAGE`; in this task it emits `action` and the
popover routes to the page), dismiss icon.

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "Admin surface" section)
  and plan (`docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-5 section) in full before
  making any code changes.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
