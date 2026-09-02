# Task: Notification channel registry and dispatcher

ID: FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH
Type: feature
Scope: backend
Size: medium
Parent: EPIC-NOTIFICATIONS-MODULE
Status: planned

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
- Wiring the new providers into `notifications.module.ts` (providers, exports).

**Out of scope**

- Any concrete `INotificationChannel` implementation or plugin (`FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD`,
  `FEATURE-NOTIFICATIONS-CHANNEL-SLACK-TELEGRAM`).
- REST/websocket surface (already delivered by `FEATURE-NOTIFICATIONS-BACKEND-API` by the time this task
  starts).
- Any emitter.

## 4. Acceptance criteria

- [ ] `INotificationChannel` declares `getType(): string`, `isConfigured(): Promise<boolean>`,
      `getMinSeverity(): Promise<NotificationSeverity>`, `send(notification): Promise<void>`.
- [ ] `BaseNotificationChannel` implements `isConfigured()` and `getMinSeverity()` from the plugin's config
      via `ConfigService.getPluginConfig(type)`, delegating the required-fields check to an abstract
      `hasRequiredConfig(config)`; `getMinSeverity()` defaults to `WARNING` when the config has no
      `min_severity`.
- [ ] `BaseNotificationChannel` exposes `formatText(notification)` producing a shared wording (title,
      severity, source, message, occurrences) and `fetchWithTimeout(url, init)` using
      `AbortSignal.timeout(10_000)`.
- [ ] `NotificationChannelRegistryService.register(channel)` throws when a channel of the same `getType()` is
      already registered.
- [ ] `NotificationChannelRegistryService.isChannel(source)` returns `true` for any registered channel's
      type, used as the dispatcher's loop guard.
- [ ] The dispatcher subscribes to `EventType.NOTIFICATION_CREATED`, loads the row with `findOne(id)`, and
      skips dispatch entirely when `registry.isChannel(entity.source)` is true.
- [ ] For each registered channel, delivery is skipped when the owning extension is disabled
      (`configService.getPluginConfig(type).enabled === false`).
- [ ] Delivery is skipped when `channel.isConfigured()` resolves `false`.
- [ ] Delivery is skipped when `SEVERITY_RANK[entity.severity] < SEVERITY_RANK[await channel.getMinSeverity()]`.
- [ ] Channels are dispatched in parallel to each other (`Promise.allSettled`) but attempts within one
      channel are sequential.
- [ ] Each channel gets up to 3 send attempts with delays of 1000 ms, 5000 ms and 25000 ms between attempts
      (delay mechanism injectable for tests).
- [ ] After the third failed attempt, the dispatcher logs the channel type and error message (never the URL)
      and raises `notify({ source: channel.getType(), kind: ISSUE, key: 'delivery-failed', severity: WARNING,
      title: 'Notification delivery failed', ..., actions: [{ type: LINK, label: 'Open channel settings',
      url: '/config/plugins/<type>' }] })`.
- [ ] After a successful delivery, the dispatcher calls `resolve(channel.getType(), 'delivery-failed')`.
- [ ] One failing channel does not block delivery to another channel.
- [ ] Deliveries to the same channel preserve message order even under a burst (serialised with a promise
      chain).
- [ ] Dispatcher spec covers: filter by disabled, filter by unconfigured, filter by below-minimum severity,
      the loop guard, the three-attempt retry followed by self-report, a success resolving a prior
      self-report, one channel's failure not blocking another, and order preservation within one channel -
      using fake channels and a fake `sleep`.
- [ ] Registry spec covers: duplicate-type registration throws, and `isChannel` correctly identifies
      registered types.
- [ ] `cd apps/backend && npx jest src/modules/notifications` passes.

## 6. Technical constraints

- Depends on: N-1 / FEATURE-NOTIFICATIONS-BACKEND-CORE.
- Follow the existing registry pattern (`ExtensionActionRegistryService`) for register/duplicate-throw
  semantics.
- Never log channel secrets or URLs; log channel type and status/error only.
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
	send(notification: NotificationEntity): Promise<void>;
}

export abstract class BaseNotificationChannel implements INotificationChannel {
	protected constructor(protected readonly configService: ConfigService, protected readonly type: string) {}
	getType(): string;
	async isConfigured(): Promise<boolean>;             // default: plugin enabled and required fields present, via abstract hasRequiredConfig(config)
	async getMinSeverity(): Promise<NotificationSeverity>; // reads `min_severity` from the plugin config, default WARNING
	protected abstract hasRequiredConfig(config: PluginConfigModel): boolean;
	abstract send(notification: NotificationEntity): Promise<void>;
	protected formatText(notification: NotificationEntity): string; // "[ERROR] Title\nmessage\nSource: x - 3 occurrences"
	protected fetchWithTimeout(url: string, init: RequestInit): Promise<Response>; // AbortSignal.timeout(10_000)
}

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
- Attempts: 3, delays 1 000, 5 000, 25 000 ms (injectable `sleep` for tests); each attempt awaits `send`.
- After the last failure: `logger.error` with channel type and error message (never the URL), then
  `notificationsService.notify({ source: channel.getType(), kind: ISSUE, key: 'delivery-failed', severity: WARNING, title: 'Notification delivery failed', message, actions: [{ type: 'link', label: 'Open channel settings', url: '/config/plugins/<type>' }] })`.
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
