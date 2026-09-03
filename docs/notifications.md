# Notifications

The notifications module (`apps/backend/src/modules/notifications/`) gives the administrator
one place where the system says what needs attention: an integration lost its connection, a
managed service failed, an update is available, somebody failed to log in. Every notification
carries a severity, a source, an optional call to action, and a read/dismiss lifecycle. The
same notifications can be forwarded to external channels (a generic webhook, Discord, and more
to come) through plugins the administrator enables and configures.

This is a developer guide for two audiences: someone raising notifications from a module or
plugin ("emitting"), and someone building a channel plugin that forwards notifications
somewhere else ("writing a channel"). For the full design rationale, see
`docs/superpowers/specs/2026-09-02-notifications-module-design.md`.

See also `docs/extensions.md` for the general extension system, and `docs/config-secrets.md`
for how channel plugins declare their secrets.

## Concepts

Each notification is one row in `notifications_module_notifications`
(`apps/backend/src/modules/notifications/entities/notifications.entity.ts`):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `source` | string | Extension type of the emitter, e.g. `system-module`, `devices-home-assistant-plugin`. Used as the origin, for dedupe, and for `resolveAll`. |
| `kind` | `event` or `issue` | See Lifecycle below. |
| `key` | string or null | Required for `issue`, optional for `event`. Unique per `source` among unresolved rows (a partial unique index enforces this). |
| `severity` | `info`, `warning`, `error`, `critical` | `info`: FYI. `warning`: degraded, no action needed now. `error`: broken, action needed. `critical`: safety or security, immediate. Channels filter delivery on it. |
| `title` | string, max 120 | Plain text. |
| `message` | string or null, max 1000 | Plain text; newlines allowed. |
| `actions` | array, max 3 | See Actions below. |
| `data` | object or null | Flat `Record<string, string \| number \| boolean \| null>`, max 4 KB serialized. Shown as a key/value table in the detail drawer; never used for logic by the core. |
| `persistent` | boolean | Issues only. `false` (default): resolved automatically at boot, the source re-raises if the condition still holds. `true`: survives boot untouched (for example "the last update failed", which nothing re-detects). |
| `occurrences` | integer | Starts at 1, incremented on every upsert of the same `(source, key)`. |
| `read_at`, `dismissed_at`, `resolved_at` | timestamp or null | Lifecycle marks. |
| `created_at`, `updated_at` | timestamp | `updated_at` moves on every upsert. |

### Event vs issue

- An **event** records something that happened: a failed login, a security alert firing.
  Without a `key` it is always a fresh row. With a `key`, repeats aggregate into the same row
  (see Keys below) until the aggregation window closes.
- An **issue** is a condition that holds until its source resolves it: a lost connection, a
  managed service in an error state. An issue always needs a `key`, because its source has to
  be able to find and resolve the same row later.

### Keys

`key` is what lets a source find "the same condition" again. It is required for an issue and
optional for an event, and it is unique per `source` among rows that are not yet resolved
(`resolved_at IS NULL`) - the partial unique index `IDX_notifications_source_key_active` on
`(source, key)` enforces this at the database level. A repeat `notify()` call for the same
`(source, key)` upserts the existing active row instead of inserting a new one: `occurrences`
increments, and the other fields are replaced with the latest call's values. Resolving a row
frees its key, so the next `notify()` with that key starts a fresh aggregation window rather
than reopening the closed one.

### Severities

Four severities, in order: `info`, `warning`, `error`, `critical` (`SEVERITY_RANK` in
`notifications.constants.ts`). Channels compare a notification's severity against their own
configured minimum using this rank, and the admin sorts by it.

### Persistence

`persistent` only means something for an issue. A non-persistent issue (the default) is
resolved automatically when the backend starts, on the assumption that its source will
re-raise it during its own startup if the condition still holds - this is what keeps a
condition that cleared while the process was down from lingering forever. A persistent issue
(for example "the last update failed") survives that boot cleanup untouched, because nothing
will ever re-detect it; the administrator dismissing it is the only way it ends (see Lifecycle).

## Lifecycle

| | Event without a key | Event with a key | Issue |
| --- | --- | --- | --- |
| `notify()` | Inserts a row. | Upserts: `occurrences + 1`, replaces title/message/severity/actions/data, clears `read_at` and `dismissed_at` (the repeat reopens the aggregation). | Upserts: `occurrences + 1`, replaces fields; keeps `read_at` and `dismissed_at` (a dismissed issue stays hidden while the condition persists). |
| `resolve(source, key)` | Not applicable - the event was never given a key for a later `resolve()` to target. | Sets `resolved_at`, closing the aggregation window; the next `notify()` starts a new row. | Sets `resolved_at`. |
| Boot | Untouched. | Untouched. | `resolved_at = now` for rows with `persistent = false` and `updated_at` older than the moment the backend started. Sources re-raise during their own startup if the condition still holds. |
| User dismiss | Sets `dismissed_at`. | Sets `dismissed_at`; cleared by the next upsert. | Sets `dismissed_at`; stays until resolved. For a `persistent` issue, dismissing it also sets `resolved_at` - the source declared nothing re-detects the condition, so the dismissal is the only way it ends. Un-dismissing (`dismissed: false`) clears `dismissed_at` but leaves `resolved_at` in place, so the row stays in history. |
| Retention | Deleted `retention_days` after `dismissed_at`. | Deleted `retention_days` after the later of `dismissed_at` and `resolved_at`, once at least one is set. | Deleted only once resolved: `resolved_at` set, and the later of `resolved_at` and `dismissed_at` older than `retention_days`. A dismissed but unresolved issue is kept, because the dismissal must keep hiding the source's re-raises. |
| Channel delivery | On insert. | On insert only (later upserts update in-app only, so repeated failures do not spam a channel). | On insert only. |

"Active" means `dismissed_at IS NULL AND resolved_at IS NULL`. The unread badge counts active
rows with `read_at IS NULL` (`NotificationsService.countUnread()`).

The boot rule compares each row's `updated_at` against a `bootStartedAt` timestamp captured
when `NotificationsRetentionService` is constructed, not when the cleanup itself runs. That
makes the cleanup independent of module initialization order: an emitter that raises its issue
inside its own `onModuleInit`, before the cleanup runs, produces a row newer than
`bootStartedAt`, so the cleanup leaves it alone.

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

Actions are pure data pointing at endpoints that already exist; the notifications module never
executes them itself:

- `link.url` is either an admin-relative path (`/system/info`) or an absolute `http(s)` URL.
  Anything else, including a scheme-relative `//host`, is rejected by `notify()`.
- `extension_action` names an extension's action by `extension_type` and `action_id`, executed
  by the admin the same way the Extensions page runs any other action.
- `service` names a managed service operation (`start`, `stop`, `restart`) by
  `extension_kind`, `extension_type` and `service_id`, executed through the managed-services
  endpoints.
- Executing an action never changes the notification itself. The source resolves the issue
  when it observes the effect (the service reports `started`, the update installs). A CTA that
  failed leaves the issue in place, which is the truthful state.
- At most three actions per notification; a fourth onward is dropped by `notify()`. At most
  one action may carry `primary: true`.

## Emitting notifications

Inject `NotificationsService`
(`apps/backend/src/modules/notifications/services/notifications.service.ts`) into your module
or plugin. `NotificationsModule` is `@Global()` and exports it, so no `imports` entry is
needed - the same way `ExtensionsModule` exports `ExtensionActionRegistryService`.

```ts
interface CreateNotificationInput {
	source: string;
	kind: NotificationKind; // 'event' | 'issue'
	key?: string; // required for 'issue'
	severity: NotificationSeverity; // 'info' | 'warning' | 'error' | 'critical'
	title: string;
	message?: string;
	actions?: NotificationAction[];
	data?: Record<string, string | number | boolean | null>;
	persistent?: boolean; // issues only, default false
}

class NotificationsService {
	notify(input: CreateNotificationInput): Promise<NotificationEntity | null>;
	resolve(source: string, key: string): Promise<boolean>; // true when a row was resolved
	resolveAll(source: string): Promise<number>; // dismissed rows included
}
```

The `@fastybird/smart-panel-extension-sdk` package exports plain mirrors of these types
(`CreateNotificationInput`, `NotificationAction`, `NotificationKind`, `NotificationSeverity`)
in `packages/extension-sdk/src/notification.types.ts`, for extension packages built outside
the backend's own TypeScript program. Its `CreateNotificationInput` is a discriminated union
on `kind`, stricter than the flat interface above: the `'issue'` branch requires `key` and
allows `persistent`, the `'event'` branch has an optional `key` and no `persistent` - a
compile-time version of the rule `NotificationInputValidator` enforces at runtime. See
`packages/example-extension/src/example.service.ts` for a worked example: it imports
`NotificationsService` itself from the backend's public barrel, `@fastybird/smart-panel-backend`
(`apps/backend/src/index.ts`), the same way it already imports the rest of that surface.

### Rules

- Use your extension type constant as `source` (`SYSTEM_MODULE_NAME`,
  `DEVICES_HOME_ASSISTANT_PLUGIN_NAME`), never a hardcoded string.
- Raise an issue when a condition starts and resolve it when it ends. Do not raise on every
  retry tick - a reconnect loop that raises on every attempt turns one condition into a
  hundred rows' worth of noise (the rate guard below exists to survive a caller that gets this
  wrong, not as a substitute for getting it right).
- Prefer a `service` or `extension_action` action over a `link` when the administrator can
  actually fix the condition from the admin.
- Call `resolveAll(source)` from your service's `stop()` (or equivalent), so disabling or
  stopping the plugin clears the issues it raised. Dismissed rows are resolved too - the
  source going away ends every one of its conditions, seen or not.
- Never put secrets or tokens in `title`, `message` or `data` - the payload reaches every
  configured channel. Pass operational error text (a service's `lastError`, an HTTP error)
  through `sanitizeErrorMessage()` from
  `apps/backend/src/modules/notifications/notifications.utils.ts` before using it as
  `message`. It reduces every URL to `scheme://host` (which also strips a Telegram bot token
  or a Slack/Discord webhook path out of the URL itself), masks bearer tokens and `token=` /
  `key=` / `password=` / `secret=` values (inline or inside JSON-looking text), collapses
  whitespace, and truncates to 300 characters.

### Validation, truncation, and the rate guard

`notify()` never throws to its caller - an emitter is typically a reconnect loop, a cron job,
or a request handler that must not go down because the notifications table did.

- `title` and `message` are truncated to their limits rather than rejected.
- A fourth action onward is silently dropped.
- The call is refused (one `warn` log, `notify()` returns `null`) when: `kind` is `'issue'`
  without a `key`; `source` is empty; `severity` is not a known value; an action has an
  unknown `type`, is missing a required field for its type, or a `link` has a disallowed
  scheme; `data` is not flat or exceeds 4 KB serialized. It is also refused when the database
  write itself fails, for the same reason `notify()` never throws.
- Per source, at most 60 `notify()` calls are accepted per rolling minute (upserts of an
  existing key count too); calls beyond that are dropped with one `warn` per source per
  minute, not one per dropped call.

See `notification-input.validator.ts` and `notifications.service.ts` for the exact rules if
you need an edge case - both have full unit test coverage you can read alongside them,
`notification-input.validator.spec.ts` and `notifications.service.spec.ts`.

## REST API

Mounted at `/api/modules/notifications`, so full paths are
`/api/modules/notifications/notifications` and so on - the same shape as
`/api/modules/extensions/extensions`. Every route requires `UserRole.OWNER` or
`UserRole.ADMIN`; a display's token resolves to `UserRole.USER` and is refused.

| Method and path | Notes |
| --- | --- |
| `GET /notifications` | List, newest first. Query: `status` (`active` default, `dismissed`, `resolved`, `all`), `severity` (repeatable), `source`, `kind`, `unread` (boolean), `after_id` (cursor), `limit` (default 50, max 200). |
| `GET /notifications/{id}` | Fetch one. |
| `PATCH /notifications/{id}` | Body `{ data: { read?: boolean, dismissed?: boolean } }`. |
| `DELETE /notifications/{id}` | Removes the row outright (204). The source is not told - an issue whose condition still holds is simply raised again. |
| `POST /notifications/bulk-update` | Body `{ data: { ids, read?, dismissed? } }`, one request for many rows, returns a `CommonDataBulkResult`-shaped response through `runBulkOperation` (each id is processed independently, so one failure does not abort the rest). |
| `POST /notifications/bulk-remove` | Body `{ data: { ids } }`, same bulk shape. |

List pagination is cursor-based, in the same style as `GET /logs`: the total order is
`created_at DESC, id DESC`, `after_id` is the id of the last row the client already holds, and
the response's `metadata` carries `has_more` and `next_cursor` (the id of the last row
returned) so the client can page with "load more" rather than an offset. An `after_id` that
does not resolve to a row falls back to the first page rather than erroring; an `after_id`
that is not a valid UUID, an unknown `status`, or an unknown `kind` value is a 400.

## WebSocket

The service emits `NotificationsModule.Notification.Created`, `.Updated` and `.Deleted`
through `EventEmitter2`; the websocket gateway bridges them to connected clients. Payloads are
thin pointers, not full bodies - `{ id, kind, severity, source }` for Created and Updated,
`{ id }` for Deleted - because any authenticated socket can join the exchange room. A client
fetches the full row through the REST endpoint above after receiving a pointer.

`'NotificationsModule.'` is one of the `ADMIN_ONLY_EVENT_PREFIXES` in
`apps/backend/src/modules/websocket/gateway/websocket.gateway.ts`, so these events are
delivered only to sockets in `ADMIN_ROOM` - joined automatically at connection time by an
owner or admin principal - never to a `USER`-role socket or a display, even though
`subscribe-exchange` itself currently admits any authenticated socket (restricting that join
is a separate, tracked hardening task).

## Writing a channel

A channel plugin formats and sends notifications somewhere else - Discord, a generic webhook,
and so on. The core applies the per-channel severity filter, timeout, retry and loop guard
once; a channel plugin only implements `getType`, `isConfigured`, `getMinSeverity` and `send`.

```ts
interface INotificationChannel {
	getType(): string; // plugin type, e.g. 'notifications-discord-plugin'
	isConfigured(): Promise<boolean>; // false -> skipped silently
	getMinSeverity(): Promise<NotificationSeverity>; // from the plugin's own config
	send(notification: NotificationEntity, signal: AbortSignal): Promise<void>;
}
```

(`apps/backend/src/modules/notifications/platforms/notification-channel.platform.ts`. The SDK
mirrors this contract with a plain `Notification` payload type, for a channel built as an
installable extension package rather than compiled into the backend - see
`packages/extension-sdk/src/notification.types.ts`.)

Register in your plugin's own `onModuleInit`:

```ts
this.channelRegistry.register(this); // NotificationChannelRegistryService; a duplicate type throws
```

### `BaseNotificationChannel`

Extend `BaseNotificationChannel` (same file) rather than implementing `INotificationChannel`
directly - `notifications-webhook`, `notifications-discord`, and any future `fetch`-based
channel differ only in payload shape and endpoint, and this class shares the rest:

- `isConfigured()` and `getMinSeverity()` are implemented for you, reading the plugin's own
  config through `ConfigService.getPluginConfig(type)`. You implement
  `hasRequiredConfig(config): boolean` (does this config have what `send()` needs - a webhook
  URL, a bot token) and `send()` itself.
- `formatText(notification)` renders the shared plain-text wording every channel uses:
  `[SEVERITY] Title`, the message on its own line when present, then `Source: <source>` with
  an occurrence count appended once `occurrences > 1`.
- `fetchWithSignal(url, init, signal)` is the one `fetch` call your channel should make. It
  always sets `redirect: 'error'` - a redirect could carry a webhook secret or a bearer header
  to a different origin, or silently downgrade `https:` to `http:`, so it is treated as a
  delivery failure rather than something to follow. A rejected `fetch` (DNS, refused,
  unreachable, TLS, abort, reset, ...) is turned into a `ChannelDeliveryError` for you.
- `classify(error, response?)` implements the retryable/non-retryable rules below. Call it
  yourself, with the `Response`, for a non-2xx response your channel decoded (so it can check
  for 429/5xx).

### Retry, timeout, and the loop guard

`NotificationDispatcherService` listens for `Notification.Created` and fans each row out to
every registered channel:

- Channels run in parallel with each other. Deliveries to the *same* channel type run one
  after another (a per-channel delivery chain), so a burst of notifications normally keeps
  its order for that channel without a slow or retrying channel ever blocking a different
  one - with one exception: a `send()` that ignores `signal` and keeps running past the
  10-second timeout below. The dispatcher's own bookkeeping treats that attempt as failed
  and moves on to the next queued delivery for that channel as soon as the timeout fires,
  while the abandoned `send()` call keeps running in the background - so the old and the new
  delivery can complete out of order at the channel's end. Honouring `signal` is what keeps
  the ordering guarantee true.
- Each attempt gets its own `AbortSignal.timeout(10_000)` (10 seconds), and the dispatcher
  races your returned promise against that signal - a channel that ignores `signal` still
  settles after 10 seconds, but one that reads it (passing it through to `fetch`) frees
  resources sooner and fails with a cleaner error.
- Up to 3 attempts total, with 1 second then 5 seconds between them - but only when the
  failure is proven to precede acceptance: a connection-establishment failure (DNS, connection
  refused, host or network unreachable, a TLS handshake failure) or an HTTP 429 or 5xx
  response, which providers document as "not processed". Anything after the request was
  written is ambiguous (the provider may already have accepted it): a reset or broken pipe, a
  timeout, a redirect, and any other 4xx end the delivery immediately, never retried.
- Your channel signals which case applies by throwing a `ChannelDeliveryError { message,
  retryable, status? }` from `send()`. The dispatcher never inspects a raw error itself - only
  what your channel (typically through `classify()`) throws drives its retry decision.
  Rejections are normalised before use (`error instanceof Error ? error.message :
  String(error)`), so a channel that rejects with a non-`Error` cannot break the self-report
  below.
- The dispatcher skips a notification whose `source` is itself a registered channel type - the
  loop guard that stops a channel's own delivery failure from being reported right back
  through every channel in turn, including itself.
- After the last failed attempt, the dispatcher logs the failure and raises it as a
  notification of its own: `source` = your channel's `getType()`, `kind: 'issue'`,
  `key: 'delivery-failed'`, `severity: 'warning'`, `title: 'Notification delivery failed'`,
  `message: sanitizeErrorMessage(...)`, with a `link` action to `/config/plugins/<type>`. The
  next successful delivery through that channel resolves it.

### The `send-test` action

Every channel plugin registers one extension action, `send-test`
(`category: 'diagnostics'` - `ActionCategory` in the SDK), that builds a sample `info`
notification and calls the channel's own `send()` with a fresh `AbortSignal.timeout(10_000)`,
exactly like the dispatcher does, reporting the sanitized failure text as the action's error
on failure. The existing Actions tab renders it, so no dedicated channel UI is needed beyond
the plugin's own config form.

### Secrets

A channel's credential (a webhook URL, a bot token) is declared through `secretFields` on the
plugin's config mapping registration, the same mechanism every plugin credential uses - see
`docs/config-secrets.md` for the write-only update semantics, the `*_configured` sibling
field, and the `ConfigSecretInput` admin component. Add a row for every new channel secret to
both secret regression tables: `apps/admin/src/plugins/config-secrets.spec.ts` and
`apps/backend/src/plugins/plugin-secret-removal.spec.ts`.

### HTTPS rules

Discord, Slack and Telegram channels reject a non-`https:` URL at config validation - their
URL always carries the webhook secret or bot token, so anything else is a hard validation
error, not a warning.

The generic webhook channel (`notifications-webhook`) is the one documented exception: it
accepts `http:` for trusted-network targets on the local network - an n8n or Node-RED
instance, or Home Assistant. Its config form and this guide both say so, and that the payload
then travels in cleartext: title, message and data reach the target unencrypted. Its optional
`headers` map (extra HTTP headers to send) is itself a declared secret, and is only ever sent
over `https:` - a configuration with an `http:` URL and any header is rejected at validation,
so a bearer token or API key placed in a custom header can never leave the box in the clear.

## The webhook payload

`notifications-webhook` sends a `POST` with a JSON body:

```json
{
	"id": "f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6",
	"source": "devices-home-assistant-plugin",
	"kind": "issue",
	"severity": "error",
	"title": "Home Assistant connection lost",
	"message": "The websocket connection was refused: 401 Unauthorized.",
	"occurrences": 3,
	"created_at": "2026-09-02T12:00:00Z",
	"actions": [
		{
			"type": "service",
			"label": "Restart",
			"extension_kind": "plugin",
			"extension_type": "devices-home-assistant-plugin",
			"service_id": "home-assistant-ws",
			"operation": "restart",
			"primary": true
		}
	]
}
```

Config: `url` (secret), `min_severity`, and an optional `headers` object (secret, only allowed
alongside an `https:` url - see HTTPS rules above).

`notifications-discord` sends the same underlying data as a Discord webhook embed, with a
colour per severity, configured with `webhook_url` (secret), `min_severity`, and an optional
`username`. These two are the reference channel plugins for this contract - read their source
for a concrete, complete example once they land. Both build directly on
`BaseNotificationChannel`, with no new runtime dependency beyond `fetch`.

## Testing

- **Backend unit** (Jest, next to the source): the lifecycle table above is the shape of
  `notifications.service.spec.ts` - every cell is a test. `notification-input.validator.spec.ts`
  covers validation and truncation. `notifications-retention.service.spec.ts` covers boot
  cleanup (`bootStartedAt`), nightly retention, and the cap. `notification-dispatcher.service.spec.ts`
  covers the severity filter, retry, timeout and loop guard - mock `fetch`, and inject a fake
  for `NOTIFICATION_DISPATCHER_SLEEP` (the DI token the retry delay comes from) so a test does
  not really wait 1 and 5 seconds. Note that the dispatcher's `createDeliverySignal()` is a
  `protected` method specifically so a test can override it with a manually controlled
  `AbortController` - `AbortSignal.timeout` schedules through Node's own internal timer, which
  fake timers cannot advance. `notifications.controller.spec.ts` covers the role guards and
  the bulk hand-off.
- **Backend e2e** (`apps/backend/test/`): list, patch and bulk endpoints as an owner; a 403 for
  a plain user token; the migration applies cleanly on a fresh database.
- **A channel plugin**: test `send()` against a mocked global `fetch`, and test your
  `classify()` (or the inherited one) against the connection and TLS error codes and the
  429/5xx cases directly. `notification-channel-registry.service.spec.ts` covers registration
  and the loop guard; the dispatcher spec above covers the delivery path around it.
- **Secret regression**: a row per channel secret in both
  `apps/admin/src/plugins/config-secrets.spec.ts` and
  `apps/backend/src/plugins/plugin-secret-removal.spec.ts`.
- **Manual smoke**: run the dev server, trigger the condition your emitter watches for and
  confirm the row appears (and disappears once the condition clears); stop or disable the
  emitting plugin and confirm its issues resolve; if you configured a channel, run its
  `send-test` action and confirm delivery.
