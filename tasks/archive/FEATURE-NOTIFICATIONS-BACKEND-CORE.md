# Task: Notifications module domain and storage

ID: FEATURE-NOTIFICATIONS-BACKEND-CORE
Type: feature
Scope: backend
Size: medium
Parent: EPIC-NOTIFICATIONS-MODULE
Status: done

## 1. Business goal

In order to let any backend module or plugin raise and clear a notification without building its own
storage, upsert or delivery logic,
As a Smart Panel backend developer,
I want a core `NotificationsService` with a persisted lifecycle (insert, upsert, resolve, boot cleanup,
retention, rate guard) that every emitter and the later REST, websocket and dispatch layers build on.

## 2. Context

- This is task N-1, the foundation task of the epic; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Full design: `docs/superpowers/specs/2026-09-02-notifications-module-design.md` - read the "Concepts",
  "Lifecycle", "Validation rules in `notify()`" and "Rate guard and caps" sections closely.
- Full implementation plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-1 section.
- The module is `@Global()` and exports `NotificationsService`, the same way `ExtensionsModule` exports
  `ExtensionActionRegistryService` (`apps/backend/src/modules/extensions/services/extension-action-registry.service.ts`) -
  emitters inject `NotificationsService` without adding `NotificationsModule` to their own `imports`, so no
  `forwardRef` is introduced.
- Config follows the existing `ModuleConfigModel` + `ModulesTypeMapperService.registerMapping` pattern used
  by other core modules, and is read and updated through the existing `GET/PATCH /config/module/:type`
  endpoints.
- Extension metadata is registered with `ExtensionsService.registerModuleMetadata`, and `notifications-module`
  is added to `NON_TOGGLEABLE_MODULES` in `apps/backend/src/modules/extensions/extensions.constants.ts`.
- Migration policy (see `CLAUDE.md`): always create an incremental migration file; never modify the initial
  migration - alpha installations have already run it.
- Boot safety: CI and `generate:openapi` boot the app against an unmigrated database, so
  `NotificationsRetentionService`'s `onApplicationBootstrap` cleanup must run inside `try/catch` and log on
  failure rather than throw.

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/886 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- `NotificationsModule` (`@Global()`), `notifications.constants.ts`, `notifications.openapi.ts`,
  `notifications.exceptions.ts`.
- `NotificationEntity` (`notifications_module_notifications` table) with the full column set from the spec's
  Notification table (`id`, `source`, `kind`, `key`, `severity`, `title`, `message`, `actions`, `data`,
  `persistent`, `occurrences`, `read_at`, `dismissed_at`, `resolved_at`, `created_at`, `updated_at`).
- `NotificationActionModel`, a discriminated Swagger model for the `link` / `extension_action` / `service`
  action variants.
- `NotificationsConfigModel` / `UpdateNotificationsConfigDto` with `retention_days` (1-365, default 30) and
  `max_notifications` (50-5000, default 500), registered through `ModulesTypeMapperService.registerMapping`.
- `NotificationsService` with `notify`, `resolve`, `resolveAll`, `findAll`, `findOne`, `markRead`, `dismiss`,
  `remove`, `countUnread`.
- Input validation and truncation, the per-source rate guard, and the `EventType.NOTIFICATION_CREATED` /
  `_UPDATED` / `_DELETED` event emissions (consumed later by N-2's websocket bridge and N-3's dispatcher).
- `NotificationsRetentionService` with boot cleanup (`onApplicationBootstrap`), the daily cron prune, and cap
  enforcement.
- Migration `1000000000025-AddNotifications.ts` creating the table, the partial unique index and the three
  supporting indexes.
- Registering the module in `app.module.ts` and marking `notifications-module` non-toggleable.

**Out of scope**

- REST controller, DTOs, response models and websocket bridge (`FEATURE-NOTIFICATIONS-BACKEND-API`).
- Channel registry and dispatcher (`FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH`).
- Any emitter wiring into other backend modules (`FEATURE-NOTIFICATIONS-EMITTERS-CORE`,
  `FEATURE-NOTIFICATIONS-EMITTERS-INTEGRATIONS`).
- Admin UI of any kind.

## 4. Acceptance criteria

- [x] `notify()` on an `event` without `key` inserts a new row with `occurrences = 1` and `read_at`,
      `dismissed_at`, `resolved_at` all `null`.
- [x] `notify()` on an `event` with `key` upserts an existing active row: same `id`, `occurrences`
      incremented, `title`/`message`/`severity`/`actions`/`data` replaced, `read_at` and `dismissed_at`
      cleared.
- [x] `notify()` on an `issue` upserts an existing active row: same `id`, `occurrences` incremented, fields
      replaced, `read_at` and `dismissed_at` preserved (not cleared).
- [x] `dismiss(id, true)` on an `issue` with `persistent = true` also sets `resolved_at` (nothing re-detects
      such a condition, so the dismissal is how it ends); `dismiss(id, true)` on a non-persistent `issue` or
      on an `event` sets only `dismissed_at`.
- [x] `dismiss(id, false)` on a persistent `issue` that was resolved by its own dismissal clears
      `dismissed_at` but leaves `resolved_at` in place, so the row stays in history.
- [x] `notify()` on an `issue` without `key` returns `null` and logs one `warn`.
- [x] `resolve(source, key)` on an unkeyed `event` row returns `false` and is a no-op.
- [x] `resolve(source, key)` sets `resolved_at`, and the next `notify()` with the same `(source, key)` inserts
      a fresh row (permitted by the partial unique index).
- [x] `resolveAll(source)` resolves every active keyed row for that source and returns the count resolved.
- [x] `title` and `message` are truncated to 120 and 1000 characters respectively rather than rejected.
- [x] A fourth action beyond the first three is dropped, not rejected.
- [x] A `link` action with a disallowed URL scheme (e.g. `javascript:`) is rejected: `notify()` logs a `warn`
      and returns `null`.
- [x] `data` above 4096 serialized bytes, or `data` that is not a flat
      `Record<string, string | number | boolean | null>`, is rejected: `notify()` logs a `warn` and returns
      `null`.
- [x] An unknown `severity` value is rejected: `notify()` logs a `warn` and returns `null`.
- [x] The rate guard drops the 61st `notify()` call from one `source` within a rolling minute, logging one
      `warn` per source per minute; a different source is unaffected; the window resets after a minute.
- [x] A database failure inside `notify()` is caught, logged, and `notify()` returns `null` rather than
      throwing.
- [x] `notify()` emits `EventType.NOTIFICATION_CREATED` with `{ id, kind, severity, source }` on insert and
      `EventType.NOTIFICATION_UPDATED` on upsert.
- [x] `markRead`, `dismiss` and `resolve` emit `EventType.NOTIFICATION_UPDATED`; `remove` emits
      `EventType.NOTIFICATION_DELETED` with `{ id }`.
- [x] `findAll` defaults to `status: 'active'`, supports the `unread` filter, orders rows by the total order
      `created_at DESC, id DESC`, supports the `afterId` cursor (returns the rows that follow the row with
      that id in the total order, so two rows with equal `created_at` are disambiguated by `id`), and caps
      `limit` at 201: `FEATURE-NOTIFICATIONS-BACKEND-API`'s controller requests `limit + 1` rows so its
      `has_more` flag survives the maximum page size; the client-facing maximum stays 200, enforced by that
      controller.
- [x] `NotificationsRetentionService` captures `bootStartedAt` in its constructor and, in
      `onApplicationBootstrap` wrapped in `try/catch`, resolves every `issue` with `persistent = false` and
      `updated_at < bootStartedAt`, logging and continuing on failure.
- [x] The daily cron (`15 3 * * *`) prunes by kind: `event` rows once at least one of `dismissed_at` /
      `resolved_at` is set and the later of them is older than the configured `retention_days`; `issue` rows
      only when `resolved_at` is set and the later of `resolved_at` and `dismissed_at` is older than
      `retention_days` (a dismissed but unresolved issue is kept, because the dismissal must keep hiding the
      source's re-raises).
- [x] The daily cron enforces `max_notifications` on active `event` rows only, evicting the oldest read
      events first, then the oldest unread events; `issue` rows are never evicted by the cap.
- [x] Retention test: an old dismissed-but-unresolved issue survives the prune.
- [x] Retention test: an old dismissed `event` is deleted.
- [x] Retention test: an old resolved `issue` is deleted.
- [x] Retention test: a resolved-then-dismissed `issue` counts from the later of the two timestamps.
- [x] Migration `1000000000025-AddNotifications.ts` creates `notifications_module_notifications` with all
      spec columns, the partial unique index `IDX_notifications_source_key_active` on `(source, key)` where
      `key IS NOT NULL AND resolved_at IS NULL`, and indexes `IDX_notifications_created_at`,
      `IDX_notifications_dismissed_at`, `IDX_notifications_resolved_at`; `down` drops the table.
- [x] `notifications-module` is added to `NON_TOGGLEABLE_MODULES` in
      `apps/backend/src/modules/extensions/extensions.constants.ts` and registered with
      `ExtensionsService.registerModuleMetadata`.
- [x] `cd apps/backend && npx jest src/modules/notifications` passes.
- [x] `FB_DB_PATH=$(mktemp -d) pnpm run generate:openapi` exits 0 against a fresh, unmigrated database.

## 6. Technical constraints

- Depends on: none (first task in the epic).
- Never edit generated files (`spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`,
  `apps/panel/lib/api/`); this task does not need to regenerate them but must not touch them by hand.
- Tabs, single quotes, semicolons, trailing commas; print width 120; external imports first, then `../`, then
  `./`, with a blank line between groups.
- Every action has `@ApiOperation` with `tags`, `summary`, `description`, `operationId`; schema names
  `NotificationsModuleData*` / `NotificationsModuleRes*` / `NotificationsModuleReq*` /
  `NotificationsModule<Action><Entity>`.
- `lint:api` requires every data model's `@ApiSchema` name to contain `Data` unless the name contains `Res`
  or `Req` or the file is under `/dto/`.
- Bootstrap hooks that touch the database run inside `try/catch`; verify with
  `FB_DB_PATH=$(mktemp -d) pnpm run generate:openapi` (must exit 0).
- New migration file only: `apps/backend/src/migrations/1000000000025-AddNotifications.ts`; never modify the
  initial migration.
- No secrets in notification `title`, `message` or `data`.
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `feat(backend): add notifications module domain and storage`
- Suggested worker tier: implementer opus / high, reviewer opus / medium.

## 7. Implementation hints

Copy verbatim from the plan's Task N-1 "Interfaces (produces)" block:

```ts
// notifications.constants.ts
export const NOTIFICATIONS_MODULE_PREFIX = 'notifications';
export const NOTIFICATIONS_MODULE_NAME = 'notifications-module';
export const NOTIFICATIONS_MODULE_API_TAG_NAME = 'Notifications module';
export enum EventType {
	NOTIFICATION_CREATED = 'NotificationsModule.Notification.Created',
	NOTIFICATION_UPDATED = 'NotificationsModule.Notification.Updated',
	NOTIFICATION_DELETED = 'NotificationsModule.Notification.Deleted',
}
export enum NotificationKind { EVENT = 'event', ISSUE = 'issue' }
export enum NotificationSeverity { INFO = 'info', WARNING = 'warning', ERROR = 'error', CRITICAL = 'critical' }
export const SEVERITY_RANK: Record<NotificationSeverity, number> = { info: 0, warning: 1, error: 2, critical: 3 };
export enum NotificationActionType { LINK = 'link', EXTENSION_ACTION = 'extension_action', SERVICE = 'service' }
export const NOTIFICATION_TITLE_MAX_LENGTH = 120;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 1000;
export const NOTIFICATION_ACTIONS_MAX = 3;
export const NOTIFICATION_DATA_MAX_BYTES = 4096;
export const NOTIFICATION_RATE_LIMIT_PER_MINUTE = 60;
export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_MAX_NOTIFICATIONS = 500;

// services/notifications.service.ts
export interface CreateNotificationInput {
	source: string;
	kind: NotificationKind;
	key?: string;
	severity: NotificationSeverity;
	title: string;
	message?: string;
	actions?: NotificationActionInput[];
	data?: Record<string, string | number | boolean | null>;
	persistent?: boolean;
}
export interface NotificationsFilter {
	status?: 'active' | 'dismissed' | 'resolved' | 'all';   // default 'active'
	severity?: NotificationSeverity[];
	source?: string;
	kind?: NotificationKind;
	unread?: boolean;
	afterId?: string;
	limit?: number;                                          // default 50, max 200
}
export class NotificationsService {
	notify(input: CreateNotificationInput): Promise<NotificationEntity | null>;
	resolve(source: string, key: string): Promise<boolean>;
	resolveAll(source: string): Promise<number>;
	findAll(filter: NotificationsFilter): Promise<NotificationEntity[]>;
	findOne(id: string): Promise<NotificationEntity | null>;
	markRead(id: string, read: boolean): Promise<NotificationEntity>;      // throws NotificationsNotFoundException
	dismiss(id: string, dismissed: boolean): Promise<NotificationEntity>;
	remove(id: string): Promise<void>;
	countUnread(): Promise<number>;
}
```

The entity `NotificationEntity` (`@Entity('notifications_module_notifications')`,
`@ApiSchema({ name: 'NotificationsModuleDataNotification' })`) carries the columns from the spec table with
snake_case wire names through `@Expose({ name })` and `@ApiProperty({ name })`, `actions` and `data` as
`simple-json`, and the partial unique index declared both in the entity
(`@Index('IDX_notifications_source_key_active', ['source', 'key'], { unique: true, where: '"key" IS NOT NULL AND "resolved_at" IS NULL' })`)
and in the migration. `NotificationActionModel` is a discriminated Swagger model
(`NotificationsModuleDataNotificationAction`) with `type`, `label`, `primary`, and the optional fields of the
three variants.

`NotificationsConfigModel` (`NotificationsModuleDataConfig`) extends `ModuleConfigModel` with
`retention_days` (int, 1-365, default 30) and `max_notifications` (int, 50-5000, default 500);
`UpdateNotificationsConfigDto` (`NotificationsModuleUpdateConfig`) mirrors it; both registered through
`ModulesTypeMapperService.registerMapping` in `onModuleInit`, together with `swaggerRegistry.register` for
every model in `NOTIFICATIONS_SWAGGER_EXTRA_MODELS` and `extensionsService.registerModuleMetadata`.

Retention service: `bootStartedAt` captured in the constructor; `onApplicationBootstrap` resolves issues with
`persistent = false` and `updated_at < bootStartedAt`, wrapped in `try/catch` that logs and continues.
`@Cron('15 3 * * *')` prunes by kind: `event` rows once at least one of `dismissed_at` / `resolved_at` is set
and the later of them is older than `retention_days`; `issue` rows only when `resolved_at` is set and the
later of `resolved_at` and `dismissed_at` is older than `retention_days` (a dismissed but unresolved issue is
kept). Then it enforces `max_notifications` on active events (oldest read first, then oldest unread), reading
both values through `ConfigService.getModuleConfig(NOTIFICATIONS_MODULE_NAME)`. Issues are never evicted by
the cap. Tests: an old dismissed-unresolved issue survives; an old dismissed event is deleted; an old resolved
issue is deleted; a resolved-then-dismissed issue counts from the later timestamp.

Verify the migration with a fresh database:
`cd apps/backend && FB_DB_PATH=$(mktemp -d) pnpm run typeorm:migration:run`.

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`) and plan
  (`docs/superpowers/plans/2026-09-02-notifications-module.md`) in full before making any code changes,
  focusing on the Concepts, Lifecycle and Task N-1 sections.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
