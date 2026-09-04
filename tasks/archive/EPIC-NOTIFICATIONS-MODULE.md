# Epic: System Notifications Module

ID: EPIC-NOTIFICATIONS-MODULE
Type: epic
Scope: backend, admin
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to know what needs attention across the system without opening the logs view and filtering through it,
As a Smart Panel administrator,
I want one place - an in-admin bell and notifications page, optionally forwarded to Discord, Slack, Telegram or a generic webhook - that surfaces integration failures, managed service failures, available updates, failed logins and other conditions with a severity, a source, an optional call to action, and a read/dismiss lifecycle.

## 2. Context

**Problem statement:**

- `SystemLoggerService` keeps a 2000-entry ring buffer and `GET /logs` exposes it, but nothing turns a
  `logger.warn('Failed login attempt ...')` (`auth.service.ts:102`) or a readiness-retry failure
  (`managed-service-manager.service.ts:814`) into something the administrator actually sees.
- The only existing ad-hoc notification is `update-notification-badge.vue`, hard-wired into
  `app-top-bar.vue:22`, driven by its own composable; every further condition would need its own bespoke
  badge.
- The Buddy messaging plugins (`buddy-discord`, `buddy-telegram`, `buddy-whatsapp`) each listen to
  `SUGGESTION_CREATED` and format and send independently - there is no shared outbound-message contract.
- The Security module models home-safety alerts (smoke, intrusion, CO) with its own acknowledgement
  lifecycle, but those alerts reach only the admin UI over REST; a smoke alert cannot reach a phone.

**Prior art summary** (full comparison in the spec):

- Home Assistant `persistent_notification`: caller-supplied dedupe key, create-is-upsert, websocket sends a
  snapshot then deltas - the shape adopted for live updates; it has no severity and is not persisted, which
  we need for a failed-login history that survives a restart.
- Home Assistant Repairs / issue registry: persisted, keyed `(domain, issue_id)`, a severity enum,
  `is_persistent`, boot-time clearing of non-persistent issues - the direct model for this module's `issue`
  kind. Its multi-step fix flows are not adopted; a CTA points at extension actions or managed-service
  endpoints that already exist instead of a new flow engine.
- Home Assistant `notify`: per-integration channel entities that are never auto-forwarded, leaving the user to
  write an automation - rejected as the default; a channel plugin here is enabled and configured once, with a
  per-channel minimum severity.
- Nextcloud Notifications: actions as declarative data pointing at existing endpoints, with a `primary` flag -
  adopted for the `actions` field. Its per-user state and ETag polling are not needed for a single-household
  hub, so read/dismiss state is global.
- Grafana/Proxmox contact points and Uptime Kuma's ~90 providers: one small interface per destination type
  plus a Test action - the shape adopted for `INotificationChannel`, `BaseNotificationChannel` and the
  `send-test` extension action every channel plugin registers. A full routing tree is deferred.

**Design and plan documents (source of truth for every child task):**

- Spec: `docs/superpowers/specs/2026-09-02-notifications-module-design.md`
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`

**Existing code references:**

- `apps/backend/src/modules/extensions/services/extension-action-registry.service.ts` - the register /
  duplicate-throws registry pattern that `NotificationChannelRegistryService` follows.
- `apps/backend/src/modules/extensions/controllers/services.controller.ts` - the managed-service status and
  restart endpoints a `service` call-to-action executes against.
- `apps/backend/src/modules/websocket/gateway/websocket.gateway.ts` - the gateway and its
  `EXCHANGE_ONLY_EVENT_PREFIXES` list, which the notifications events are added to so displays never receive
  them.
- `apps/admin/src/modules/system/components/system-info/update-notification-badge.vue` - the one existing
  ad-hoc notification, mounted in `apps/admin/src/common/components/app-top-bar.vue:22`, removed once the
  update-available emitter and the bell ship.

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/885 (milestone "Notifications module"); child issues are linked in the table below.

## 3. Scope

**In scope**

- One core, `@Global()` `notifications` module owning persistence, REST, websocket push and dispatch - not a
  plugin. Every channel plugin needs the stored record anyway, and the admin bell must work with no plugin
  enabled.
- One entity with two kinds: `event` rows (records, e.g. a failed login) and `issue` rows (conditions with a
  key that the source resolves when the condition clears).
- Calls to action as data pointing at endpoints that already exist: `link`, `extension_action`
  (`POST /extensions/:type/actions/:actionId`), or `service` (`POST /extensions/services/:kind/:type/:id/restart`).
  The module executes nothing itself, so it introduces no new permission model.
- A channel registry and dispatcher: plugins register an `INotificationChannel`; the core applies the
  per-channel filter, timeout, retry and loop guard once.
- Forwarding is explicit and off by default; each channel has a `min_severity`. No routing tree in the first
  release.
- Global (not per-user) read and dismiss state; owner- and admin-only REST and websocket access, because
  displays authenticate as `UserRole.USER` and notifications routinely contain IPs and service names.
- Plain-text English content; no new runtime dependencies (channels use the global `fetch`).
- First emitters: update available, update install failed, managed service error, failed login (batch 1);
  Home Assistant connection loss, storage memory fallback, throttling flags, security alert bridge, and
  channel delivery failure (batch 2).
- Four channel plugins: generic webhook, Discord, Slack, Telegram.
- Admin bell, notifications page, CTA execution for all three action types, module config form, six locales.
- Extension SDK types and developer documentation.

**Out of scope**

- Translation keys with placeholders for backend-authored notifications (a documented follow-up; `data`
  already carries the placeholders so no schema change is needed later).
- Per-user read state, snooze, and "resolved" deliveries to channels.
- Routing rules by source or a routing tree; e-mail (needs an SMTP dependency); ntfy and Pushover channels.
- A `notifications-panel` channel plugin that surfaces critical notifications on displays - the panel app is
  out of scope entirely for this epic.
- Health-poll based "service unhealthy" issues, pending a polling loop in the service manager.
- Interactive fix flows - the interactive-session epic (`EPIC-EXTENSION-ACTIONS`) covers that surface.
- Turning error-level log lines into notifications automatically; too noisy without a dedupe model.

## 4. Acceptance criteria

- [x] Emitters can raise and resolve `event` and `issue` notifications through
      `NotificationsService.notify/resolve/resolveAll` with the full lifecycle table from the spec (upsert,
      `occurrences`, read/dismissed clearing rules, boot cleanup for non-persistent issues).
- [x] `GET/PATCH/DELETE /notifications`, `POST /notifications/bulk-update` and `POST /notifications/bulk-remove`
      are guarded to owner and admin and documented in the OpenAPI spec.
- [x] Websocket `NotificationsModule.Notification.Created/Updated/Deleted` events reach only the admin exchange
      room, never displays.
- [x] A channel plugin registers with `NotificationChannelRegistryService` and receives dispatched
      notifications with per-channel severity filter, timeout, retry and a self-reported `delivery-failed`
      issue on repeated failure.
- [x] Update available, update install failed, managed service error and failed login raise and resolve
      notifications as specified, and `update-notification-badge.vue` is removed in favour of the
      update-available notification.
- [x] Home Assistant connection loss, the storage memory fallback, Raspberry Pi throttling flags and security
      alerts raise and resolve notifications as specified.
- [x] The admin bell shows an unread badge and a severity-coloured icon, and its popover lists active
      notifications sorted by severity then recency with a primary CTA.
- [x] The `/notifications` admin page supports filtering, bulk mark read/unread/dismiss/delete, and a detail
      drawer that executes all three CTA types (`link`, `extension_action`, `service`).
- [x] Webhook, Discord, Slack and Telegram channel plugins send correctly shaped payloads, redact their
      secrets through `secretFields`, and each ship a `send-test` extension action.
- [x] Retention (`retention_days`) and the active-event cap (`max_notifications`) are enforced by a daily job
      and configurable through `GET/PATCH /config/module/notifications-module`.
- [x] The extension SDK exports the notification types and `docs/notifications.md` documents the emitter and
      channel contracts.

## 5. Child tasks

### Phase 1: Backend Core

| ID | Title | Scope | Size | Status | Issue |
|----|-------|-------|------|--------|-------|
| FEATURE-NOTIFICATIONS-BACKEND-CORE | Notifications module domain and storage | backend | medium | done | #886 |
| FEATURE-NOTIFICATIONS-BACKEND-API | Notifications REST and websocket surface | backend | small | done | #887 |
| FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH | Notification channel registry and dispatcher | backend | medium | done | #888 |

### Phase 2: Admin

| ID | Title | Scope | Size | Status | Issue |
|----|-------|-------|------|--------|-------|
| FEATURE-NOTIFICATIONS-ADMIN-BELL | Admin notifications store and bell | admin | medium | done | #890 |
| FEATURE-NOTIFICATIONS-ADMIN-PAGE | Admin notifications page and CTA execution | admin | medium | done | #891 |
| FEATURE-NOTIFICATIONS-ADMIN-LOCALES | Notifications module translations | admin | tiny | done | #892 |

### Phase 3: Emitters

| ID | Title | Scope | Size | Status | Issue |
|----|-------|-------|------|--------|-------|
| FEATURE-NOTIFICATIONS-EMITTERS-CORE | Core emitters: updates, service failures, failed logins | backend | small | done | #889 |
| FEATURE-NOTIFICATIONS-EMITTERS-INTEGRATIONS | Integration, storage, throttling and security emitters | backend | medium | done | #895 |

### Phase 4: Channels

| ID | Title | Scope | Size | Status | Issue |
|----|-------|-------|------|--------|-------|
| FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD | Webhook and Discord notification channels | backend, admin | medium | done | #893 |
| FEATURE-NOTIFICATIONS-CHANNEL-SLACK-TELEGRAM | Slack and Telegram notification channels | backend, admin | small | done | #894 |

### Phase 5: Docs & SDK

| ID | Title | Scope | Size | Status | Issue |
|----|-------|-------|------|--------|-------|
| FEATURE-NOTIFICATIONS-SDK-DOCS | Notifications SDK types and documentation | backend, admin | small | done | #896 |

## 6. Technical constraints

- Never edit generated files: `spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`, `apps/panel/lib/api/`.
  All three outputs are gitignored and regenerated in CI. Change the Swagger sources and run
  `pnpm run generate:openapi` to validate; commit nothing generated.
- Tabs, single quotes, semicolons, trailing commas; print width 120 (backend) and 150 (admin); external
  imports first, then `../`, then `./`, with a blank line between groups.
- Swagger decorators before NestJS decorators; every action has `@ApiOperation` with `tags`, `summary`,
  `description`, `operationId`; responses wrapped in `*ResponseModel`; schema names follow
  `NotificationsModuleData*`, `NotificationsModuleRes*`, `NotificationsModuleReq*`,
  `NotificationsModule<Action><Entity>`.
- Every notifications route is `@Roles(UserRole.OWNER, UserRole.ADMIN)`.
- Bootstrap hooks that touch the database run inside `try/catch`; CI and `generate:openapi` boot the app
  against an unmigrated database, so reproduce with `FB_DB_PATH=$(mktemp -d) pnpm run generate:openapi`
  (must exit 0).
- New migration only: `apps/backend/src/migrations/1000000000025-AddNotifications.ts`; never touch the
  initial migration.
- Backend CI lint is three scripts: `lint:js`, `lint:api`, `lint:openapi`. `lint:api` requires data models'
  `@ApiSchema` names to contain `Data` unless the name contains `Res` or `Req` or the file is under `/dto/`.
- Admin isolated test runs use `npx vitest run <path>` from `apps/admin` (the CLI filter flag is a no-op);
  the type check is `pnpm --filter ./apps/admin run type-check`; prettier is scoped to touched files. Admin
  tests use `@vue/test-utils`, not `@testing-library/vue`.
- Bulk endpoints are one request through `runBulkOperation` with `safeErrors` declared; confirmation and the
  request itself live in separate `try` blocks in the admin.
- No secrets in notification `title`, `message` or `data`; channel secrets go through `secretFields`.
- `FEATURE-NOTIFICATIONS-EMITTERS-CORE` (N-4) depends directly on `FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH`
  (N-3), not only on Phase 1 completing in general: its managed-service emitter sanitizes `lastError` through
  `sanitizeErrorMessage`, which N-3 provides.
- PR titles are `<type>(<scope>): <subject>` with a lowercase subject, <= 100 characters; never push to
  `main`.

## 7. AI instructions

- Read `docs/superpowers/specs/2026-09-02-notifications-module-design.md` and
  `docs/superpowers/plans/2026-09-02-notifications-module.md` in full before implementing any child task.
- Read this epic and the specific child task file before starting that task.
- Implement phases in order: Phase 1 (`FEATURE-NOTIFICATIONS-BACKEND-CORE` ->
  `FEATURE-NOTIFICATIONS-BACKEND-API` -> `FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH`) first, since the API task
  gates the admin lane and the dispatcher task gates the channels lane. After Phase 1 merges, Phase 2, Phase 3
  and Phase 4 can proceed in parallel lanes, followed by Phase 5.
- One PR per child task; use the exact PR title given in that task's Technical constraints section (copied
  from the plan's delivery table).
- Do not broaden scope, touch files owned by another in-flight task, edit generated files by hand, or commit
  to `main`.
- Start each task by replying with a short implementation plan.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
