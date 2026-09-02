# Task: Integration, storage, throttling and security emitters

ID: FEATURE-NOTIFICATIONS-EMITTERS-INTEGRATIONS
Type: feature
Scope: backend
Size: medium
Parent: EPIC-NOTIFICATIONS-MODULE
Status: planned

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
  (`:579` auth failure, `:312` reconnect scheduling), `apps/backend/src/modules/storage/services/storage.service.ts`
  (`isUsingFallback()` at `:122`), new `apps/backend/src/modules/system/services/system-throttle-monitor.service.ts`
  (reads `platform/platforms/raspberry.platform.ts:96-123` via `SystemService`, registered in
  `system.module.ts`), new `apps/backend/src/modules/security/listeners/security-notifications.listener.ts`
  (registered in `security.module.ts`).
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
- Storage fallback `issue`, key `fallback-active`, severity `warning`: raised when `isUsingFallback()` turns
  `true`, resolved when primary storage becomes available again, with a `link` CTA to
  `/extensions?tab=services`.
- New `SystemThrottleMonitorService`, `@Cron('*/5 * * * *')`, raising `issue`, key `throttle:<flag>`,
  severity `warning` (`critical` for an active under-voltage flag), resolving when the flag clears; no-op on
  platforms without throttle data.
- New `SecurityNotificationsListener`, `@OnEvent` on the security alert raised/resolved events, raising
  `issue`, key `alert:<alertId>`, severity `critical`, with a `link` CTA to `/security`; resolving when the
  alert resolves.

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
- [ ] `storage.service.ts` raises `notify({ kind: ISSUE, key: 'fallback-active', severity: WARNING, ...,
      actions: [{ type: LINK, url: '/extensions?tab=services' }] })` when `isUsingFallback()` becomes `true`,
      evaluated where the primary storage's availability changes.
- [ ] `storage.service.ts` calls `resolve(..., 'fallback-active')` when the primary storage becomes available
      again.
- [ ] `SystemThrottleMonitorService` runs on `@Cron('*/5 * * * *')`, reads the throttle flags through
      `SystemService`, and raises `issue`, key `throttle:<flag>`, severity `warning` (or `critical` when the
      currently-active flag is under-voltage) for each active flag.
- [ ] `SystemThrottleMonitorService` resolves a `throttle:<flag>` issue once that flag clears, and is a no-op
      (raises nothing) on a platform that returns no throttle data.
- [ ] The throttle test proves a flag that flaps (sets then clears) produces exactly one raise and one
      resolve, not one per cron tick.
- [ ] `SecurityNotificationsListener` reacts to the security module's alert-raised event by raising `issue`,
      key `alert:<alertId>`, severity `critical`, with a `link` CTA to `/security`.
- [ ] `SecurityNotificationsListener` reacts to the alert-resolved event by calling `resolve(...,
      'alert:<alertId>')`.
- [ ] `SystemThrottleMonitorService` is registered in `system.module.ts`; `SecurityNotificationsListener` is
      registered in `security.module.ts`.
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
- Modify: `apps/backend/src/modules/storage/services/storage.service.ts` (raise `fallback-active` when
  `isUsingFallback()` turns true, resolve when false; evaluated where the primary storage availability
  changes)
- Create: `apps/backend/src/modules/system/services/system-throttle-monitor.service.ts` (`@Cron('*/5 * * * *')`,
  reads the throttle flags through `SystemService`, raises `throttle:<flag>` per active flag, resolves
  cleared ones; no-op on platforms without throttle data) and spec; register in `system.module.ts`
- Create: `apps/backend/src/modules/security/listeners/security-notifications.listener.ts` (`@OnEvent` on
  the security alert raised/resolved events; `alert:<alertId>`, `critical`, link `/security`) and spec;
  register in `security.module.ts`
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
