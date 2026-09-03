# Task: Notifications REST and websocket surface

ID: FEATURE-NOTIFICATIONS-BACKEND-API
Type: feature
Scope: backend
Size: small
Parent: EPIC-NOTIFICATIONS-MODULE
Status: planned

## 1. Business goal

In order to let the admin, and any other authorized client, list, read, update and receive live updates for
notifications,
As a Smart Panel backend developer,
I want the six REST endpoints and the three websocket pointer events from the design exposed over the
existing API and gateway infrastructure.

## 2. Context

- This is task N-2; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Depends on `FEATURE-NOTIFICATIONS-BACKEND-CORE` (N-1) for `NotificationsService`, `NotificationsFilter` and
  the `EventType` emissions.
- Spec: `docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "REST API" section.
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-2 section.
- The controller is `@Controller('notifications')` inside the module mounted at `/api/modules/notifications`,
  so the full paths are `/api/modules/notifications/notifications`,
  `/api/modules/notifications/notifications/{id}`, `/api/modules/notifications/notifications/bulk-update` and
  `/api/modules/notifications/notifications/bulk-remove`. The acceptance criteria and route table below use
  the controller-relative shorthand.
- Cursor pagination and response-meta pattern to mirror: `logs.controller.ts:99-103` (`GET /logs`'s
  `setResponseMeta` usage).
- Bulk endpoint pattern to mirror: `runBulkOperation` and `CommonDataBulkResult`, wrapped in a module-local
  `BulkResultResponseModel` that wraps the shared `BulkResultModel` from `modules/api/models/bulk.model.ts`,
  the per-module pattern of `devices-response.model.ts:195` - one request per bulk action, with `safeErrors`
  declared.
- Websocket gateway: `apps/backend/src/modules/websocket/gateway/websocket.gateway.ts`, in particular the
  `EXCHANGE_ONLY_EVENT_PREFIXES` static list, which gains `'NotificationsModule.'`. Owner and admin user
  sockets join a new `ADMIN_ROOM` at handshake, and admin-only prefixes are delivered to `ADMIN_ROOM` instead
  of the whole `EXCHANGE_ROOM`, which keeps them away from `UserRole.USER` sockets (displays authenticate as
  `UserRole.USER`). Extend the existing `SystemModule.System.Update.*` gateway spec pattern for the new
  prefix.
- After this task, `pnpm run generate:openapi` must be run and the regenerated `spec/api/v1/openapi.json`
  and `apps/panel/lib/api/**` committed - never hand-edit them (see `CLAUDE.md` "Generated Code").

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/887 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- `NotificationsController` with `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /bulk-update`,
  `POST /bulk-remove`, all `@Roles(UserRole.OWNER, UserRole.ADMIN)`.
- `UpdateNotificationDto`, `BulkUpdateNotificationsDto`, `BulkRemoveNotificationsDto` and their `Req*`
  wrappers.
- `NotificationResponseModel` / `NotificationsResponseModel` response models, plus a module-local
  `BulkResultResponseModel` (`@ApiSchema({ name: 'NotificationsModuleResBulkResult' })`) wrapping the shared
  `BulkResultModel` from `modules/api/models/bulk.model.ts`.
- Adding `'NotificationsModule.'` to `EXCHANGE_ONLY_EVENT_PREFIXES` in `websocket.gateway.ts`, joining
  owner/admin user sockets to a new `ADMIN_ROOM` at handshake, and delivering admin-only prefixes to
  `ADMIN_ROOM`.
- Registering the controller in `notifications.module.ts` and the new models in `notifications.openapi.ts`.
- `apps/backend/test/notifications.e2e-spec.ts`.
- Regenerating `spec/api/v1/openapi.json` and `apps/panel/lib/api/**`.

**Out of scope**

- Channel registry and dispatcher (`FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH`).
- Any emitter (`FEATURE-NOTIFICATIONS-EMITTERS-CORE`, `FEATURE-NOTIFICATIONS-EMITTERS-INTEGRATIONS`).
- Admin store or UI consuming these endpoints (`FEATURE-NOTIFICATIONS-ADMIN-BELL`,
  `FEATURE-NOTIFICATIONS-ADMIN-PAGE`).

## 4. Acceptance criteria

- [ ] `GET /notifications` (`operationId: get-notifications-module-notifications`) parses `status` (default
      `active`), `severity` (repeatable), `source`, `kind`, `unread`, `after_id`, `limit` (default 50,
      clamped to `1 <= limit <= 200`) and calls `findAll` with `limit + 1` rows (the service's cap allows
      201, so the boundary survives the maximum page size) in the total order `created_at DESC, id DESC`.
- [ ] `limit=0` is clamped up to the minimum of 1, matching the `Math.min(Math.max(..., 1), 200)` pattern in
      `logs.controller.ts`, not treated as unlimited or rejected.
- [ ] A non-numeric `limit` (e.g. `limit=abc`) falls back to the default of 50, matching the `isNaN` fallback
      in `logs.controller.ts`.
- [ ] `GET /notifications` returns only the first `limit` rows and sets response meta
      `{ next_cursor: last returned row id or undefined, has_more: rows.length > limit }` through
      `setResponseMeta`, matching the pattern in `logs.controller.ts:99-103`.
- [ ] `GET /notifications/:id` (`operationId: get-notifications-module-notification`) returns 404 through
      `NotificationsNotFoundException` when the id does not exist.
- [ ] `PATCH /notifications/:id` (`operationId: update-notifications-module-notification`) accepts
      `{ data: { read?: boolean; dismissed?: boolean } }` and applies `markRead`/`dismiss`.
- [ ] `DELETE /notifications/:id` (`operationId: delete-notifications-module-notification`) removes the row
      and returns 204.
- [ ] `POST /notifications/bulk-update` (`operationId: bulk-update-notifications-module-notifications`)
      accepts `{ data: { ids, read?, dismissed? } }` and returns a `CommonDataBulkResult` via
      `runBulkOperation` with `safeErrors` declared.
- [ ] `POST /notifications/bulk-remove` (`operationId: bulk-remove-notifications-module-notifications`)
      accepts `{ data: { ids } }` and returns a `CommonDataBulkResult`.
- [ ] Every route carries `@Roles(UserRole.OWNER, UserRole.ADMIN)`, verified in the controller spec by
      reading `Reflect.getMetadata(ROLES_KEY, ...)`.
- [ ] The controller spec proves the list handler forwards parsed filters unchanged to
      `NotificationsService.findAll`.
- [ ] The controller spec proves the bulk hand-off collects a per-item failure without aborting the rest of
      the batch.
- [ ] Controller spec: with 3 rows of equal `created_at`, two pages of `limit = 2` return all three rows
      exactly once in `(created_at DESC, id DESC)` order - the first page with `has_more: true` and
      `next_cursor` set, the second with `has_more: false`.
- [ ] e2e: as an owner token, create rows through the service, then list active, patch read, bulk dismiss and
      bulk remove through the REST endpoints.
- [ ] e2e: `PATCH /notifications/:id` with `{ data: { dismissed: true } }` on a persistent issue also sets
      `resolved_at`, inheriting the lifecycle rule from `FEATURE-NOTIFICATIONS-BACKEND-CORE`.
- [ ] e2e: `PATCH /notifications/:id` with `{ data: { dismissed: false } }` on a persistent issue that was
      resolved by its own dismissal clears `dismissed_at` but leaves `resolved_at` in place, inheriting the
      inverse lifecycle rule from `FEATURE-NOTIFICATIONS-BACKEND-CORE`.
- [ ] e2e: every notifications route returns 403 for a `USER`-role token and for a display token.
- [ ] e2e: the migration applies cleanly on a fresh database.
- [ ] `'NotificationsModule.'` is added to `EXCHANGE_ONLY_EVENT_PREFIXES` in `websocket.gateway.ts`; owner and
      admin user sockets join a new `ADMIN_ROOM` at handshake, and a gateway spec proves a
      `NotificationsModule.Notification.Created` event reaches an owner socket and an admin socket in the
      exchange room (extending the existing `SystemModule.System.Update.*` test).
- [ ] Gateway spec: the same `NotificationsModule.Notification.Created` event reaches neither a `UserRole.USER`
      socket that joined the exchange room nor a display socket.
- [ ] Websocket payloads are thin pointers: `{ id, kind, severity, source }` for `Created`/`Updated`, `{ id }`
      for `Deleted`.
- [ ] `pnpm run generate:openapi` regenerates `spec/api/v1/openapi.json` and `apps/panel/lib/api/**` with no
      hand edits (`git diff --stat` shows no manual changes under `apps/panel/lib/api/`).
- [ ] `pnpm --filter @fastybird/smart-panel-backend run lint:openapi` passes on the regenerated spec.

## 6. Technical constraints

- Depends on: N-1 / FEATURE-NOTIFICATIONS-BACKEND-CORE.
- Never hand-edit `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts` or `apps/panel/lib/api/`; change
  the Swagger sources and run `pnpm run generate:openapi`, then commit the regenerated spec and panel client.
- Swagger decorators before NestJS decorators; every action has `@ApiOperation` with `tags`, `summary`,
  `description`, `operationId`; responses wrapped in `*ResponseModel`.
- Schema names `NotificationsModuleData*`, `NotificationsModuleRes*`, `NotificationsModuleReq*`,
  `NotificationsModule<Action><Entity>`.
- Every route `@Roles(UserRole.OWNER, UserRole.ADMIN)`.
- Bulk endpoints are one request through `runBulkOperation` with `safeErrors` declared.
- Tabs, single quotes, semicolons, trailing commas; print width 120; import ordering as elsewhere.
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `feat(backend): expose notifications over REST and websocket`
- Suggested worker tier: implementer sonnet / medium, reviewer sonnet / medium.

## 7. Implementation hints

Route table from the plan (consumes N-1's `NotificationsService`, `NotificationsFilter`):

| Route | operationId | Handler |
| --- | --- | --- |
| `GET /` | `get-notifications-module-notifications` | Parses `status`, `severity` (repeatable), `source`, `kind`, `unread`, `after_id`, `limit` (default 50, clamped to `1 <= limit <= 200`; the service cap allows 201 so the boundary survives the maximum page size); calls `findAll` with `limit + 1`; returns the first `limit` rows and sets meta `{ next_cursor: last returned row id or undefined, has_more: rows.length > limit }` through `setResponseMeta` exactly like `logs.controller.ts:99-103`. |
| `GET /:id` | `get-notifications-module-notification` | 404 through `NotificationsNotFoundException`. |
| `PATCH /:id` | `update-notifications-module-notification` | `UpdateNotificationDto { read?: boolean; dismissed?: boolean }` wrapped in `ReqUpdateNotificationDto { data }`. |
| `DELETE /:id` | `delete-notifications-module-notification` | 204. |
| `POST /bulk-update` | `bulk-update-notifications-module-notifications` | `BulkUpdateNotificationsDto { ids: string[]; read?: boolean; dismissed?: boolean }` -> `runBulkOperation(ids, perform, { fallbackReason, safeErrors: [NotificationsException], logger })` -> `CommonDataBulkResult`. |
| `POST /bulk-remove` | `bulk-remove-notifications-module-notifications` | `BulkRemoveNotificationsDto { ids: string[] }`. |

Response models: `NotificationResponseModel` (`NotificationsModuleResNotification`),
`NotificationsResponseModel` (`NotificationsModuleResNotifications`), and a module-local
`BulkResultResponseModel` (`@ApiSchema({ name: 'NotificationsModuleResBulkResult' })`) wrapping the shared
`BulkResultModel` from `modules/api/models/bulk.model.ts`, the per-module pattern of
`devices-response.model.ts:195`.

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "REST API" section) and
  plan (`docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-2 section) in full before making
  any code changes.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
