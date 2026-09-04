# Task: Core emitters: updates, service failures, failed logins

ID: FEATURE-NOTIFICATIONS-EMITTERS-CORE
Type: feature
Scope: backend
Size: small
Parent: EPIC-NOTIFICATIONS-MODULE
Status: done

## 1. Business goal

In order to see update availability, update failures, managed service failures and failed login attempts as
notifications instead of only log lines,
As a Smart Panel administrator,
I want the update service, update executor, managed service manager and auth service to raise and resolve
notifications for these conditions.

## 2. Context

- This is task N-4; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Depends on `FEATURE-NOTIFICATIONS-BACKEND-CORE` (N-1) for `NotificationsService`, and on
  `FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH` (N-3) for `sanitizeErrorMessage`, used to scrub the managed
  service's `lastError` before it becomes a notification `message`.
- Spec: `docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "First emitters" -> "Batch 1"
  table, and the "Emitter contract" section (raise on start, resolve on end, never raise on every retry
  tick).
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-4 section.
- Files to modify: `apps/backend/src/modules/system/services/update.service.ts` (after the scheduled and
  manual check results), `apps/backend/src/modules/system/services/update-executor.service.ts:73` (the
  `FAILED` state), `apps/backend/src/modules/extensions/services/managed-service-manager.service.ts` (state
  transitions to `error` and to `started`; readiness retries exhausted at `:795`),
  `apps/backend/src/modules/auth/services/auth.service.ts:91-119` (`login`),
  `apps/backend/src/modules/auth/controllers/auth.controller.ts` (pass `req.ip`), and their four matching
  `*.spec.ts` files.
- This task removes the need for `update-notification-badge.vue` (deleted in
  `FEATURE-NOTIFICATIONS-ADMIN-BELL`), by replacing it with the `update-available` issue notification.

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/889 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- `update-available` issue notification raised after the 12-hour scheduled check and the manual check;
  resolved when no update is available or the update installs.
- `update-failed` persistent issue notification raised when the update run reaches `FAILED`; resolved when
  the next update run succeeds, or left in place until the user dismisses it.
- Managed service `error` issue notification, keyed `service:<kind>:<type>:<serviceId>`, with a restart
  `service` CTA and a `link` to the services tab; resolved when the service reports `started`.
- Failed-login `event` notification, keyed `login-failed:<user>:<client>:<yyyy-mm-dd-hh>` (`user` is
  `username` truncated to 64 characters, `client` is `ip` or `unknown` when absent), aggregated per
  user/IP/hour with a bounded in-memory counter; `AuthService.login` gains an optional `context: { ip?:
  string }` argument.

**Out of scope**

- Batch 2 emitters: Home Assistant, storage fallback, throttling, security alerts
  (`FEATURE-NOTIFICATIONS-EMITTERS-INTEGRATIONS`).
- The channel registry/dispatcher itself (`FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH`, already merged by then).
- Admin-side removal of `update-notification-badge.vue` (`FEATURE-NOTIFICATIONS-ADMIN-BELL`).

## 4. Acceptance criteria

- [ ] After the scheduled (12 h cron) or manual update check finds a newer version, `notify({ source:
      SYSTEM_MODULE_NAME, kind: ISSUE, key: 'update-available', severity: INFO, title: 'Update
      <latestVersion> is available', message: 'Installed <currentVersion>. Channel: <channel>.', actions:
      [{ type: LINK, label: 'View update', url: '/system/info', primary: true }], data: { current_version,
      latest_version } })` is called.
- [ ] `resolve(SYSTEM_MODULE_NAME, 'update-available')` is called when a check reports no update available,
      and when an update install succeeds.
- [ ] When the update run reaches `FAILED` in `update-executor.service.ts`, `notify` is called with `kind:
      ISSUE`, `key: 'update-failed'`, `severity: ERROR`, `persistent: true`, and a `link` CTA to
      `/system/info`.
- [ ] `update-failed` is `persistent: true`, so it is not auto-resolved at boot; it is resolved only when the
      next update run succeeds (`resolve(SYSTEM_MODULE_NAME, 'update-failed')`), or left in place until the
      user dismisses it.
- [ ] A managed service entering `error` (start failure, or readiness retries exhausted at
      `managed-service-manager.service.ts:795`) calls `notify` with `kind: ISSUE`, `key:
      'service:<kind>:<type>:<serviceId>'`, `severity: ERROR`, `message` carrying
      `sanitizeErrorMessage(lastError)`, and two actions: a primary `service` restart action and a `link` to
      `/extensions?tab=services&kind=<kind>`.
- [ ] A managed service transitioning back to `started` calls `resolve` for that same key.
- [ ] The manager spec proves a service that fails then starts produces exactly one raise and one resolve.
- [ ] `AuthService.login` accepts an optional `context?: { ip?: string }` parameter and existing callers still
      compile unchanged.
- [ ] `AuthController` passes `req.ip` as the login context.
- [ ] Each of the three failure paths in `auth.service.ts:102,108,117` normalises `const user =
      username.slice(0, 64)` and `const client = ip ?? 'unknown'` once and reuses those same values
      everywhere: the key, the title, the message and `data`. `notify` is called with `kind: EVENT`,
      `severity: WARNING`, `key: 'login-failed:<user>:<client>:<yyyy-mm-dd-hh>'` (UTC hour bucket),
      `title: 'Failed login attempt for "<user>"'`, `message: 'From <client> - <count> attempt(s) this hour'`,
      `data: { username: user, ip: client, reason }`.
- [ ] An in-memory `Map<string, number>` counter tracks attempts per key; entries whose hour bucket is in the
      past are pruned on every call, so the message's `count` increments correctly.
- [ ] The counter map never exceeds 1000 keys: when a new key would exceed the limit, the oldest key is
      evicted first.
- [ ] The auth spec proves three failures within one hour call `notify` three times with the same key and
      `count` 1, 2, 3.
- [ ] A test proves the counter map stays bounded at 1000 keys: once at the limit, adding a new key evicts the
      oldest one rather than growing the map further.
- [ ] For each of the four emitters, a test proves the raising condition calls `notify` with the exact
      `source`, `kind`, `key`, `severity` and primary action, and a second test proves the clearing condition
      calls `resolve`.
- [ ] `cd apps/backend && npx jest src/modules/system src/modules/extensions src/modules/auth` passes.

## 6. Technical constraints

- Depends on: N-1 / FEATURE-NOTIFICATIONS-BACKEND-CORE and N-3 / FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH (for
  `sanitizeErrorMessage`).
- Never include secrets or tokens in `title`, `message` or `data`.
- Raise an issue when a condition starts and resolve it when it ends; never raise on every retry tick (only
  after the readiness retries are exhausted, per the spec).
- Tabs, single quotes, semicolons, trailing commas; print width 120; import ordering as elsewhere.
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `feat(backend): raise notifications for updates, service failures and failed logins`
- Suggested worker tier: implementer sonnet / high, reviewer sonnet / medium.

## 7. Implementation hints

Copy verbatim from the plan's Task N-4 "Interfaces (consumes N-1 `NotificationsService`)" block:

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
title: `Failed login attempt for "${user}"`, message: `From ${client} - ${count} attempt(s) this hour`,
data: { username: user, ip: client, reason },
```

The auth emitter keeps an in-memory `Map<string, number>` counter per key so the message carries the count; it
is bounded: entries of past hour buckets are pruned on every call, and the map never exceeds 1000 keys (the
oldest key is evicted when a new one would exceed it), so a flood of distinct usernames or IPs cannot grow it.
`AuthService.login` gains an optional `context` argument so existing callers compile unchanged.

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "First emitters" batch 1
  table and "Emitter contract" section) and plan
  (`docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-4 section) in full before making any
  code changes.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
