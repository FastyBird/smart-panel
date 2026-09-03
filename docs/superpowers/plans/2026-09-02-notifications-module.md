# System Notifications Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a core `notifications` module (persistence, REST, websocket, channel dispatch), an admin bell and
notifications page, the first emitters, and four channel plugins, delivered as a stack of small PRs.

**Architecture:** One `@Global()` NestJS module owns the `notifications_module_notifications` table and a
`NotificationsService` that emitters inject directly. Channel plugins register an `INotificationChannel`
with a core registry; a dispatcher applies filter, timeout, retry and loop guard. The admin module mirrors
the devices store pattern (thin websocket pointers, guarded refetch) and executes CTAs through the existing
extension-action and managed-service composables.

**Tech Stack:** NestJS 11, TypeORM (SQLite), `@nestjs/event-emitter`, socket.io, Swagger; Vue 3, Pinia,
Element Plus, Zod, openapi-fetch, Vitest; global `fetch` for channels. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-02-notifications-module-design.md`

**Tracking:** epic https://github.com/FastyBird/smart-panel/issues/885, milestone "Notifications module"; every PR body carries `Closes #<task issue>`.

## Global Constraints

- Never edit generated files: `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/`.
  Change Swagger sources and run `pnpm run generate:openapi` to validate; all three outputs are gitignored and
  regenerated in CI, so nothing generated is committed.
- Tabs, single quotes, semicolons, trailing commas; print width 120 (backend) and 150 (admin); external
  imports first, then `../`, then `./`, blank line between groups.
- Swagger decorators before NestJS decorators; every action has `@ApiOperation` with `tags`, `summary`,
  `description`, `operationId`; responses wrapped in `*ResponseModel`; schema names
  `NotificationsModuleData*`, `NotificationsModuleRes*`, `NotificationsModuleReq*`, `NotificationsModule<Action><Entity>`.
- Every route `@Roles(UserRole.OWNER, UserRole.ADMIN)`.
- Bootstrap hooks that touch the database run inside `try/catch`; reproduce CI with
  `FB_DB_PATH=$(mktemp -d) pnpm run generate:openapi` (must exit 0).
- New migration `apps/backend/src/migrations/1000000000025-AddNotifications.ts`; never touch the initial one.
- Backend CI lint is three scripts: `lint:js`, `lint:api`, `lint:openapi`. `lint:api` requires data models'
  `@ApiSchema` names to contain `Data` unless the name contains `Res` or `Req` or the file is under `/dto/`.
- Admin isolated test runs use `npx vitest run <path>` from `apps/admin` (the filter flag is a no-op); the
  type check is `pnpm --filter ./apps/admin run type-check`; prettier is scoped to touched files. Admin tests
  use `@vue/test-utils`, not `@testing-library/vue`.
- PR titles `<type>(<scope>): <subject>` with a lowercase subject, ≤ 100 characters; never push to `main`.
- Bulk endpoints are one request through `runBulkOperation` with `safeErrors` declared; confirmation and
  work in separate `try` blocks in the admin.
- No secrets in notification `title`, `message` or `data`; channel secrets through `secretFields`.

---

## Delivery and delegation map

Effort is the worker's reasoning-effort setting. Every task gets a spec-compliance review and a code-quality
review from a fresh reviewer before its PR opens; the reviewer tier is listed next to the implementer.

| Task | Issue | Outcome | Depends on | Implementer model / effort | Reviewer model / effort | File ownership | PR title |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N-1 | #886 | Module skeleton, entity, migration, config, `NotificationsService`, retention, unit tests | none | **opus / high** | opus / medium | `apps/backend/src/modules/notifications/**` except `controllers/`, `platforms/`; `app.module.ts`; `extensions.constants.ts` (`NON_TOGGLEABLE_MODULES`); new migration | `feat(backend): add notifications module domain and storage` |
| N-2 | #887 | REST controller, DTOs, response models, websocket pointer events, gateway prefix, regenerated spec and panel client, e2e | N-1 | sonnet / medium | sonnet / medium | `modules/notifications/controllers/**`, `dto/**`, `models/*response*`, `websocket.gateway.ts` prefix list, `spec/`, `apps/panel/lib/api/` (generated), `apps/backend/test/notifications.e2e-spec.ts` | `feat(backend): expose notifications over REST and websocket` |
| N-3 | #888 | Channel platform interface, base class, registry, dispatcher with retry, timeout, loop guard and delivery-failed self-report | N-1 | sonnet / high | opus / medium | `modules/notifications/platforms/**`, `services/notification-channel-registry.service.ts`, `services/notification-dispatcher.service.ts` | `feat(backend): dispatch notifications to channel plugins` |
| N-4 | #889 | Emitters batch 1: update available and failed, managed service error, failed login (backend only) | N-3 | sonnet / high | sonnet / medium | `modules/system/services/update.service.ts`, `update-executor.service.ts`, `modules/extensions/services/managed-service-manager.service.ts`, `modules/auth/services/auth.service.ts`, `modules/auth/controllers/auth.controller.ts` | `feat(backend): raise notifications for updates, service failures and failed logins` |
| N-5 | #890 | Admin foundation: constants, schemas bound to generated types, store with ordering tokens, module install, sockets handler, bell and popover, toasts, en-US locale; remove the update badge | N-2 | sonnet / high | sonnet / medium | `apps/admin/src/modules/notifications/**` except `views/`, `components/list-*`, `components/notification-detail-drawer.vue`, `components/notifications-filter.vue`; `app-top-bar.vue`; `layout-default.vue`; `app.main.ts`; `openapi.constants.ts`; delete `update-notification-badge.vue` | `feat(admin): add the notifications bell and live store` |
| N-6 | #891 | Admin page: filter, list, bulk bar, detail drawer, CTA execution, module config form, route and menu | N-5 | sonnet / high | sonnet / medium | `modules/notifications/views/**`, `components/list-notifications.vue`, `notifications-filter.vue`, `notification-detail-drawer.vue`, `notifications-config-form.vue`, `composables/useNotificationAction.ts`, `router/` | `feat(admin): add the notifications page with bulk actions and CTAs` |
| N-7 | #892 | Five further locales (cs-CZ, de-DE, es-ES, pl-PL, sk-SK) and admin test hardening | N-6 | sonnet / low | sonnet / low | `modules/notifications/locales/*.json`, spec files in `modules/notifications/**` | `feat(admin): translate the notifications module` |
| N-8 | #893 | Reference channel plugins: generic webhook and Discord (backend and admin, secrets, test action) | N-3 | sonnet / high | sonnet / medium | `apps/backend/src/plugins/notifications-webhook/**`, `notifications-discord/**`, `apps/admin/src/plugins/notifications-webhook/**`, `notifications-discord/**`, secret spec tables, `app.module.ts`, `app.main.ts` | `feat(cross): add webhook and Discord notification channels` |
| N-9 | #894 | Slack and Telegram channel plugins mirroring N-8 | N-8 | sonnet / low | sonnet / low | `plugins/notifications-slack/**`, `notifications-telegram/**` on both sides, secret spec tables, registration lines | `feat(cross): add Slack and Telegram notification channels` |
| N-10 | #895 | Emitters batch 2: Home Assistant connection, storage fallback, throttling cron, security alert bridge | N-4 | sonnet / high | sonnet / medium | `plugins/devices-home-assistant/services/home-assistant.ws.service.ts`, `modules/storage/services/storage.service.ts`, `modules/storage/services/storage-fallback-monitor.service.ts` (new), `modules/system/services/system-throttle-monitor.service.ts` (new), `modules/security/services/security-events.service.ts` | `feat(backend): raise notifications for integration, storage, throttling and security conditions` |
| N-11 | #896 | SDK types, `docs/notifications.md`, `docs/extensions.md` section, architecture and CLAUDE.md module tables, example extension snippet | N-3 | sonnet / low | sonnet / low | `packages/extension-sdk/src/notification.types.ts`, `index.ts`, `packages/example-extension/**`, `docs/**`, `CLAUDE.md` | `docs(cross): document the notifications module and export its SDK types` |
| N-12 | — | Integrated verification on the merged stack, manual smoke, final whole-branch review | N-1…N-11 | coordinator | **opus / high** (final review) | any file only after worker hand-off | none (fix-ups land on the open PRs) |

Lanes after N-3 merges: **A** admin (N-5 → N-6 → N-7), **B** channels (N-8 → N-9), **C** emitters (N-4 → N-10),
**D** docs (N-11). Lanes run in separate worktrees with the disjoint ownership above. N-4 is backend-only so it
never collides with N-5 in `app-top-bar.vue`.

Workers must not broaden scope, touch files owned by another running task, commit to `main`, or edit
generated files by hand.

---

### Task N-1: Backend domain and storage

**Outcome:** `NotificationsService.notify/resolve/resolveAll` with the full lifecycle table from the spec,
persisted in SQLite, with boot cleanup, retention, cap and rate guard, and the module registered in the app.

**Files:**
- Create: `apps/backend/src/modules/notifications/notifications.module.ts`
- Create: `apps/backend/src/modules/notifications/notifications.constants.ts`
- Create: `apps/backend/src/modules/notifications/notifications.openapi.ts`
- Create: `apps/backend/src/modules/notifications/notifications.exceptions.ts`
- Create: `apps/backend/src/modules/notifications/entities/notifications.entity.ts`
- Create: `apps/backend/src/modules/notifications/models/config.model.ts`
- Create: `apps/backend/src/modules/notifications/models/notification.model.ts`
- Create: `apps/backend/src/modules/notifications/models/notification-action.model.ts`
- Create: `apps/backend/src/modules/notifications/dto/update-config.dto.ts`
- Create: `apps/backend/src/modules/notifications/services/notifications.service.ts`
- Create: `apps/backend/src/modules/notifications/services/notifications.service.spec.ts`
- Create: `apps/backend/src/modules/notifications/services/notifications-retention.service.ts`
- Create: `apps/backend/src/modules/notifications/services/notifications-retention.service.spec.ts`
- Create: `apps/backend/src/modules/notifications/services/notification-input.validator.ts`
- Create: `apps/backend/src/modules/notifications/services/notification-input.validator.spec.ts`
- Create: `apps/backend/src/migrations/1000000000025-AddNotifications.ts`
- Modify: `apps/backend/src/app.module.ts` (import, `imports:` entry, `RouterModule` child under `MODULES_PREFIX`)
- Modify: `apps/backend/src/modules/extensions/extensions.constants.ts` (`NON_TOGGLEABLE_MODULES` gains `notifications-module`)

**Interfaces (produces):**

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
export type NotificationActionInput =
	| { type: NotificationActionType.LINK; label: string; url: string; primary?: boolean }
	| { type: NotificationActionType.EXTENSION_ACTION; label: string; extension_type: string; action_id: string; params?: Record<string, string | number | boolean>; primary?: boolean }
	| { type: NotificationActionType.SERVICE; label: string; extension_kind: 'module' | 'plugin'; extension_type: string; service_id: string; operation: 'start' | 'stop' | 'restart'; primary?: boolean };

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

The entity `NotificationEntity` (`@Entity('notifications_module_notifications')`, `@ApiSchema({ name: 'NotificationsModuleDataNotification' })`)
carries the columns from the spec table with snake_case wire names through `@Expose({ name })` and
`@ApiProperty({ name })`, `actions` and `data` as `simple-json`, and the partial unique index declared both in
the entity (`@Index('IDX_notifications_source_key_active', ['source', 'key'], { unique: true, where: '"key" IS NOT NULL AND "resolved_at" IS NULL' })`)
and in the migration. `NotificationActionModel` is a discriminated Swagger model
(`NotificationsModuleDataNotificationAction`) with `type`, `label`, `primary`, and the optional fields of the
three variants.

`NotificationsConfigModel` (`NotificationsModuleDataConfig`) extends `ModuleConfigModel` with
`retention_days` (int, 1–365, default 30) and `max_notifications` (int, 50–5000, default 500);
`UpdateNotificationsConfigDto` (`NotificationsModuleUpdateConfig`) mirrors it; both registered through
`ModulesTypeMapperService.registerMapping` in `onModuleInit`, together with `swaggerRegistry.register` for
every model in `NOTIFICATIONS_SWAGGER_EXTRA_MODELS` and `extensionsService.registerModuleMetadata`.

**Behaviour to implement (each line is a test in `notifications.service.spec.ts`):**
- Event without key inserts a new row with `occurrences = 1`, `read_at/dismissed_at/resolved_at = null`.
- Event with key upserts: second call returns the same id, `occurrences = 2`, title/message/severity/actions/data replaced, `read_at` and `dismissed_at` cleared.
- Issue upserts: same id, `occurrences + 1`, fields replaced, `read_at` and `dismissed_at` preserved.
- `dismiss(id, true)` on an issue with `persistent = true` also sets `resolved_at` (nothing re-detects such a condition, so the dismissal is how it ends); non-persistent issues and events set only `dismissed_at`.
- Issue without key returns `null` and logs a warning; event `resolve` on an unkeyed row returns `false`.
- `resolve` sets `resolved_at` and the next `notify` with the same key inserts a fresh row (the partial index permits it).
- `resolveAll(source)` resolves every unresolved keyed row of that source, dismissed rows included (a dismissed unresolved issue must not outlive its plugin), and returns the count.
- Validation: title and message truncated to their limits; a fourth action dropped; `link` with `javascript:` scheme rejected (`null`); `data` above 4096 bytes rejected; nested `data` rejected; unknown severity rejected.
- Rate guard: the 61st call from one source within a minute returns `null`; another source is unaffected; the window resets.
- Database failure inside `notify` is caught, logged, and returns `null`.
- `notify` emits `EventType.NOTIFICATION_CREATED` with `{ id, kind, severity, source }` on insert and `NOTIFICATION_UPDATED` on upsert; `markRead/dismiss` emit `UPDATED`; `remove` emits `DELETED` with `{ id }`; `resolve` emits `UPDATED`.
- `findAll` default status `active`; `unread` filter; total order `created_at DESC, id DESC`; cursor `afterId` returns the rows that follow the row with that id in the total order (two rows with equal `created_at` are disambiguated by id); `limit` capped at 200.

**Retention service (`notifications-retention.service.ts`, tests in its spec):**
- `bootStartedAt` captured in the constructor; `onApplicationBootstrap` resolves issues with `persistent = false` and `updated_at < bootStartedAt`, wrapped in `try/catch` that logs and continues.
- `@Cron('15 3 * * *')` prunes by kind: `event` rows once at least one of `dismissed_at` / `resolved_at` is set and the later of them is older than `retention_days`; `issue` rows only when `resolved_at` is set and the later of `resolved_at` and `dismissed_at` is older than `retention_days` (a dismissed but unresolved issue is kept). Then it enforces `max_notifications` on active events (oldest read first, then oldest unread), reading both values through `ConfigService.getModuleConfig(NOTIFICATIONS_MODULE_NAME)`. Tests: an old dismissed-unresolved issue survives; an old dismissed event is deleted; an old resolved issue is deleted; a resolved-then-dismissed issue counts from the later timestamp.
- Issues are never evicted by the cap.

**Migration:** creates the table with all columns, `IDX_notifications_source_key_active` (partial unique),
`IDX_notifications_created_at`, `IDX_notifications_dismissed_at`, `IDX_notifications_resolved_at`; `down`
drops the table. Verify with a fresh database: `cd apps/backend && FB_DB_PATH=$(mktemp -d) pnpm run typeorm:migration:run`.

**Verification:**
- [ ] `cd apps/backend && npx jest src/modules/notifications` green
- [ ] `pnpm --filter @fastybird/smart-panel-backend run lint:js && pnpm --filter @fastybird/smart-panel-backend run lint:api && pnpm --filter @fastybird/smart-panel-backend run type-check`
- [ ] `FB_DB_PATH=$(mktemp -d) pnpm run generate:openapi` exits 0 (bootstrap survives an empty database)
- [ ] Commit with the PR title as subject; open the PR against `main`.

---

### Task N-2: REST and websocket surface

**Outcome:** The six endpoints from the spec, Swagger-described, with thin websocket pointers reaching only
owner/admin sockets, plus regenerated `spec/api/v1/openapi.json` and panel client.

The controller is `@Controller('notifications')` in the module mounted at `/api/modules/notifications`, so the
full paths are `/api/modules/notifications/notifications`, `/api/modules/notifications/notifications/{id}`,
`/api/modules/notifications/notifications/bulk-update` and `/api/modules/notifications/notifications/bulk-remove`.
The table below lists controller-relative routes.

**Files:**
- Create: `apps/backend/src/modules/notifications/controllers/notifications.controller.ts`
- Create: `apps/backend/src/modules/notifications/controllers/notifications.controller.spec.ts`
- Create: `apps/backend/src/modules/notifications/dto/update-notification.dto.ts`
- Create: `apps/backend/src/modules/notifications/dto/bulk-update-notifications.dto.ts`
- Create: `apps/backend/src/modules/notifications/dto/bulk-remove-notifications.dto.ts`
- Create: `apps/backend/src/modules/notifications/models/notifications-response.model.ts`
- Create: `apps/backend/test/notifications.e2e-spec.ts`
- Modify: `apps/backend/src/modules/notifications/notifications.openapi.ts` (add the new models)
- Modify: `apps/backend/src/modules/notifications/notifications.module.ts` (controller)
- Modify: `apps/backend/src/modules/websocket/gateway/websocket.gateway.ts` (`EXCHANGE_ONLY_EVENT_PREFIXES` and the `SystemModule.System.Update.*` routing stay unchanged; a new `ADMIN_ONLY_EVENT_PREFIXES = ['NotificationsModule.']` is delivered to a new `ADMIN_ROOM` that sockets join at handshake when their principal is a user with `UserRole.OWNER` or `UserRole.ADMIN`)
- Regenerate locally (gitignored, not committed): `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/**` via `pnpm run generate:openapi`

**Interfaces (consumes N-1: `NotificationsService`, `NotificationsFilter`; produces the routes below):**

| Route | operationId | Handler |
| --- | --- | --- |
| `GET /` | `get-notifications-module-notifications` | Parses `status`, `severity` (repeatable), `source`, `kind`, `unread`, `after_id`, `limit` (default 50, clamped to `1 <= limit <= 200`; the service cap allows 201 so the boundary survives the maximum page size); calls `findAll` with `limit + 1`; returns the first `limit` rows and sets meta `{ next_cursor: last returned row id or undefined, has_more: rows.length > limit }` through `setResponseMeta` (`logs.controller.ts:99-103` shows the meta call). |
| `GET /:id` | `get-notifications-module-notification` | 404 through `NotificationsNotFoundException`. |
| `PATCH /:id` | `update-notifications-module-notification` | `UpdateNotificationDto { read?: boolean; dismissed?: boolean }` wrapped in `ReqUpdateNotificationDto { data }`. |
| `DELETE /:id` | `delete-notifications-module-notification` | 204. |
| `POST /bulk-update` | `bulk-update-notifications-module-notifications` | `BulkUpdateNotificationsDto { ids: string[]; read?: boolean; dismissed?: boolean }` → `runBulkOperation(ids, perform, { fallbackReason, safeErrors: [NotificationsException], logger })` → `CommonDataBulkResult`. |
| `POST /bulk-remove` | `bulk-remove-notifications-module-notifications` | `BulkRemoveNotificationsDto { ids: string[] }`. |

Response models: `NotificationResponseModel` (`NotificationsModuleResNotification`),
`NotificationsResponseModel` (`NotificationsModuleResNotifications`), and a module-local
`BulkResultResponseModel` (`NotificationsModuleResBulkResult`) wrapping the shared `BulkResultModel` from
`modules/api/models/bulk.model.ts`, the per-module pattern of `devices-response.model.ts:195`.

**Tests:**
- Controller spec: every route carries `@Roles(UserRole.OWNER, UserRole.ADMIN)` (read metadata with `Reflect.getMetadata(ROLES_KEY, ...)`); list forwards parsed filters; bulk hand-off collects a failure without aborting the rest.
- e2e: as owner, create rows through the service, list active, patch read, bulk dismiss, bulk remove; as a `USER` role token every route returns 403; a display token returns 403.
- Controller spec: with 3 rows of equal `created_at`, two pages of `limit = 2` return all three exactly once in `(created_at DESC, id DESC)` order, the first with `has_more: true` and `next_cursor` set, the second with `has_more: false`.
- Gateway spec: a `NotificationsModule.Notification.Created` event reaches an owner socket and an admin socket in the exchange room, and reaches neither a `UserRole.USER` socket that joined the exchange room nor a display socket (extend the existing `SystemModule.System.Update.*` test).

**Verification:**
- [ ] `cd apps/backend && npx jest src/modules/notifications src/modules/websocket`
- [ ] `cd apps/backend && FB_DB_SYNC=true npx jest --config ./test/jest-e2e.json test/notifications.e2e-spec.ts > /tmp/e2e.log; tail -20 /tmp/e2e.log`
- [ ] `pnpm run generate:openapi` then `pnpm --filter @fastybird/smart-panel-backend run lint:openapi` (outputs are gitignored; nothing to commit).
- [ ] `git status` shows no generated file staged.

---

### Task N-3: Channel registry and dispatcher

**Outcome:** Plugins can register a channel; every inserted notification is delivered to the channels whose
filter matches, with timeout, retry, loop guard and a self-reported `delivery-failed` issue.

**Files:**
- Create: `apps/backend/src/modules/notifications/platforms/notification-channel.platform.ts`
- Create: `apps/backend/src/modules/notifications/services/notification-channel-registry.service.ts`
- Create: `apps/backend/src/modules/notifications/services/notification-channel-registry.service.spec.ts`
- Create: `apps/backend/src/modules/notifications/services/notification-dispatcher.service.ts`
- Create: `apps/backend/src/modules/notifications/services/notification-dispatcher.service.spec.ts`
- Create: `apps/backend/src/modules/notifications/notifications.utils.ts` (`sanitizeErrorMessage`) and `notifications.utils.spec.ts`
- Modify: `apps/backend/src/modules/notifications/notifications.module.ts` (providers, exports)

**Interfaces (produces):**

```ts
// platforms/notification-channel.platform.ts
export interface INotificationChannel {
	getType(): string;
	isConfigured(): Promise<boolean>;
	getMinSeverity(): Promise<NotificationSeverity>;
	send(notification: NotificationEntity, signal: AbortSignal): Promise<void>;   // honour the signal; the dispatcher races it anyway
}

export abstract class BaseNotificationChannel implements INotificationChannel {
	protected constructor(protected readonly configService: ConfigService, protected readonly type: string) {}
	getType(): string;
	async isConfigured(): Promise<boolean>;             // default: plugin enabled and required fields present, via abstract hasRequiredConfig(config)
	async getMinSeverity(): Promise<NotificationSeverity>; // reads `min_severity` from the plugin config, default WARNING
	protected abstract hasRequiredConfig(config: PluginConfigModel): boolean;
	abstract send(notification: NotificationEntity, signal: AbortSignal): Promise<void>;
	protected formatText(notification: NotificationEntity): string; // "[ERROR] Title\nmessage\nSource: x · 3 occurrences"
	protected fetchWithSignal(url: string, init: RequestInit, signal: AbortSignal): Promise<Response>; // fetch with the dispatcher's signal and `redirect: 'error'`; wraps outcomes into ChannelDeliveryError
	protected classify(error: unknown, response?: Response): ChannelDeliveryError; // channel-side helper: DNS/refused/unreachable/TLS-handshake causes and HTTP 429/5xx → retryable: true; reset, broken pipe, abort/timeout, redirect, other 4xx → retryable: false
}

export class ChannelDeliveryError extends Error { // the dispatcher-facing contract: every channel failure is one of these
	constructor(message: string, readonly retryable: boolean, readonly status?: number);
}

// notifications.utils.ts
export function sanitizeErrorMessage(message: string): string;
// reduces every URL to `scheme://host` (dropping userinfo, path and query — this also removes Telegram `bot<token>`
// segments and Slack/Discord webhook paths), replaces `Bearer <token>` and `token=`/`key=`/`password=`/`secret=`
// values with `***`, collapses whitespace, truncates to 300 chars

// services/notification-channel-registry.service.ts
export class NotificationChannelRegistryService {
	register(channel: INotificationChannel): void;      // throws on duplicate type, like CommandEventRegistryService
	unregister(type: string): void;
	getChannels(): INotificationChannel[];
	isChannel(source: string): boolean;                 // loop guard
}
```

**Dispatcher behaviour (`@OnEvent(EventType.NOTIFICATION_CREATED)` → `findOne(id)` → `dispatch(entity)`):**
- Skip when `registry.isChannel(entity.source)`.
- For each channel in parallel (`Promise.allSettled`): skip when the extension is disabled
  (`configService.getPluginConfig(type).enabled === false`), when `isConfigured()` is false, or when
  `SEVERITY_RANK[entity.severity] < SEVERITY_RANK[await channel.getMinSeverity()]`.
- Attempts: up to 3, with delays of 1 000 ms and 5 000 ms between them (injectable `sleep` for tests). Each attempt creates `AbortSignal.timeout(10_000)`, calls `send(notification, signal)` and races the promise against the signal's abort so a channel that ignores the signal still settles. Only a `ChannelDeliveryError` with `retryable: true` gets another attempt (connection-establishment failures — DNS, refused, unreachable, TLS handshake — and HTTP 429 / 5xx); a reset after the request was written, an abort/timeout, a redirect, any other 4xx, and any non-`ChannelDeliveryError` rejection end the delivery immediately as failed. Rejections are normalised first: `const message = error instanceof Error ? error.message : String(error)` (guarded so a throwing `toString` yields `'unknown error'`).
- After the final failure: `logger.error` with channel type and `sanitizeErrorMessage(message)` (never the URL), then
  `notificationsService.notify({ source: channel.getType(), kind: ISSUE, key: 'delivery-failed', severity: WARNING, title: 'Notification delivery failed', message: sanitizeErrorMessage(message), actions: [{ type: 'link', label: 'Open channel settings', url: '/config/plugins/<type>' }] })`.
- After a success: `notificationsService.resolve(channel.getType(), 'delivery-failed')`.
- Per-channel deliveries are serialised with a simple promise chain so a burst keeps message order.

**Tests (dispatcher spec, with fake channels and a fake `sleep`):** filter by disabled, unconfigured, below
min severity; loop guard; a retryable failure is retried three times (sleeps of 1 000 then 5 000 ms) then
self-reported; a timeout and a 400 are not retried; a channel that never settles is aborted by the race and
counted as failed; a `null` rejection still produces a self-report with a sanitized message; success resolves
the self-report; one failing channel does not block another; order preserved within one channel. Registry
spec: duplicate throws, `isChannel`. Utils spec: a Telegram `https://api.telegram.org/bot123:ABC/sendMessage`
URL and a Slack `https://hooks.slack.com/services/T0/B0/XYZ` URL both reduce to `scheme://host`; userinfo,
query strings, bearer tokens and `token=` values are masked; whitespace collapsed; 300-character truncation.

**Verification:**
- [ ] `cd apps/backend && npx jest src/modules/notifications`
- [ ] backend `lint:js`, `lint:api`, `type-check`

---

### Task N-4: Emitters batch 1 (backend)

**Outcome:** Update available, update failed, managed service error, and failed login produce notifications
with the keys, severities and CTAs from the spec.

**Files:**
- Modify: `apps/backend/src/modules/system/services/update.service.ts` (after `checkForUpdates` result and inside `scheduledUpdateCheck`)
- Modify: `apps/backend/src/modules/system/services/update-executor.service.ts:73` (`FAILED` state)
- Modify: `apps/backend/src/modules/extensions/services/managed-service-manager.service.ts` (state transitions to `error` and to `started`; readiness retries exhausted at `:795`)
- Modify: `apps/backend/src/modules/auth/services/auth.service.ts:91-119` (`login(dto, context?: { ip?: string })`)
- Modify: `apps/backend/src/modules/auth/controllers/auth.controller.ts` (pass `req.ip`)
- Modify: the four matching `*.spec.ts` files

**Interfaces (consumes N-1 `NotificationsService` and N-3 `sanitizeErrorMessage`):**

```ts
// system: update available
await this.notifications.notify({
	source: SYSTEM_MODULE_NAME, kind: NotificationKind.ISSUE, key: 'update-available', severity: NotificationSeverity.INFO,
	title: `Update ${latestVersion} is available`, message: `Installed ${currentVersion}. Channel: ${channel}.`,
	actions: [{ type: NotificationActionType.LINK, label: 'View update', url: '/system/info', primary: true }],
	data: { current_version: currentVersion, latest_version: latestVersion },
});
// ... and `resolve(SYSTEM_MODULE_NAME, 'update-available')` when no update is available or install succeeded.

// extensions: service error (key uses the manager's runtime key `<kind>:<type>:<serviceId>`)
key: `service:${key}`, severity: ERROR, title: `Service ${serviceId} of ${type} failed`, message: sanitizeErrorMessage(lastError),
actions: [
	{ type: SERVICE, label: 'Restart service', extension_kind, extension_type, service_id, operation: 'restart', primary: true },
	{ type: LINK, label: 'Open services', url: `/extensions?tab=services&kind=${extension_kind}` },
]
// resolve on transition to 'started'.

// auth: failed login (hour bucket in UTC; `const user = username.slice(0, 64)` and `const client = ip ?? 'unknown'` are used everywhere below)
key: `login-failed:${user}:${client}:${bucket}`, kind: EVENT, severity: WARNING,
// const client = ip ?? 'unknown'; used in the key, the message and the data
title: `Failed login attempt for "${user}"`, message: `From ${client} · ${count} attempt(s) this hour`,
data: { username: user, ip: client, reason },
```

The auth emitter keeps an in-memory `Map<string, number>` counter per key so the message carries the count; it
is bounded: entries of past hour buckets are pruned on every call, and the map never exceeds 1 000 keys (the
oldest key is evicted when a new one would exceed it), so a flood of distinct usernames or IPs cannot grow it. `AuthService.login` gains an optional `context` argument so existing callers
compile unchanged.

**Tests:** for each emitter, one test that the condition calls `notify` with the exact `source`, `kind`,
`key`, `severity` and primary action, and one that the clearing condition calls `resolve`; the manager spec
also proves a service that fails and then starts produces exactly one raise and one resolve; the auth spec
proves three failures in one hour call `notify` three times with `count` 1, 2, 3 and the same key.

**Verification:**
- [ ] `cd apps/backend && npx jest src/modules/system src/modules/extensions src/modules/auth`
- [ ] backend `lint:js`, `lint:api`, `type-check`

---

### Task N-5: Admin foundation and bell

**Outcome:** The admin loads active notifications, keeps them live over the socket, shows the bell with an
unread badge and popover, toasts errors, and no longer shows the update badge.

**Files:**
- Create: `apps/admin/src/modules/notifications/index.ts`
- Create: `apps/admin/src/modules/notifications/notifications.module.ts`
- Create: `apps/admin/src/modules/notifications/notifications.constants.ts`
- Create: `apps/admin/src/modules/notifications/store/notifications.store.ts`
- Create: `apps/admin/src/modules/notifications/store/notifications.store.schemas.ts`
- Create: `apps/admin/src/modules/notifications/store/notifications.store.spec.ts`
- Create: `apps/admin/src/modules/notifications/store/index.ts`
- Create: `apps/admin/src/modules/notifications/composables/useNotifications.ts`
- Create: `apps/admin/src/modules/notifications/composables/useNotificationsActions.ts`
- Create: `apps/admin/src/modules/notifications/composables/useNotificationsActions.spec.ts`
- Create: `apps/admin/src/modules/notifications/composables/composables.ts`
- Create: `apps/admin/src/modules/notifications/components/notification-bell.vue`
- Create: `apps/admin/src/modules/notifications/components/notification-bell.spec.ts`
- Create: `apps/admin/src/modules/notifications/components/notification-popover.vue`
- Create: `apps/admin/src/modules/notifications/components/notification-item.vue`
- Create: `apps/admin/src/modules/notifications/components/notification-severity-tag.vue`
- Create: `apps/admin/src/modules/notifications/components/components.ts`
- Create: `apps/admin/src/modules/notifications/locales/en-US.json`, `locales/index.ts` (other locales in N-7 copy en-US for now)
- Modify: `apps/admin/src/openapi.constants.ts` (aliases `NotificationsModuleNotificationSchema = components['schemas']['NotificationsModuleDataNotification']`, action, severity/kind enums, bulk request schemas, config schema)
- Modify: `apps/admin/src/app.main.ts` (`app.use(NotificationsModule, moduleOptions)`)
- Modify: `apps/admin/src/common/components/app-top-bar.vue` (mount `<notification-bell />`, remove `<update-notification-badge />` and its import)
- Modify: `apps/admin/src/common/layouts/layout-default.vue` (mobile right slot mounts the bell)
- Delete: `apps/admin/src/modules/system/components/system-info/update-notification-badge.vue` and its export in `components.ts`; keep `useUpdateStatus` (still used by the update page)

**Interfaces (consumes N-2 generated types; produces the store and constants used by N-6):**

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
// getters: findAll, findById, list (listIds mapped to items), active (dismissedAt === null && resolvedAt === null), unreadCount, highestActiveSeverity, hasMore, nextCursor
```

Schemas bind the response schema to the generated interface (`ZodType<NotificationsModuleNotificationSchema>`)
and use `z.nativeEnum` over the generated enums, per the config-contract convention. The store applies the
mutation-token ordering of `devices.store.ts` (`commit/forget`, `requestedAt` captured before the request).

**Module install (`notifications.module.ts`):** merge `notificationsModule` locale; register and provide the
store; register routes on `AppRouteNames.ROOT` (route file delivered in N-6, so N-5 registers an empty
array); `dataRefreshRegistry.register`; sockets handler: on `Created`/`Updated` call `store.get({ id })`
and, for `Created` with severity `error` or `critical`, `flashMessage.error(title)` after the row arrives;
on `Deleted` call `unset`.

**Bell:** `notification-bell.vue` uses `el-badge` (`:value="unreadCount" :hidden="unreadCount === 0"`) around
an `mdi:bell-outline` icon that switches to `mdi:bell-alert` in the danger colour when
`highestActiveSeverity` is `error` or `critical`; `el-popover` shows `notification-popover.vue` (top 8 active
by severity rank then `createdAt` desc, "Mark all as read" through `bulkUpdate`, "View all" routes to
`RouteNames.NOTIFICATIONS`). Each item: severity tag, title, source, relative time, occurrences badge when above 1 (relative time through `formatTimeAgo` from `@vueuse/core`, as in
`system-logs-table.vue:155`), primary action button (delegates to
`useNotificationAction` from N-6; in N-5 it emits `action` and the popover routes to the page), dismiss icon.

**Tests:** store `set/unset/onEvent` parse and validation; `fetch` with `append` merges by id; ordering token
skips a stale read; `unreadCount` and `highestActiveSeverity`; bell renders hidden badge at zero and shows
the count; `useNotificationsActions.dismiss` keeps confirmation and the request in separate `try` blocks.

**Verification:**
- [ ] `pnpm run generate:openapi` (regenerates the gitignored admin types locally) then `cd apps/admin && npx vitest run src/modules/notifications`
- [ ] `pnpm --filter ./apps/admin run type-check` (catches dangling references to the deleted badge)
- [ ] `pnpm --filter ./apps/admin run lint:js` (baseline 0 errors, 6 known warnings)
- [ ] `cd apps/admin && npx prettier --check <touched files>`

---

### Task N-6: Admin notifications page and CTA execution

**Outcome:** A `/notifications` page with filters, bulk actions, a detail drawer, CTA execution for the
three action types, and the module config form.

**Files:**
- Create: `apps/admin/src/modules/notifications/router/index.ts`
- Create: `apps/admin/src/modules/notifications/views/view-notifications.vue`
- Create: `apps/admin/src/modules/notifications/components/list-notifications.vue`
- Create: `apps/admin/src/modules/notifications/components/notifications-filter.vue`
- Create: `apps/admin/src/modules/notifications/components/notification-detail-drawer.vue`
- Create: `apps/admin/src/modules/notifications/components/notification-actions.vue`
- Create: `apps/admin/src/modules/notifications/components/notifications-config-form.vue`
- Create: `apps/admin/src/modules/notifications/composables/useNotificationAction.ts`
- Create: `apps/admin/src/modules/notifications/composables/useNotificationAction.spec.ts`
- Create: `apps/admin/src/modules/notifications/composables/useNotificationsDataSource.ts`
- Create: `apps/admin/src/modules/notifications/schemas/config.schemas.ts`, `schemas/list.schemas.ts`
- Modify: `apps/admin/src/modules/notifications/notifications.module.ts` (routes, config element with `CONFIG_MODULE_MODULE_TYPE`)
- Modify: `apps/admin/src/modules/notifications/components/notification-popover.vue` (use `useNotificationAction`)
- Modify: `apps/admin/src/modules/notifications/locales/en-US.json`

**Interfaces (consumes N-5 store; produces `useNotificationAction`):**

```ts
export function useNotificationAction(): {
	execute(notification: INotification, action: INotificationAction): Promise<void>;
	isExecuting: Ref<boolean>;
}
// link: relative → router.push(url); absolute http(s) → window.open(url, '_blank', 'noopener')
// extension_action: fetch the action descriptors for `extension_type` through the extensions composable; if the fetch fails or no descriptor matches `action_id`, show an error and execute nothing (fail closed); when the matching descriptor is `dangerous` show `ElMessageBox.confirm` first (in a separate try block); then `useActions().executeAction(extension_type, action_id, params)` from `modules/extensions/composables/useActions.ts:136`, which posts directly and shows no confirmation itself
// service: `useServiceActions().restartService | startService | stopService(extension_kind, extension_type, service_id)` from `modules/extensions/composables/useServiceActions.ts:9-11`, preceded by `ElMessageBox.confirm` for stop and restart
```

Route: `{ path: 'notifications', name: RouteNames.NOTIFICATIONS, meta: { guards: { authenticated: true, roles: [admin, owner] }, title, icon: 'mdi:bell-outline', menu: 500 } }`.

**Page:** filter bar (status select, severity multi-select, source select whose options are the extension types
from the extensions store so any valid source is selectable, unread switch) synced through `useListQuery` with `NotificationsFilterSchema`; `useNotificationsDataSource` forwards
the filters to `store.fetch` (server-side filtering) and calls it with `append: false` whenever a filter
changes, so `listIds` is rebuilt from the first page; table with selection column,
severity tag, title, source, occurrences, relative time, actions column; bulk bar with mark read, mark
unread, dismiss, delete (delete confirms first); "Load more" when `hasMore`; row click opens the drawer
(message with preserved newlines, `data` key/value table, all actions via `notification-actions.vue`,
lifecycle timestamps, delete and dismiss buttons).

**Tests:** `useNotificationAction` routes each action type to the right collaborator (mocked), confirms before
a `dangerous` extension action and before a service stop or restart, does not run the action when the
confirmation is cancelled, and executes nothing when the descriptor fetch fails or no descriptor matches; the page filter schema round-trips through the query string; the config form
validates ranges.

**Verification:**
- [ ] `cd apps/admin && npx vitest run src/modules/notifications`
- [ ] `pnpm --filter ./apps/admin run type-check && pnpm --filter ./apps/admin run lint:js`
- [ ] Run the dev stack (`pnpm run start:dev`, admin dev server), trigger a failed login, watch the bell count rise and the row appear on the page without reload.

---

### Task N-7: Admin locales and test hardening

**Outcome:** cs-CZ, de-DE, es-ES, pl-PL and sk-SK translations for every `notificationsModule.*` key, and
the module's spec files cover the popover and drawer rendering.

**Files:**
- Modify: `apps/admin/src/modules/notifications/locales/{cs-CZ,de-DE,es-ES,pl-PL,sk-SK}.json`, `locales/index.ts`
- Create: `apps/admin/src/modules/notifications/components/notification-popover.spec.ts`, `notification-detail-drawer.spec.ts`

**Behaviour:** key sets identical across all six files (add a spec that diffs the key trees); wording mirrors
the tone of `modules/extensions/locales/*.json`.

**Verification:**
- [ ] `cd apps/admin && npx vitest run src/modules/notifications`
- [ ] `pnpm --filter ./apps/admin run type-check`

---

### Task N-8: Reference channel plugins — webhook and Discord

**Outcome:** Two channel plugins on both sides, each with a redacted secret, a `min_severity` setting, a
`send-test` extension action, and rows in both secret regression tables.

**Files (backend, per plugin `notifications-webhook` and `notifications-discord`):**
- Create: `apps/backend/src/plugins/<plugin>/<plugin>.plugin.ts`, `<plugin>.constants.ts`, `<plugin>.openapi.ts`
- Create: `models/config.model.ts`, `dto/update-config.dto.ts`
- Create: `platforms/<name>-channel.platform.ts` (extends `BaseNotificationChannel`), spec
- Create: `services/<name>-actions.service.ts` (registers `send-test`), spec
- Modify: `apps/backend/src/app.module.ts`, `apps/backend/src/plugins/plugin-secret-removal.spec.ts`

**Files (admin, per plugin):**
- Create: `apps/admin/src/plugins/<plugin>/<plugin>.plugin.ts`, `<plugin>.constants.ts`, `index.ts`
- Create: `components/<name>-config-form.vue`, `components/components.ts`
- Create: `schemas/config.schemas.ts`, `schemas/schemas.ts`, `store/config.store.schemas.ts`
- Create: `locales/*.json` (six), `locales/index.ts`
- Modify: `apps/admin/src/app.main.ts`, `apps/admin/src/openapi.constants.ts`, `apps/admin/src/plugins/config-secrets.spec.ts`

**Interfaces (consumes N-3 `BaseNotificationChannel`, `NotificationChannelRegistryService`; produces the reference layout N-9 copies):**

```ts
// backend webhook config model (NotificationsWebhookPluginDataConfig) — wire names
url: string (writeOnly), url_configured: boolean, min_severity: NotificationSeverity (default 'warning'), headers: Record<string, string> | null (writeOnly), headers_configured: boolean
// secretFields: [{ path: 'url', configuredPath: 'url_configured', inputPaths: ['url'] }, { path: 'headers', configuredPath: 'headers_configured', inputPaths: ['headers'] }]
// validation: headers are only allowed together with an https: url (an http: url with any header is rejected)
// discord config model (NotificationsDiscordPluginDataConfig)
webhook_url (writeOnly), webhook_url_configured, min_severity, username: string | null
```

Webhook `send`: `POST` JSON `{ id, source, kind, severity, title, message, occurrences, created_at, actions }`
plus configured headers; non-2xx throws `Error('HTTP <status>')`. The webhook accepts `http:` URLs for
trusted-network targets; its admin form shows a warning under the URL field and the docs state the exception.
Discord's `webhook_url` must start with `https://`; the config DTO rejects anything else. Discord `send`: `{ username?, embeds: [{ title, description: message, color, footer: { text: 'source · n occurrences' }, timestamp }] }`
with colours `info 0x3498db`, `warning 0xf39c12`, `error 0xe74c3c`, `critical 0x8e44ad`; non-2xx throws.

`send-test` action: `{ id: 'send-test', label: 'Send test notification', category: DIAGNOSTICS, mode: 'immediate', execute }`
builds a fake `NotificationEntity` (`severity: INFO`, title `Test notification from Smart Panel`) and calls the
channel's `send(sample, AbortSignal.timeout(10_000))`, returning `{ success, message }` with the sanitized error
text on failure. Both channels throw `ChannelDeliveryError` for every failure outcome (connection failure,
429, 5xx, timeout, redirect, other 4xx) with the status and the retryable classification from `classify()`.

**Tests:** channel spec with mocked `fetch` asserting URL, method, headers, body, the dispatcher's signal and `redirect: 'error'`; a redirect outcome and a 400 become non-retryable `ChannelDeliveryError`s, a 503 a retryable one; a Discord `http:` URL is rejected by the DTO while the webhook accepts it; an `http:` webhook URL combined with headers is rejected; `ConfigSecretsService.toPublic` strips `headers` and adds `headers_configured`;
`hasRequiredConfig` false without the secret; `send-test` returns failure text on throw; redaction through
`ConfigSecretsService.toPublic` strips the secret and adds `_configured`; the two regression tables gain a
row per secret and stay green.

**Verification:**
- [ ] `cd apps/backend && npx jest src/plugins/notifications-webhook src/plugins/notifications-discord src/plugins/plugin-secret-removal.spec.ts`
- [ ] `pnpm run generate:openapi`; `cd apps/admin && npx vitest run src/plugins/notifications-webhook src/plugins/notifications-discord src/plugins/config-secrets.spec.ts`
- [ ] backend `lint:js`, `lint:api`, `lint:openapi`; admin `type-check`, `lint:js`
- [ ] Manual: configure a real Discord webhook, run "Send test notification" from the Actions tab, see the embed.

---

### Task N-9: Slack and Telegram channel plugins

**Outcome:** Two more plugins with the exact layout of N-8.

**Config:** Slack `webhook_url` (secret), `min_severity`; Telegram `bot_token` (secret), `chat_id` (string),
`min_severity`.

**Payloads:** Slack `{ text: title, attachments: [{ color, title, text: message, footer }] }` with colours
`#3498db / #f39c12 / #e74c3c / #8e44ad`; Telegram `POST https://api.telegram.org/bot<token>/sendMessage`
with `{ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }`, HTML-escaping `<`, `>`, `&` in
title and message; `send` parses the JSON reply and throws unless `ok === true` (the Bot API answers HTTP 200
with `ok: false` on some errors); the token never appears in logs (log `api.telegram.org` and the status only).
Slack's `webhook_url` must start with `https://`, rejected by the DTO otherwise.

**Tests, verification:** as N-8 for each plugin, plus a Telegram test proving the escaped text and one proving
an `ok: false` reply throws, and a Slack test proving an `http:` URL is rejected.

---

### Task N-10: Emitters batch 2 (backend)

**Outcome:** Home Assistant connection issues, storage fallback, throttling flags and security alerts become
notifications.

**Files:**
- Modify: `apps/backend/src/plugins/devices-home-assistant/services/home-assistant.ws.service.ts` (`:579` auth failure raises; `:312` raises after the first failed reconnect attempt; `auth_ok` resolves; `stop()` calls `resolveAll`)
- Create: `apps/backend/src/modules/storage/services/storage-fallback-monitor.service.ts` (`@Cron('* * * * *')`; compares the last observed value of `StorageService.isUsingFallback()` (`storage.service.ts:122`, a pure getter with no transition hook) with the current one; raises `fallback-active` (`warning`) on the false→true transition and resolves on true→false; tracks `isConnected()` the same way: raises `storage-unavailable` (`error`) on the true→false transition and resolves it on false→true; tests cover both transition pairs) and spec; register in `storage.module.ts`
- Create: `apps/backend/src/modules/system/services/system-throttle-monitor.service.ts` (`@Cron('*/5 * * * *')`, reads `SystemService.getThrottleStatus()` (`system.service.ts:29`, fields `undervoltage`, `frequencyCapping`, `throttling`, `softTempLimit`), raises `throttle:undervoltage` (`critical`), `throttle:throttling`, `throttle:frequency_capping`, `throttle:soft_temp_limit` (`warning`) while the flag is set and resolves cleared ones; no-op when the platform returns no throttle data) and spec; register in `system.module.ts`
- Modify: `apps/backend/src/modules/security/services/security-events.service.ts` (`doRecordAlertTransitions`, `:159-181`: alongside the `ALERT_RAISED` point call `notify({ source: SECURITY_MODULE_NAME, kind: ISSUE, key: `alert:${alert.id}`, severity: CRITICAL, title: `Security alert: ${alert.type}`, actions: [{ type: LINK, label: 'Open security', url: '/security', primary: true }], data: { alert_type, source_device_id } })`; alongside `ALERT_RESOLVED` call `resolve`) and its spec. Alerts are detected as transitions inside this service, not emitted on the event bus, so there is no listener to subscribe to.
- Modify: matching spec files

**Tests:** each emitter's raise and resolve pair; the HA test proves a single reconnect blip stays silent and
the second failure raises; the throttle test proves flag flapping produces one raise and one resolve.

**Verification:**
- [ ] `cd apps/backend && npx jest src/plugins/devices-home-assistant src/modules/storage src/modules/system src/modules/security`
- [ ] backend `lint:js`, `lint:api`, `type-check`

---

### Task N-11: SDK types and documentation

**Files:**
- Create: `packages/extension-sdk/src/notification.types.ts` (`NotificationKind`, `NotificationSeverity`, `NotificationAction`, `CreateNotificationInput`, `NotificationChannel` interface mirroring `INotificationChannel` with a plain `Notification` payload type)
- Modify: `packages/extension-sdk/src/index.ts` (export), `packages/extension-sdk/README.md`
- Modify: `packages/example-extension/**` (a `notify` call in the example service, behind the existing pattern)
- Create: `docs/notifications.md` (developer guide: emitting, lifecycle table, writing a channel, testing, payload of the webhook channel)
- Modify: `docs/extensions.md` (Notifications section), `docs/architecture.md` (module table row, plugin category row), `CLAUDE.md` (module list and architecture reference line)
- Modify: `tasks/features/FEATURE-INFLUXDB-MEMORY-FALLBACK.md` (note that the admin notification is now delivered by the notifications module)

**Verification:**
- [ ] `pnpm --filter ./packages/extension-sdk run build` (or its lint) and the example extension builds
- [ ] Markdown reads against the spec; no reference to a type name that N-1/N-3 did not define.

---

### Task N-12: Integrated verification and final review

- [ ] Merge order N-1 → N-2 → N-3, then lanes; rebase each stacked PR after its parent merges.
- [ ] Full runs: `pnpm run test:unit`, `pnpm run test:e2e` (baseline `main` first for the known flakes), `pnpm run lint:js`, backend `lint:api` and `lint:openapi`, admin `type-check`, `FB_DB_PATH=$(mktemp -d) pnpm run generate:openapi`.
- [ ] Manual smoke on the dev stack: failed login → bell; disable a plugin with an issue → issue resolves; restart a service from the CTA → service issue resolves after start; Discord test action; update-available issue after a forced check.
- [ ] Final whole-branch review (opus / high): lifecycle table versus implementation, role guards on every route, no secret in any payload, no generated file hand-edited, PR titles valid.
- [ ] Codex review loop on every PR: wait for 👍 or reply to and resolve each thread.
