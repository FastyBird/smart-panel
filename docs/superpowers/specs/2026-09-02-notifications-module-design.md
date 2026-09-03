# System Notifications Module — Design

**Status:** Draft, awaiting review

**Date:** 2026-09-02

**Author:** Adam Kadlec (drafted with Claude)

**Related task:** `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md` (GitHub epic https://github.com/FastyBird/smart-panel/issues/885)

**Implementation plan:** `docs/superpowers/plans/2026-09-02-notifications-module.md`

## Goal

Give the administrator one place where the system tells them what needs attention: an integration lost its
connection, a managed service failed, an update is available, somebody failed to log in. Each notification
carries a severity, a source, an optional call to action (restart the service, open the update page), and a
read/dismiss lifecycle. The same notifications can be forwarded to external channels (Discord, Slack,
Telegram, a generic webhook) through plugins the administrator enables and configures.

Today these conditions only exist as log lines. The operator has to open the logs view, filter and paginate
to discover them, and nothing tells them when a condition has cleared.

## Problem statement

- `SystemLoggerService` keeps a 2000-entry ring buffer and `GET /logs` exposes it. Nothing turns a
  `logger.warn('Failed login attempt ...')` (`auth.service.ts:102`) or a "readiness retry failed"
  (`managed-service-manager.service.ts:814`) into something the administrator sees on the dashboard.
- The admin already has one ad-hoc notification: `update-notification-badge.vue`, hard-wired into
  `app-top-bar.vue:22`, driven by its own composable. Every further condition would need its own badge.
- The Buddy messaging plugins (`buddy-discord`, `buddy-telegram`, `buddy-whatsapp`) each listen to
  `SUGGESTION_CREATED` and format and send independently. There is no shared outbound-message contract, so a
  second consumer would copy the pattern three more times.
- The Security module models home-safety alerts (smoke, intrusion, CO) with its own acknowledgement
  lifecycle, but those alerts reach only the admin UI over REST. A smoke alert cannot reach a phone.

## Prior art

| System | What it does | What transfers | What does not |
| --- | --- | --- | --- |
| Home Assistant `persistent_notification` | In-memory `{notification_id, title, message, created_at}`; create with an existing id replaces; dismiss deletes; websocket `subscribe` sends `current` then `added/updated/removed`. | Caller-supplied dedupe key; create-is-upsert; push a snapshot then deltas. | No severity, no read state, not persisted. Our operator history (failed logins) must survive a restart. |
| Home Assistant Repairs / issue registry | Persisted `IssueEntry` keyed by `(domain, issue_id)`, `severity ∈ {critical, error, warning}`, `is_fixable`, `is_persistent`, `dismissed_version`, `learn_more_url`, `data`. Integrations delete the issue when the condition clears; non-persistent issues are inactive until re-created on the next boot; a fix flow deletes the issue when it completes. | Issues are *state*, not events. Two independent resolutions: the source clears it, or the user fixes it. Non-persistent issues clear at boot so stale conditions cannot linger. Keep `data` out of list payloads. | Fix flows are multi-step wizards. Smart Panel already has extension actions and managed-service controls; a CTA can point at those instead of a new flow engine. |
| Home Assistant `notify` | Per-integration channel entities with `send_message(message, title)`; Discord needs a bot token, Slack a bot token plus channel. HA never auto-forwards persistent notifications or repairs to channels; the user writes an automation. | Channel config is per plugin, never a shared flat schema. | Requiring hand-written automations is the wrong default for a hub whose administrator wants "tell me on Discord when something breaks". |
| Nextcloud Notifications | `{app, object_type, object_id, subject, message, link, actions[{label, link, type, primary}]}`; an action is a declarative HTTP call the client issues itself; `markProcessed` deletes by `(app, object)`. | Actions as data pointing at existing endpoints, `primary` flag, per-source dedupe by object. | Per-user notifications and ETag polling are more than a single-household hub needs. |
| Grafana contact points, Proxmox targets and matchers | Typed destinations plus explicit routing rules (severity, labels) and a Test button per destination. | Routing is an explicit, typed, off-by-default rule. Every configured channel gets a test action. | A routing tree is overkill; a minimum severity per channel covers the realistic cases. |
| Uptime Kuma providers | ~90 provider classes with one abstract `send()` and a shared base. | One small interface, one base class, per-provider config. | |

## Product decisions

1. **One core module, `notifications`, owns persistence, REST, websocket push and dispatch.** The in-admin
   experience is not a plugin. Every channel plugin needs the stored record anyway (for the link back, for
   dedupe, for retry), and the admin bell must work on a fresh install with no plugin enabled.
2. **One entity, two kinds.** `event` rows are records (a failed login happened); `issue` rows are
   conditions with a key that the source resolves when the condition clears (the integration is
   disconnected). This is Home Assistant's two systems collapsed into one table, because the admin UI,
   REST, websocket and channel dispatch are identical for both.
3. **Calls to action are data that point at endpoints that already exist.** A CTA is a `link`, an
   `extension_action` (`POST /extensions/:type/actions/:actionId`, with its `dangerous` confirmation and
   `requiredRoles`), or a managed `service` operation (`POST /extensions/services/:kind/:type/:id/restart`).
   The notifications module executes nothing itself, so it introduces no new permission model and survives a
   restart without in-memory callbacks.
4. **Channels are plugins that register a provider with a core registry.** The core applies the per-channel
   filter, timeout, retry and loop guard once. Plugins only format and send.
5. **Forwarding is explicit and off by default.** A channel plugin delivers nothing until it is enabled and
   configured, and each channel has a `min_severity`. No routing tree in the first release.
6. **Global read and dismiss state.** A household hub has one or two administrators; per-user state (Nextcloud)
   doubles the storage and API surface for no visible benefit. Rows carry `read_at` and `dismissed_at`.
7. **Owner and admin only.** Displays authenticate with a token that resolves to `UserRole.USER`, so every
   endpoint is guarded with `@Roles(UserRole.OWNER, UserRole.ADMIN)` and websocket events use the admin-only
   exchange prefix list. Notifications routinely contain IP addresses and service names.
8. **Plain-text English content in the first release.** Extension actions, extension metadata and logs are
   already backend-authored English. Translation keys with placeholders (Nextcloud rich subjects, HA
   `translation_key`) are a documented follow-up; the entity does not need a schema change to add them
   because `data` already carries the placeholders.
9. **No new runtime dependencies.** Discord, Slack and Telegram channels use incoming webhooks or the Bot
   HTTP API through the global `fetch` with `AbortSignal.timeout`. The Buddy bots (discord.js, telegraf,
   baileys) stay untouched; a notification channel must not depend on Buddy being enabled.
10. **Panel is out of scope.** A `notifications-panel` channel plugin that pushes critical notifications to a
    display is a natural follow-up and fits the plugin contract without changes to the core.

## Concepts

### Notification

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `source` | string | Extension type of the emitter, e.g. `system-module`, `devices-home-assistant-plugin`. Shown as the origin and used for dedupe and `resolveAll`. |
| `kind` | `event` \| `issue` | See lifecycle below. |
| `key` | string \| null | Required for `issue`, optional for `event`. Unique per `source` among rows with `resolved_at IS NULL` (partial unique index). |
| `severity` | `info` \| `warning` \| `error` \| `critical` | `info`: FYI. `warning`: degraded, no action needed now. `error`: broken, action needed. `critical`: safety or security, immediate. Channels filter on it. |
| `title` | string ≤ 120 | Plain text. |
| `message` | string ≤ 1000 \| null | Plain text; newlines allowed. |
| `actions` | `NotificationAction[]` ≤ 3 | JSON column. See actions below. |
| `data` | object \| null | JSON column, flat `Record<string, string \| number \| boolean \| null>`, ≤ 4 KB serialized. Shown as a key/value table in the detail drawer; never used for logic by the core. |
| `persistent` | boolean | Issues only. `false` (default): resolved automatically at boot; the source re-raises if the condition still holds. `true`: survives boot untouched (e.g. "last update failed", which nothing re-detects). |
| `occurrences` | integer | Starts at 1; incremented on every upsert of the same `(source, key)`. |
| `read_at`, `dismissed_at`, `resolved_at` | timestamp \| null | Lifecycle marks. |
| `created_at`, `updated_at` | timestamp | `updated_at` moves on every upsert. |

### Lifecycle

| | `event` without key | `event` with key | `issue` |
| --- | --- | --- | --- |
| `notify()` | Inserts a row. | Upserts: `occurrences + 1`, replaces title/message/severity/actions/data, clears `read_at` and `dismissed_at` (re-opens the aggregation). | Upserts: `occurrences + 1`, replaces fields; keeps `read_at` and `dismissed_at` (a dismissed issue stays hidden while the condition persists). |
| `resolve(source, key)` | Not applicable, logged and ignored. | Sets `resolved_at` (closes the aggregation window; the next `notify()` starts a new row). | Sets `resolved_at`. |
| Boot | Untouched. | Untouched. | `resolved_at = now` for rows with `persistent = false` and `updated_at < bootStartedAt`. Sources re-raise during their own startup. |
| User dismiss | `dismissed_at`. | `dismissed_at`; cleared by the next upsert. | `dismissed_at`; stays until resolved. For a `persistent` issue the dismissal also sets `resolved_at`, because the source declared that nothing re-detects the condition, so the dismissal is the only way it ends; un-dismissing it (`dismissed: false`) clears `dismissed_at` but leaves `resolved_at` in place, so it stays in history. |
| Retention | Deleted `retention_days` after `dismissed_at`. | Deleted `retention_days` after the later of `dismissed_at` and `resolved_at`, once at least one is set. | Deleted only once resolved: `resolved_at` set and the later of `resolved_at` and `dismissed_at` older than `retention_days`. A dismissed but unresolved issue is kept, because the dismissal must keep hiding the source's re-raises. |
| Channel delivery | On insert. | On insert only (later upserts update in-app only, which keeps repeated failures from spamming Discord). | On insert only. |

The boot rule compares `updated_at` with a `bootStartedAt` timestamp captured when `NotificationsService`
is constructed. That makes the cleanup independent of module initialisation order: an emitter that raises an
issue inside its own `onModuleInit` before the cleanup runs produces a row newer than `bootStartedAt`, which
the cleanup leaves alone.

"Active" means `dismissed_at IS NULL AND resolved_at IS NULL`. The bell badge counts active rows with
`read_at IS NULL`.

### Actions

```ts
type NotificationAction =
	| { type: 'link'; label: string; url: string; primary?: boolean }
	| {
			type: 'extension_action';
			label: string;
			extension_type: string;
			action_id: string;
			params?: Record<string, string | number | boolean>;
			primary?: boolean;
	  }
	| {
			type: 'service';
			label: string;
			extension_kind: 'module' | 'plugin';
			extension_type: string;
			service_id: string;
			operation: 'start' | 'stop' | 'restart';
			primary?: boolean;
	  };
```

- `link.url` is either an admin-relative path (`/system/info`, resolved with `router.push`) or an absolute
  `http(s)` URL (opened in a new tab). Any other scheme is rejected at `notify()`.
- `extension_action` is executed by the admin through the existing extensions composable
  (`useActions().executeAction`), which posts directly. The backend applies the action's `requiredRoles`; the
  notification composable itself fetches the action descriptors and shows the confirmation dialog when the action
  is `dangerous`, and always confirms `service` stop and restart. It fails closed: when the descriptors cannot
  be fetched or none matches `action_id`, it reports an error and executes nothing.
- `service` is executed through the existing managed-services composable and endpoints.
- Executing an action never changes the notification. The source resolves the issue when it observes the
  effect (the service reports `started`, the update is installed). A CTA that failed leaves the issue in
  place, which is the truthful state.
- At most one action carries `primary: true`; it renders as the button in the bell popover.

### Validation rules in `notify()`

`notify()` never throws to its caller. It truncates `title` and `message` to their limits, drops actions beyond
the third, and rejects (one `warn` log, returns `null`) when: `kind === 'issue'` without `key`; `source`
is empty; `severity` is not in the enum; an action has an unknown `type` or a `link` with a disallowed
scheme; `data` exceeds 4 KB or is not flat. It also returns `null` when the database write fails, so an
emitter inside a reconnect loop cannot be taken down by the notifications module.

### Rate guard and caps

- Per source, at most 60 `notify()` calls per rolling minute. Calls beyond that are dropped with one `warn`
  per source per minute. Upserts of an existing key count too.
- `max_notifications` (module config, default 500) bounds active `event` rows. When exceeded, the oldest
  read events are deleted first, then the oldest unread events. Issues are never evicted by the cap; they are
  bounded by their sources.
- `retention_days` (module config, default 30) drives a daily job that deletes dismissed and resolved rows.

## Backend architecture

```
apps/backend/src/modules/notifications/
├── notifications.module.ts          @Global(); registers config mapping, Swagger models, extension metadata
├── notifications.constants.ts       NOTIFICATIONS_MODULE_NAME/PREFIX/API_TAG, EventType, enums, limits
├── notifications.openapi.ts         NOTIFICATIONS_SWAGGER_EXTRA_MODELS
├── controllers/notifications.controller.ts
├── dto/update-notification.dto.ts, bulk-update-notifications.dto.ts, bulk-remove-notifications.dto.ts, update-config.dto.ts
├── entities/notifications.entity.ts
├── models/notification.model.ts, notification-action.model.ts, notifications-response.model.ts, config.model.ts
├── platforms/notification-channel.platform.ts   INotificationChannel + BaseNotificationChannel
├── services/
│   ├── notifications.service.ts           notify/resolve/resolveAll/find/markRead/dismiss/remove, validation, rate guard
│   ├── notifications-retention.service.ts boot cleanup, daily prune, cap enforcement
│   ├── notification-channel-registry.service.ts
│   └── notification-dispatcher.service.ts filter, timeout, retry, loop guard, delivery-failure self-report
└── notifications.exceptions.ts
```

- The module is `@Global()` and exports `NotificationsService` and `NotificationChannelRegistryService`, the
  same way `ExtensionsModule` exports `ExtensionActionRegistryService`. Emitters inject `NotificationsService`
  without adding `NotificationsModule` to their `imports`, so no `forwardRef` is introduced.
- Config: `NotificationsConfigModel extends ModuleConfigModel` with `retention_days` (1–365, default 30) and
  `max_notifications` (50–5000, default 500), registered through `ModulesTypeMapperService.registerMapping`.
  Read and updated through the existing `GET/PATCH /config/module/notifications-module`.
- Migration: `apps/backend/src/migrations/1000000000025-AddNotifications.ts` creating
  `notifications_module_notifications` with the partial unique index
  `(source, key) WHERE key IS NOT NULL AND resolved_at IS NULL` and indexes on `created_at`, `dismissed_at`,
  `resolved_at`.
- Websocket: the module emits `NotificationsModule.Notification.Created`, `.Updated` and `.Deleted` through
  `EventEmitter2`; the gateway bridges them. `'NotificationsModule.'` is listed in a new
  `ADMIN_ONLY_EVENT_PREFIXES` in `websocket.gateway.ts`, so displays never receive them. Payloads are thin
  pointers, following the config-change precedent: `{ id, kind, severity, source }` for Created and Updated,
  `{ id }` for Deleted. Clients fetch the row through the guarded REST endpoint. Because `subscribe-exchange`
  admits any authenticated socket today, the gateway delivers admin-only prefixes only to the exchange sockets
  whose principal is a user with the owner or admin role (an `ADMIN_ROOM` joined at handshake), with negative
  tests for a `USER`-role socket and a display socket. Restricting `subscribe-exchange` itself is a follow-up.
- Boot safety: the retention service runs the boot cleanup in `onApplicationBootstrap` inside `try/catch`
  and logs on failure, because CI and `generate:openapi` boot the app against an unmigrated database.
- Extension metadata is registered with `ExtensionsService.registerModuleMetadata` so the module appears in
  the Extensions catalogue; `notifications-module` is added to `NON_TOGGLEABLE_MODULES`.

### REST API

The controller is `@Controller('notifications')` inside the module mounted at `/api/modules/notifications`, so
the full paths are `/api/modules/notifications/notifications`, `/api/modules/notifications/notifications/{id}`
and so on, the same shape as `/api/modules/extensions/extensions`. The table lists controller-relative routes.
All routes `@Roles(UserRole.OWNER, UserRole.ADMIN)`.

| Method and path | operationId | Notes |
| --- | --- | --- |
| `GET /notifications` | `get-notifications-module-notifications` | Query: `status` (`active` default, `dismissed`, `resolved`, `all`), `severity` (repeatable), `source`, `kind`, `unread` (boolean), `after_id`, `limit` (default 50, min 1, max 200; the service accepts `limit + 1` rows so the boundary survives the maximum page size). Total order `created_at DESC, id DESC`; `after_id` is the id of the last row the client holds and the page continues after that row in the total order, so equal timestamps are disambiguated by id. The controller fetches `limit + 1` rows to set meta `has_more` and `next_cursor` (the id of the last returned row), the response shape of `GET /logs`. |
| `GET /notifications/:id` | `get-notifications-module-notification` | |
| `PATCH /notifications/:id` | `update-notifications-module-notification` | Body `{ data: { read?: boolean, dismissed?: boolean } }`. |
| `DELETE /notifications/:id` | `delete-notifications-module-notification` | Removes the row. Sources are not told; an issue whose condition persists is re-raised by the source. |
| `POST /notifications/bulk-update` | `bulk-update-notifications-module-notifications` | Body `{ data: { ids, read?, dismissed? } }`, returns `CommonDataBulkResult` through `runBulkOperation`. |
| `POST /notifications/bulk-remove` | `bulk-remove-notifications-module-notifications` | Body `{ data: { ids } }`. |

Schema names follow the convention: `NotificationsModuleDataNotification`, `NotificationsModuleDataNotificationAction`,
`NotificationsModuleResNotification`, `NotificationsModuleResNotifications`, `NotificationsModuleUpdateNotification`,
`NotificationsModuleReqUpdateNotification`, `NotificationsModuleBulkUpdateNotifications`,
`NotificationsModuleReqBulkUpdateNotifications`, `NotificationsModuleBulkRemoveNotifications`,
`NotificationsModuleReqBulkRemoveNotifications`, `NotificationsModuleDataConfig`, `NotificationsModuleUpdateConfig`.

### Emitter contract

```ts
interface CreateNotificationInput {
	source: string;
	kind: NotificationKind;              // 'event' | 'issue'
	key?: string;                        // required for 'issue'
	severity: NotificationSeverity;      // 'info' | 'warning' | 'error' | 'critical'
	title: string;
	message?: string;
	actions?: NotificationAction[];
	data?: Record<string, string | number | boolean | null>;
	persistent?: boolean;                // issues only, default false
}

class NotificationsService {
	notify(input: CreateNotificationInput): Promise<NotificationEntity | null>;
	resolve(source: string, key: string): Promise<boolean>;   // true when a row was resolved
	resolveAll(source: string): Promise<number>;              // when a plugin is disabled or stopped; dismissed rows included
}
```

Rules for emitters:

- Use the extension type constant as `source` (`SYSTEM_MODULE_NAME`, `DEVICES_HOME_ASSISTANT_PLUGIN_NAME`).
- Raise an issue when a condition starts and resolve it when it ends; do not raise on every retry tick.
- Prefer a `service` or `extension_action` CTA over a `link` when the administrator can actually fix it.
- A managed service should call `resolveAll(source)` in `stop()` so disabling a plugin clears its issues.
- Never include secrets or tokens in `title`, `message` or `data`; the payload reaches every configured
  channel. Pass operational error text (a service's `lastError`, an HTTP error) through
  `sanitizeErrorMessage()` from the notifications module before using it as `message`: it reduces every URL to
  `scheme://host` (which also removes Telegram bot tokens and Slack or Discord webhook paths), masks bearer tokens
  and `token=` / `key=` / `password=` / `secret=` values, collapses whitespace and truncates to 300 characters.

### First emitters

The inventory of conditions that today end only in a log line is long (see the plan). The first release
wires the emitters below; the generic managed-service emitter alone covers every runtime that sets
`state = 'error'` today: the Home Assistant socket without an API key, InfluxDB v1/v2 connection failures,
the rotating-file logger with an unwritable directory, and the mDNS advertisement.

**Batch 1 (first emitter change, right after the core):**

| Emitter | Location | Kind, key, severity | CTA | Resolves when |
| --- | --- | --- | --- | --- |
| Update available | `system/services/update.service.ts` after the scheduled (12 h cron) and manual checks | `issue`, `update-available`, `info` | `link` → `/system/info` | The check reports no update or the update is installed. Replaces `update-notification-badge.vue` in the top bar. |
| Update install failed | `system/services/update-executor.service.ts` when the run reaches `FAILED` | `issue`, `update-failed`, `error`, `persistent: true` | `link` → `/system/info` | The next run succeeds, or the user dismisses. |
| Managed service in `error` | `extensions/services/managed-service-manager.service.ts` where a service enters `error` (start failure, readiness retries exhausted at `:795`) and where it re-enters `started` | `issue`, `service:<kind>:<type>:<serviceId>`, `error`; `message` carries the service's `lastError` | `service` restart (primary), `link` → `/extensions?tab=services&kind=<kind>` | The service reports `started`. |
| Failed login | `auth/services/auth.service.ts` failure paths at `:102`, `:108`, `:117`; client IP passed from the controller | `event`, `login-failed:<username>:<ip>:<yyyy-mm-dd-hh>`, `warning` | none | Aggregates per user, IP and hour through the keyed-event upsert; the message carries the count. |

**Batch 2 (second emitter change, same release):**

| Emitter | Location | Kind, key, severity | CTA | Resolves when |
| --- | --- | --- | --- | --- |
| Home Assistant authentication failed or connection lost | `plugins/devices-home-assistant/services/home-assistant.ws.service.ts` (`auth_ok` missing at `:579`; reconnect scheduling at `:312`, raised only after the first reconnect attempt fails so a single blip stays silent) | `issue`, `connection`, `error` | `service` restart of the plugin's managed service (primary), `link` → the plugin config page | `auth_ok` is received. `stop()` calls `resolveAll`. |
| Storage running on the memory fallback | A one-minute monitor in `modules/storage` over `StorageService.isUsingFallback()` (`storage.service.ts:122`, a getter that nothing calls today and that has no transition hook) | `issue`, `fallback-active`, `warning` | `link` → `/extensions?tab=services` | The primary storage becomes available again. Closes the stale checkbox in `FEATURE-INFLUXDB-MEMORY-FALLBACK`. |
| Under-voltage or thermal throttling | `modules/system` cron every 5 minutes over `SystemService.getThrottleStatus()` (`undervoltage`, `throttling`, `frequencyCapping`, `softTempLimit`; currently pull-only via `GET /system/throttle`) | `issue`, `throttle:<flag>`, `warning` (`critical` for `undervoltage`) | `link` → `/system/info` | The flag clears. No-op on platforms without throttle data. |
| Security alert raised | `SecurityEventsService.doRecordAlertTransitions` (`security-events.service.ts:159-181`), where raised and resolved alerts are detected as transitions | `issue`, `alert:<alertId>`, `critical` | `link` → `/security` | The alert resolves. This is what carries a smoke or CO alert to Discord. |
| Channel delivery failed | `notification-dispatcher.service.ts` | `issue`, `delivery-failed`, `warning`, `source` = the channel plugin | `link` → the plugin's config page | The next delivery through that channel succeeds. Local-only by the loop guard. |

Deferred to follow-ups, each a small task once the contract exists: Homey `AUTHENTICATION_FAILED`
(`homey.service.ts:1399`), Zigbee2MQTT broker `offline` (`mqtt-client-adapter.service.ts:105`), weather
provider 401/429 (`openweathermap-http.service.ts:49`), display disconnected
(`display-connection-state.service.ts:16`), MCP OAuth activation failure, revoked-token presented.

Health checks are computed on demand when the services list is read, not polled, so "unhealthy" is not an
emitter in the first release.

### Channel plugin contract

```ts
interface INotificationChannel {
	getType(): string;                                // plugin type, e.g. 'notifications-discord-plugin'
	isConfigured(): Promise<boolean>;                 // false → skipped silently
	getMinSeverity(): Promise<NotificationSeverity>;  // from the plugin config
	send(notification: NotificationEntity, signal: AbortSignal): Promise<void>; // throw to report failure; honour the signal; the SDK mirrors this with a plain `Notification` type
}
```

- Plugins register in `onModuleInit` with `NotificationChannelRegistryService.register(channel)`; a duplicate
  type throws, following `CommandEventRegistryService`.
- `BaseNotificationChannel` implements `isConfigured` and `getMinSeverity` from the plugin's config through
  `ConfigService.getPluginConfig(type)`, and offers `formatText(notification)` (title, severity, source,
  message, occurrences) so senders share one wording.
- The dispatcher runs on `Created` for rows whose `source` is not a registered channel type (loop guard), in
  parallel across channels, sequentially per channel. Each attempt passes a fresh `AbortSignal.timeout(10_000)` into `send` and races the returned promise against that
  signal, so a channel that ignores the signal still settles (there is no per-channel timeout setting). Up to 3
  attempts with 1 s and 5 s delays between them, but only for failures proven to precede acceptance: a
  connection-establishment failure (DNS, connection refused, host or network unreachable, TLS handshake) or an
  HTTP 429 or 5xx response, which the providers document as "not processed". Anything after the request was
  written is ambiguous (the provider may have accepted it): a reset or broken pipe, a timeout, and any other 4xx
  end the delivery immediately as failed, never retried. Channels signal the classification by throwing
  `ChannelDeliveryError { status?: number; retryable: boolean }`; the dispatcher never guesses from raw errors.
  Every channel `fetch` uses `redirect: 'error'`, so a redirect (which could carry the webhook secret or a
  bearer header to another origin or to plain HTTP) is a non-retryable failure. Rejections are normalised before use (`error instanceof Error ?
  error.message : String(error)`), so a channel rejecting with a non-Error cannot break the self-report. After the last failure it logs and raises the `delivery-failed`
  issue for that channel with `message = sanitizeErrorMessage(normalisedMessage)`; the next success resolves it.
- Channels are skipped when the extension is disabled, when `isConfigured()` is false, or when the
  notification's severity ranks below `min_severity`.
- Discord, Slack and Telegram reject a non-`https:` URL at config validation. The generic webhook accepts
  `http:` for trusted-network targets (n8n, Node-RED, Home Assistant on the LAN); its config form and the
  developer docs state that exception and that the payload then travels in cleartext. Its optional `headers`
  map is a declared secret (redacted on read, `headers_configured` sibling) and is only ever sent over `https:`:
  a configuration with an `http:` URL and any header is rejected at validation.
- Every channel plugin registers one extension action `send-test` (category `diagnostics`) that sends a
  sample `info` notification through its own `send()`, passing a fresh `AbortSignal.timeout(10_000)` exactly
  as the dispatcher does, and reports the sanitized failure text on error. The existing Actions tab renders it, so no channel UI
  is needed beyond the config form.
- Plugin config models carry the secret under `secretFields` (`webhook_url` or `bot_token`), so the existing
  redaction, `_configured` sibling, `ConfigSecretInput` and the two secret regression spec tables apply.

First channels, all through `fetch`, no dependencies:

| Plugin | Config | Payload |
| --- | --- | --- |
| `notifications-webhook` | `url` (secret), `min_severity`, optional `headers` (secret; JSON object of extra headers, only allowed with an `https:` URL) | `POST` JSON: `{ id, source, kind, severity, title, message, occurrences, created_at, actions }` |
| `notifications-discord` | `webhook_url` (secret), `min_severity`, optional `username` | Discord webhook embed with a colour per severity |
| `notifications-slack` | `webhook_url` (secret), `min_severity` | Incoming-webhook `text` plus one attachment with a colour per severity |
| `notifications-telegram` | `bot_token` (secret), `chat_id`, `min_severity` | `https://api.telegram.org/bot<token>/sendMessage`, HTML parse mode; `send` parses the JSON reply and throws unless `ok === true`, because the Bot API can answer HTTP 200 with `ok: false` |

## Admin surface

```
apps/admin/src/modules/notifications/
├── notifications.module.ts        i18n merge, store registration, routes, data-refresh, sockets handler, config element
├── notifications.constants.ts     NOTIFICATIONS_MODULE_PREFIX, EVENT_PREFIX, EventType, RouteNames, enums
├── store/notifications.store.ts   items by id, unreadCount, fetch({status, afterId, append}), get, set, unset, onEvent, isLoaded, refresh
├── store/notifications.store.schemas.ts   Zod schemas bound to the generated NotificationsModuleDataNotification
├── composables/useNotifications.ts, useNotificationsActions.ts (read/dismiss/remove/bulk), useNotificationAction.ts (execute a CTA)
├── components/notification-bell.vue, notification-popover.vue, notification-item.vue, notification-severity-tag.vue,
│              notification-actions.vue, list-notifications.vue, notifications-filter.vue, notification-detail-drawer.vue,
│              notifications-config-form.vue
├── views/view-notifications.vue
├── router/index.ts
└── locales/{en-US,cs-CZ,de-DE,es-ES,pl-PL,sk-SK}.json
```

- **Bell.** `notification-bell.vue` is mounted in `app-top-bar.vue` next to the language switcher (and in the
  mobile layout's right slot). The badge shows the unread active count; the icon turns to the danger colour
  when any active notification is `error` or `critical`. Clicking opens the popover: up to 8 active rows sorted
  by severity rank then `created_at DESC`, each with severity icon, title, source, relative time, occurrence
  badge when above 1, the primary CTA button, and a dismiss control. Footer: "Mark all as read", "View all".
  Opening the popover does not mark anything read; clicking a row marks it read and opens the detail drawer.
- **Page.** `/notifications` (menu entry, roles owner and admin). Filter bar with status, severity, source
  and unread toggle synced to the query string through `useListQuery`; the source options are the extension
  types known to the extensions store (the closed set of possible sources), not only the sources present in
  loaded rows. Filters are applied server-side: the
  store's `fetch` forwards `status`, `severity`, `source`, `kind` and `unread` as query parameters, keeps every
  row it has seen in `items` by id, and keeps the current query's ordered id list, `has_more` and
  `next_cursor` separately; a filter change resets that list before the first page loads, while the bell reads
  the store's active rows independently of the page's query; rows in the logs-table style with
  selection; bulk bar with mark read, mark unread, dismiss and delete through the bulk endpoints; "Load more"
  through `next_cursor`; row click opens `notification-detail-drawer.vue` with the message, the `data`
  key/value table, all actions and lifecycle timestamps.
- **Toasts.** On a `Created` websocket pointer with severity `error` or `critical`, the module fetches the row
  and shows `useFlashMessage().error(title)`; `warning` and `info` only update the badge.
- **Live updates.** The module's sockets handler fetches the row on `Created` and `Updated` and unsets it on
  `Deleted`. `dataRefreshRegistry` re-fetches the active list on reconnect, and the store applies the
  mutation-token ordering used by the devices store.
- **Settings.** `notifications-config-form.vue` exposes `retention_days` and `max_notifications` through the
  config module's module element. Channel plugins ship their own `pluginConfigEditForm` and Zod schemas,
  using `ConfigSecretInput` for the secret.
- **Update badge.** `update-notification-badge.vue` and its top-bar mount are removed in the same change that
  adds the update emitter, so there is one place for attention items.

## Security and privacy

- All REST routes require owner or admin. Displays hold `UserRole.USER` and are excluded.
- Websocket payloads are pointers, never bodies, because any authenticated socket can join the exchange room.
- Channel secrets go through `secretFields`, are write-only in Swagger, and are never logged; the dispatcher
  logs the channel type and HTTP status, not the URL.
- `data` is capped at 4 KB and must be flat, which keeps stack traces and config dumps out of notifications.
- The generic webhook sends the notification body to a URL the administrator configured; the docs state that
  the payload contains whatever emitters put in `title`, `message` and `data`.

## Testing

- Backend unit: service lifecycle table (every cell above is a test), validation and truncation, rate guard,
  boot cleanup with `bootStartedAt`, retention and cap, dispatcher filter/retry/timeout/loop guard, controller
  role guards and bulk hand-off, each emitter's raise-and-resolve pair, each channel's payload shape (mocked
  `fetch`).
- Backend e2e: list, patch, bulk endpoints as owner; 403 for a user token; migration applies on a fresh DB.
- Admin unit (Vitest): store `set/unset/onEvent` and ordering tokens, `useNotificationAction` executing the
  three CTA types through mocked composables, bell unread count and severity colour, filter query sync.
- Secret regression tables: rows in `apps/admin/src/plugins/config-secrets.spec.ts` and
  `apps/backend/src/plugins/plugin-secret-removal.spec.ts` for every channel secret.
- Manual smoke: dev server, failed login shows in the bell within a second; disabling a plugin resolves its
  issue; Discord test action posts.

## Non-goals and follow-ups

- Translation keys with placeholders for backend-authored notifications.
- Per-user read state, snooze, and "resolved" deliveries to channels.
- Routing rules by source or a routing tree; e-mail (needs an SMTP dependency); ntfy and Pushover (trivial
  once the webhook reference exists).
- A `notifications-panel` channel plugin that surfaces critical notifications on displays.
- Health-poll based "service unhealthy" issues, pending a polling loop in the service manager.
- Interactive fix flows; the interactive-session epic covers that surface.
- Turning error-level log lines into notifications automatically; too noisy without a dedupe model.
- Restricting the websocket `subscribe-exchange` join to owner and admin principals; pre-existing behaviour,
  tracked as a separate hardening task.

## Decisions to confirm during review

1. Four severities (`info`, `warning`, `error`, `critical`) rather than Home Assistant's three.
2. Global read and dismiss state rather than per user.
3. Plain-text English content, translation keys deferred.
4. Channel delivery on insert only, never on upsert.
5. Ship four channels (webhook, Discord, Slack, Telegram) in the first release, or only webhook and Discord.
6. Include the Security alert bridge in the first release.
