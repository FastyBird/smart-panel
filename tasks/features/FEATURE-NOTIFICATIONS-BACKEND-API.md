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
- Cursor pagination and response-meta pattern to mirror: `logs.controller.ts:99-103` (`GET /logs`'s
  `setResponseMeta` usage).
- Bulk endpoint pattern to mirror: `runBulkOperation` and `CommonDataBulkResult`, reusing
  `BulkResultResponseModel` from `modules/api/models/bulk.model.ts` - one request per bulk action, with
  `safeErrors` declared.
- Websocket gateway: `apps/backend/src/modules/websocket/gateway/websocket.gateway.ts`, in particular the
  `EXCHANGE_ONLY_EVENT_PREFIXES` static list and `EXCHANGE_ROOM`, which keeps admin-only events away from
  display clients (displays authenticate as `UserRole.USER`). Extend the existing
  `SystemModule.System.Update.*` gateway spec pattern for the new prefix.
- After this task, `pnpm run generate:openapi` must be run and the regenerated `spec/api/v1/openapi.json`
  and `apps/panel/lib/api/**` committed - never hand-edit them (see `CLAUDE.md` "Generated Code").

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/887 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- `NotificationsController` with `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /bulk-update`,
  `POST /bulk-remove`, all `@Roles(UserRole.OWNER, UserRole.ADMIN)`.
- `UpdateNotificationDto`, `BulkUpdateNotificationsDto`, `BulkRemoveNotificationsDto` and their `Req*`
  wrappers.
- `NotificationResponseModel` / `NotificationsResponseModel` response models, reusing
  `BulkResultResponseModel`.
- Adding `'NotificationsModule.'` to `EXCHANGE_ONLY_EVENT_PREFIXES` in `websocket.gateway.ts`.
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
      `active`), `severity` (repeatable), `source`, `kind`, `unread`, `after_id`, `limit` and calls
      `findAll`, ordered by `created_at DESC`.
- [ ] `GET /notifications` sets response meta `{ next_cursor, has_more }` through `setResponseMeta`, matching
      the pattern in `logs.controller.ts:99-103`.
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
- [ ] e2e: as an owner token, create rows through the service, then list active, patch read, bulk dismiss and
      bulk remove through the REST endpoints.
- [ ] e2e: every notifications route returns 403 for a `USER`-role token and for a display token.
- [ ] e2e: the migration applies cleanly on a fresh database.
- [ ] `'NotificationsModule.'` is added to `EXCHANGE_ONLY_EVENT_PREFIXES` in `websocket.gateway.ts`, and a
      gateway spec proves a `NotificationsModule.Notification.Created` event reaches `EXCHANGE_ROOM` only
      (extending the existing `SystemModule.System.Update.*` test).
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
| `GET /` | `get-notifications-module-notifications` | Parses `status`, `severity` (repeatable), `source`, `kind`, `unread`, `after_id`, `limit`; calls `findAll`; sets meta `{ next_cursor, has_more }` through `setResponseMeta` exactly like `logs.controller.ts:99-103`. |
| `GET /:id` | `get-notifications-module-notification` | 404 through `NotificationsNotFoundException`. |
| `PATCH /:id` | `update-notifications-module-notification` | `UpdateNotificationDto { read?: boolean; dismissed?: boolean }` wrapped in `ReqUpdateNotificationDto { data }`. |
| `DELETE /:id` | `delete-notifications-module-notification` | 204. |
| `POST /bulk-update` | `bulk-update-notifications-module-notifications` | `BulkUpdateNotificationsDto { ids: string[]; read?: boolean; dismissed?: boolean }` -> `runBulkOperation(ids, perform, { fallbackReason, safeErrors: [NotificationsException], logger })` -> `CommonDataBulkResult`. |
| `POST /bulk-remove` | `bulk-remove-notifications-module-notifications` | `BulkRemoveNotificationsDto { ids: string[] }`. |

Response models: `NotificationResponseModel` (`NotificationsModuleResNotification`),
`NotificationsResponseModel` (`NotificationsModuleResNotifications`), and reuse `BulkResultResponseModel`
from `modules/api/models/bulk.model.ts`.

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "REST API" section) and
  plan (`docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-2 section) in full before making
  any code changes.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
