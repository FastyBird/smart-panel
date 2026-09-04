# Task: Notification channel registry and dispatcher

ID: FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH
Type: feature
Scope: backend
Size: medium
Parent: EPIC-NOTIFICATIONS-MODULE
Status: done

## 1. Business goal

In order to let a channel plugin deliver notifications to an external service without reimplementing
filtering, retries or loop protection itself,
As a Smart Panel backend developer,
I want a core channel registry and dispatcher that plugins register against and that applies severity
filtering, timeout, retry and a self-reported delivery-failure issue uniformly.

## 2. Context

- This is task N-3; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Depends on `FEATURE-NOTIFICATIONS-BACKEND-CORE` (N-1) for `NotificationsService`, the entity and
  `EventType.NOTIFICATION_CREATED`.
- Spec: `docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "Channel plugin contract"
  section.
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-3 section.
- Registry pattern to mirror: `apps/backend/src/modules/extensions/services/extension-action-registry.service.ts`;
  the plan notes a duplicate type throws, "like `CommandEventRegistryService`".
- Config access pattern: `ConfigService.getPluginConfig(type)` for a channel's `enabled` flag and
  `min_severity`.
- This task does not add any concrete channel; it only builds the registry, base class and dispatcher that
  `FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD` and `FEATURE-NOTIFICATIONS-CHANNEL-SLACK-TELEGRAM` plug
  into.

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/888 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- `INotificationChannel` interface and `BaseNotificationChannel` abstract class
  (`platforms/notification-channel.platform.ts`).
- `NotificationChannelRegistryService` (`register`, `unregister`, `getChannels`, `isChannel`).
- `NotificationDispatcherService`, listening on `EventType.NOTIFICATION_CREATED`, applying
  filter/timeout/retry/loop-guard/self-report.
- `sanitizeErrorMessage` in `notifications.utils.ts`: reduces every URL to `scheme://host` (dropping
  userinfo, path and query, which removes Telegram `bot<token>` segments and Slack/Discord webhook paths),
  masks `Bearer <token>` and `token=`/`key=`/`password=`/`secret=` values, collapses whitespace, and
  truncates to 300 characters.
- Wiring the new providers into `notifications.module.ts` (providers, exports).

**Out of scope**

- Any concrete `INotificationChannel` implementation or plugin (`FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD`,
  `FEATURE-NOTIFICATIONS-CHANNEL-SLACK-TELEGRAM`).
- REST/websocket surface (already delivered by `FEATURE-NOTIFICATIONS-BACKEND-API` by the time this task
  starts).
- Any emitter.

## 4. Acceptance criteria

- [x] `INotificationChannel` declares `getType(): string`, `isConfigured(): Promise<boolean>`,
      `getMinSeverity(): Promise<NotificationSeverity>`, `send(notification, signal: AbortSignal): Promise<void>`.
- [x] `BaseNotificationChannel` implements `isConfigured()` and `getMinSeverity()` from the plugin's config
      via `ConfigService.getPluginConfig(type)`, delegating the required-fields check to an abstract
      `hasRequiredConfig(config)`; `getMinSeverity()` defaults to `WARNING` when the config has no
      `min_severity`.
- [x] `BaseNotificationChannel` exposes `formatText(notification)` producing a shared wording (title,
      severity, source, message, occurrences) and `fetchWithSignal(url, init, signal)`, which passes the
      dispatcher's `AbortSignal` through to `fetch` and sets `redirect: 'error'`, so a redirect is a
      non-retryable failure rather than being followed silently.
- [x] `ChannelDeliveryError` (`{ message: string; retryable: boolean; status?: number }`) is the
      dispatcher-facing contract: every channel failure is thrown as one, and the dispatcher retries only
      when `retryable` is `true` and never classifies a raw error itself.
- [x] `BaseNotificationChannel.classify(error, response?)` replaces `isRetryable` as the channel-side helper
      that builds a `ChannelDeliveryError`: a connection-establishment failure (DNS, connection refused, host
      or network unreachable, TLS handshake) or an HTTP 429 or 5xx response is retryable; a reset or broken
      pipe after the request was written, an abort or timeout, a redirect, or any other 4xx is not retryable.
- [x] `NotificationChannelRegistryService.register(channel)` throws when a channel of the same `getType()` is
      already registered.
- [x] `NotificationChannelRegistryService.isChannel(source)` returns `true` for any registered channel's
      type, used as the dispatcher's loop guard.
- [x] The dispatcher subscribes to `EventType.NOTIFICATION_CREATED`, loads the row with `findOne(id)`, and
      skips dispatch entirely when `registry.isChannel(entity.source)` is true.
- [x] For each registered channel, delivery is skipped when the owning extension is disabled
      (`configService.getPluginConfig(type).enabled === false`).
- [x] Delivery is skipped when `channel.isConfigured()` resolves `false`.
- [x] Delivery is skipped when `SEVERITY_RANK[entity.severity] < SEVERITY_RANK[await channel.getMinSeverity()]`.
- [x] Channels are dispatched in parallel to each other (`Promise.allSettled`) but attempts within one
      channel are sequential.
- [x] Each attempt creates a fresh `AbortSignal.timeout(10_000)`, passes it into `send(notification, signal)`,
      and races the returned promise against the signal's abort so a channel that ignores the signal still
      settles; there is no per-channel timeout setting.
- [x] Up to 3 send attempts with delays of 1000 ms and 5000 ms between them (delay mechanism injectable for
      tests), but only when the thrown `ChannelDeliveryError` has `retryable: true`: a connection-establishment
      failure (DNS, connection refused, host or network unreachable, TLS handshake) or an HTTP 429 or 5xx
      response. A reset or broken pipe after the request was written, an abort or timeout, a redirect, any
      other 4xx, and any rejection that is not a `ChannelDeliveryError` end the delivery as failed after the
      first attempt, with no retry.
- [x] Rejections are normalised before use: `const message = error instanceof Error ? error.message :
      String(error)`, guarded so a throwing `toString` still yields a usable string rather than crashing the
      dispatcher.
- [x] After the final failed attempt, the dispatcher logs the channel type and `sanitizeErrorMessage(message)`
      (never the URL) and raises `notify({ source: channel.getType(), kind: ISSUE, key: 'delivery-failed',
      severity: WARNING, title: 'Notification delivery failed', message: sanitizeErrorMessage(message),
      actions: [{ type: LINK, label: 'Open channel settings', url: '/config/plugins/<type>' }] })`.
- [x] After a successful delivery, the dispatcher calls `resolve(channel.getType(), 'delivery-failed')`.
- [x] One failing channel does not block delivery to another channel.
- [x] Deliveries to the same channel preserve message order even under a burst (serialised with a promise
      chain).
- [x] `sanitizeErrorMessage(message)` in `notifications.utils.ts` reduces every URL in the message to
      `scheme://host`, dropping userinfo, path and query (which also removes Telegram `bot<token>` segments
      and Slack/Discord webhook paths), masks `Bearer <token>` and `token=`/`key=`/`password=`/`secret=`
      values with `***`, collapses whitespace, and truncates the result to 300 characters.
- [x] `notifications.utils.spec.ts` covers: a Telegram `https://api.telegram.org/bot123:ABC/sendMessage` URL
      and a Slack `https://hooks.slack.com/services/T0/B0/XYZ` URL both reduce to `scheme://host`; userinfo,
      query strings, bearer tokens and `token=`/`key=`/`password=`/`secret=` values are masked; whitespace is
      collapsed; a long message is truncated to 300 characters.
- [x] Dispatcher spec covers: filter by disabled, filter by unconfigured, filter by below-minimum severity,
      the loop guard, a retryable failure retried three times (sleeps of 1000 ms then 5000 ms) followed by
      self-report, a timeout, an HTTP 400 and a redirect outcome all ending delivery as failed without a
      retry, a channel that never settles being aborted by the race against `AbortSignal.timeout(10_000)` and
      counted as failed, a non-`ChannelDeliveryError` rejection (e.g. a plain `null` throw) treated as final
      and still producing a self-report with a sanitized message, a success resolving a prior self-report, one
      channel's failure not blocking another, and order preservation within one channel - using fake channels
      and a fake `sleep`.
- [x] Registry spec covers: duplicate-type registration throws, and `isChannel` correctly identifies
      registered types.
- [x] `cd apps/backend && npx jest src/modules/notifications` passes.

## 6. Technical constraints

- Depends on: N-1 / FEATURE-NOTIFICATIONS-BACKEND-CORE.
- Follow the existing registry pattern (`ExtensionActionRegistryService`) for register/duplicate-throw
  semantics.
- Never log channel secrets or URLs; log channel type and status/error only, the error message passed through
  `sanitizeErrorMessage`.
- Tabs, single quotes, semicolons, trailing commas; print width 120; import ordering as elsewhere.
- No new runtime dependencies; channel `send()` implementations (added later) must use the global `fetch`.
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `feat(backend): dispatch notifications to channel plugins`
- Suggested worker tier: implementer sonnet / high, reviewer opus / medium.

## 7. Implementation hints

Copy verbatim from the plan's Task N-3 "Interfaces (produces)" block:

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
	protected formatText(notification: NotificationEntity): string; // "[ERROR] Title\nmessage\nSource: x - 3 occurrences"
	protected fetchWithSignal(url: string, init: RequestInit, signal: AbortSignal): Promise<Response>; // fetch with the dispatcher's signal and `redirect: 'error'`; wraps outcomes into ChannelDeliveryError
	protected classify(error: unknown, response?: Response): ChannelDeliveryError; // channel-side helper: DNS/refused/unreachable/TLS-handshake causes and HTTP 429/5xx -> retryable: true; reset, broken pipe, abort/timeout, redirect, other 4xx -> retryable: false
}

export class ChannelDeliveryError extends Error { // the dispatcher-facing contract: every channel failure is one of these
	constructor(message: string, readonly retryable: boolean, readonly status?: number);
}

// notifications.utils.ts
export function sanitizeErrorMessage(message: string): string;
// reduces every URL to `scheme://host` (dropping userinfo, path and query - this also removes Telegram `bot<token>`
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

Dispatcher behaviour (`@OnEvent(EventType.NOTIFICATION_CREATED)` -> `findOne(id)` -> `dispatch(entity)`), from
the plan:

- Skip when `registry.isChannel(entity.source)`.
- For each channel in parallel (`Promise.allSettled`): skip when the extension is disabled
  (`configService.getPluginConfig(type).enabled === false`), when `isConfigured()` is false, or when
  `SEVERITY_RANK[entity.severity] < SEVERITY_RANK[await channel.getMinSeverity()]`.
- Attempts: up to 3, with delays of 1000 ms and 5000 ms between them (injectable `sleep` for tests). Each
  attempt creates `AbortSignal.timeout(10_000)`, calls `send(notification, signal)` and races the promise
  against the signal's abort so a channel that ignores the signal still settles. Only a `ChannelDeliveryError`
  with `retryable: true` gets another attempt (a connection-establishment failure - DNS, refused, unreachable,
  TLS handshake - or an HTTP 429 / 5xx); a reset after the request was written, an abort/timeout, a redirect,
  any other 4xx, and any non-`ChannelDeliveryError` rejection end the delivery immediately as failed.
  Rejections are normalised first: `const message = error instanceof Error ? error.message : String(error)`
  (guarded so a throwing `toString` yields a usable string instead of crashing the dispatcher).
- After the final failure: `logger.error` with channel type and `sanitizeErrorMessage(message)` (never the
  URL), then
  `notificationsService.notify({ source: channel.getType(), kind: ISSUE, key: 'delivery-failed', severity: WARNING, title: 'Notification delivery failed', message: sanitizeErrorMessage(message), actions: [{ type: 'link', label: 'Open channel settings', url: '/config/plugins/<type>' }] })`.
- After a success: `notificationsService.resolve(channel.getType(), 'delivery-failed')`.
- Per-channel deliveries are serialised with a simple promise chain so a burst keeps message order.

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "Channel plugin
  contract" section) and plan (`docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-3 section)
  in full before making any code changes.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
