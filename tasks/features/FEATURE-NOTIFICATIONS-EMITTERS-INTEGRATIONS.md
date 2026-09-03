# Task: Integration, storage, throttling and security emitters

ID: FEATURE-NOTIFICATIONS-EMITTERS-INTEGRATIONS
Type: feature
Scope: backend
Size: medium
Parent: EPIC-NOTIFICATIONS-MODULE
Status: review

## 1. Business goal

In order to see integration, storage, hardware and security-alert conditions as notifications,
As a Smart Panel administrator,
I want Home Assistant connection loss, the storage memory fallback, Raspberry Pi throttling flags, and
security alerts to raise and resolve notifications.

## 2. Context

- This is task N-10; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Depends on `FEATURE-NOTIFICATIONS-EMITTERS-CORE` (N-4), which establishes the emitter pattern this task
  follows, and transitively on `FEATURE-NOTIFICATIONS-BACKEND-CORE` (N-1) for `NotificationsService`.
- Spec: `docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "First emitters" -> "Batch 2"
  table.
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-10 section.
- Files to modify/create: `apps/backend/src/plugins/devices-home-assistant/services/home-assistant.ws.service.ts`
  (`:579` auth failure, `:312` reconnect scheduling); new
  `apps/backend/src/modules/storage/services/storage-fallback-monitor.service.ts` (`@Cron('* * * * *')`,
  compares the last observed `StorageService.isUsingFallback()` (`storage.service.ts:122`, a pure getter with
  no transition hook) value with the current one, registered in `storage.module.ts`); new
  `apps/backend/src/modules/system/services/system-throttle-monitor.service.ts` (reads
  `SystemService.getThrottleStatus()` at `system.service.ts:29`, registered in `system.module.ts`); and
  `apps/backend/src/modules/security/services/security-events.service.ts` (`doRecordAlertTransitions` at
  `:159-181`; alerts are detected as transitions inside this service, not emitted on the event bus, so there
  is no listener to subscribe to).
- The channel-delivery-failed self-report is implemented by the dispatcher in
  `FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH`, not by this task; this task's scope is the remaining four
  condition sources named in the spec's batch 2 table.
- The spec notes this task closes the stale checkbox referenced in
  `tasks/features/FEATURE-INFLUXDB-MEMORY-FALLBACK.md` about the storage-fallback admin notification; the
  doc note itself is written by `FEATURE-NOTIFICATIONS-SDK-DOCS` (N-11), not by this task.

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/895 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- Home Assistant `issue`, key `connection`, severity `error`: raised when `auth_ok` is missing at `:579`, and
  when a reconnect is scheduled at `:312` but only after the first reconnect attempt fails (a single blip
  stays silent); resolved when `auth_ok` is received; `stop()` calls `resolveAll(source)`.
- New `StorageFallbackMonitorService`, `@Cron('* * * * *')`, comparing the last observed
  `StorageService.isUsingFallback()` value with the current one: raises `issue`, key `fallback-active`,
  severity `warning`, on the false->true transition, with a `link` CTA to `/extensions?tab=services`,
  resolved on the true->false transition; tracks `isConnected()` the same way and raises `issue`, key
  `storage-unavailable`, severity `error`, on its true->false transition, resolving it on false->true.
- New `SystemThrottleMonitorService`, `@Cron('*/5 * * * *')`, reading `SystemService.getThrottleStatus()`
  fields `undervoltage`, `throttling`, `frequencyCapping` and `softTempLimit`: raises `issue`, key
  `throttle:undervoltage`, severity `critical`, and keys `throttle:throttling`, `throttle:frequency_capping`,
  `throttle:soft_temp_limit`, severity `warning`, while each flag is set; resolving when the flag clears;
  no-op on platforms without throttle data.
- `SecurityEventsService.doRecordAlertTransitions` (`security-events.service.ts:159-181`), calling `notify`
  alongside the `ALERT_RAISED` point (`issue`, key `alert:<alertId>`, severity `critical`, with a `link` CTA
  to `/security`) and `resolve` alongside `ALERT_RESOLVED`.

**Out of scope**

- Batch 1 emitters (`FEATURE-NOTIFICATIONS-EMITTERS-CORE`, already merged).
- The dispatcher's own `delivery-failed` self-report (`FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH`).
- Any admin UI change.

## 4. Acceptance criteria

- [ ] A Home Assistant auth failure (missing `auth_ok` at `home-assistant.ws.service.ts:579`) raises
      `notify({ source: <plugin type>, kind: ISSUE, key: 'connection', severity: ERROR, ... })`.
- [ ] A reconnect scheduled at `:312` raises the same `connection` issue, but only after the first reconnect
      attempt has already failed, so a single connectivity blip produces no notification.
- [ ] Receiving `auth_ok` calls `resolve(<plugin type>, 'connection')`.
- [ ] The plugin's `stop()` calls `resolveAll(<plugin type>)` so disabling the plugin clears its connection
      issue.
- [ ] The HA test proves a single reconnect blip stays silent and only a second consecutive failure raises
      the issue.
- [ ] `StorageFallbackMonitorService` (`@Cron('* * * * *')`) compares the last observed
      `StorageService.isUsingFallback()` value with the current one and raises `notify({ kind: ISSUE, key:
      'fallback-active', severity: WARNING, ..., actions: [{ type: LINK, url: '/extensions?tab=services' }]
      })` on the false->true transition.
- [ ] `StorageFallbackMonitorService` calls `resolve(..., 'fallback-active')` on the true->false transition.
- [ ] `StorageFallbackMonitorService` raises `notify({ kind: ISSUE, key: 'storage-unavailable', severity:
      ERROR, ... })` on the `StorageService.isConnected()` true->false transition and calls
      `resolve(..., 'storage-unavailable')` on the false->true transition; a disconnect/reconnect test covers
      both, and a stable disconnected state produces one raise, not one per tick.
- [ ] `StorageFallbackMonitorService` is registered in `storage.module.ts`.
- [ ] `SystemThrottleMonitorService` runs on `@Cron('*/5 * * * *')`, reads `SystemService.getThrottleStatus()`
      fields `undervoltage`, `throttling`, `frequencyCapping` and `softTempLimit`, and raises `issue` for each
      active flag: key `throttle:undervoltage` at severity `critical`; keys `throttle:throttling`,
      `throttle:frequency_capping` and `throttle:soft_temp_limit` at severity `warning`.
- [ ] `SystemThrottleMonitorService` resolves a `throttle:<flag>` issue once that flag clears, and is a no-op
      (raises nothing) on a platform that returns no throttle data.
- [ ] The throttle test proves a flag that flaps (sets then clears) produces exactly one raise and one
      resolve, not one per cron tick.
- [ ] `SecurityEventsService.doRecordAlertTransitions` (`:159-181`) calls `notify({ source:
      SECURITY_MODULE_NAME, kind: ISSUE, key: 'alert:<alertId>', severity: CRITICAL, title: 'Security alert:
      <type>', actions: [{ type: LINK, label: 'Open security', url: '/security', primary: true }], data: {
      alert_type, source_device_id } })` alongside the `ALERT_RAISED` point.
- [ ] `SecurityEventsService.doRecordAlertTransitions` calls `resolve(..., 'alert:<alertId>')` alongside the
      `ALERT_RESOLVED` point.
- [ ] `SystemThrottleMonitorService` is registered in `system.module.ts`.
- [ ] `cd apps/backend && npx jest src/plugins/devices-home-assistant src/modules/storage src/modules/system src/modules/security`
      passes.
- [ ] Backend `lint:js`, `lint:api`, `type-check` pass.

## 6. Technical constraints

- Depends on: N-4 / FEATURE-NOTIFICATIONS-EMITTERS-CORE.
- Raise an issue only when a condition starts and resolve only when it clears; never raise on every
  poll/retry tick.
- A managed service or plugin should call `resolveAll(source)` in `stop()` so disabling it clears its
  issues.
- Never include secrets or tokens in `title`, `message` or `data`.
- Tabs, single quotes, semicolons, trailing commas; print width 120; import ordering as elsewhere.
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `feat(backend): raise notifications for integration, storage, throttling and security conditions`
- Suggested worker tier: implementer sonnet / high, reviewer sonnet / medium.

## 7. Implementation hints

From the plan's Task N-10 Files list (verbatim):

- Modify: `apps/backend/src/plugins/devices-home-assistant/services/home-assistant.ws.service.ts` (`:579`
  auth failure raises; `:312` raises after the first failed reconnect attempt; `auth_ok` resolves; `stop()`
  calls `resolveAll`)
- Create: `apps/backend/src/modules/storage/services/storage-fallback-monitor.service.ts`
  (`@Cron('* * * * *')`; compares the last observed value of `StorageService.isUsingFallback()`
  (`storage.service.ts:122`, a pure getter with no transition hook) with the current one; raises
  `fallback-active` (`warning`) on the false->true transition and resolves on true->false; tracks
  `isConnected()` the same way, raising `storage-unavailable` (`error`) on true->false and resolving it on
  false->true; tests cover both transition pairs) and spec; register in `storage.module.ts`
- Create: `apps/backend/src/modules/system/services/system-throttle-monitor.service.ts` (`@Cron('*/5 * * * *')`,
  reads `SystemService.getThrottleStatus()` (`system.service.ts:29`, fields `undervoltage`,
  `frequencyCapping`, `throttling`, `softTempLimit`), raises `throttle:undervoltage` (`critical`),
  `throttle:throttling`, `throttle:frequency_capping`, `throttle:soft_temp_limit` (`warning`) while the flag
  is set and resolves cleared ones; no-op when the platform returns no throttle data) and spec; register in
  `system.module.ts`
- Modify: `apps/backend/src/modules/security/services/security-events.service.ts`
  (`doRecordAlertTransitions`, `:159-181`: alongside the `ALERT_RAISED` point call `notify({ source:
  SECURITY_MODULE_NAME, kind: ISSUE, key: `alert:${alert.id}`, severity: CRITICAL, title: `Security alert:
  ${alert.type}`, actions: [{ type: LINK, label: 'Open security', url: '/security', primary: true }], data: {
  alert_type, source_device_id } })`; alongside `ALERT_RESOLVED` call `resolve`) and its spec. Alerts are
  detected as transitions inside this service, not emitted on the event bus, so there is no listener to
  subscribe to.
- Modify: matching spec files

From the plan's Tests note: "each emitter's raise and resolve pair; the HA test proves a single reconnect
blip stays silent and the second failure raises; the throttle test proves flag flapping produces one raise
and one resolve."

No TypeScript interface snippet is given in the plan for this task beyond the emitter contract already
defined in `FEATURE-NOTIFICATIONS-BACKEND-CORE`; follow the `notify`/`resolve` call shapes established by
`FEATURE-NOTIFICATIONS-EMITTERS-CORE`'s emitters for consistency (same `source`/`kind`/`key`/`severity`/`actions`
argument shape).

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "First emitters" batch 2
  table) and plan (`docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-10 section) in full
  before making any code changes.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
