# Task: Notifications SDK types and documentation

ID: FEATURE-NOTIFICATIONS-SDK-DOCS
Type: feature
Scope: backend, admin
Size: small
Parent: EPIC-NOTIFICATIONS-MODULE
Status: planned

## 1. Business goal

In order to let third-party extensions raise and resolve notifications and register channels, and for
developers to find how the module works,
As a Smart Panel extension developer,
I want the notification types exported from the extension SDK, a worked example, and developer documentation
covering the emitter and channel contracts.

## 2. Context

- This is task N-11; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Depends on `FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH` (N-3), since the SDK's `NotificationChannel` interface
  must mirror the final `INotificationChannel` and the emitter contract must be final before it is
  documented.
- Read the full spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`) before writing
  anything, especially "Concepts" (Notification, Actions), "Lifecycle", "Emitter contract" and "Channel
  plugin contract" - this task summarizes the whole feature, not one narrow slice of it.
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-11 section.
- SDK precedent: `packages/extension-sdk/src/action.types.ts`, exported from
  `packages/extension-sdk/src/index.ts` - the pattern `FEATURE-EXTENSION-ACTIONS-MVP` established for action
  types is the template for `notification.types.ts`.
- `tasks/features/FEATURE-INFLUXDB-MEMORY-FALLBACK.md` needs a note that its admin notification is now
  delivered by the notifications module (the `fallback-active` issue raised by
  `FEATURE-NOTIFICATIONS-EMITTERS-INTEGRATIONS`).

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/896 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- `packages/extension-sdk/src/notification.types.ts` exporting `NotificationKind`, `NotificationSeverity`,
  `NotificationAction`, `CreateNotificationInput`, a `NotificationChannel` interface mirroring
  `INotificationChannel` with a plain `Notification` payload type, and the shape of `ChannelDeliveryError`
  (`message: string`, `retryable: boolean`, `status?: number`) alongside it.
- Export from `packages/extension-sdk/src/index.ts`; update `packages/extension-sdk/README.md`.
- A `notify` call added to the example service in `packages/example-extension/**`, behind the existing
  pattern.
- New `docs/notifications.md`: developer guide covering emitting, the lifecycle table, writing a channel,
  testing, and the webhook channel's payload shape.
- A Notifications section added to `docs/extensions.md`.
- A module table row and plugin category row added to `docs/architecture.md`.
- The module list and architecture reference line updated in `CLAUDE.md`.
- A note added to `tasks/features/FEATURE-INFLUXDB-MEMORY-FALLBACK.md` that the admin notification is now
  delivered by the notifications module.

**Out of scope**

- Any change to the notifications module's actual backend or admin code (`FEATURE-NOTIFICATIONS-BACKEND-CORE`
  through `FEATURE-NOTIFICATIONS-EMITTERS-INTEGRATIONS` own that).
- New SDK types beyond notifications (e.g. extending the action types).

## 4. Acceptance criteria

- [ ] `packages/extension-sdk/src/notification.types.ts` exports `NotificationKind`, `NotificationSeverity`,
      `NotificationAction` (the three-variant discriminated union: `link`, `extension_action`, `service`),
      `CreateNotificationInput`, and a `NotificationChannel` interface mirroring `INotificationChannel`
      (`getType`, `isConfigured`, `getMinSeverity`, `send(notification, signal: AbortSignal)`) with a plain
      `Notification` payload type usable outside the backend's TypeORM entity.
- [ ] `packages/extension-sdk/src/notification.types.ts` also exports the shape of `ChannelDeliveryError`
      (`message: string`, `retryable: boolean`, `status?: number`) alongside the `NotificationChannel` interface, so a
      third-party channel implementation can type the errors it throws.
- [ ] `packages/extension-sdk/src/index.ts` exports everything from `notification.types.ts`.
- [ ] `packages/extension-sdk/README.md` documents the new exports.
- [ ] `packages/example-extension/**` gains one `notify` call demonstrating the pattern, following the
      existing example structure.
- [ ] `docs/notifications.md` exists and covers: how to emit a notification, the full lifecycle table (event
      without key / event with key / issue, for `notify`, `resolve`, boot, user dismiss, retention, channel
      delivery), how to write a channel plugin, how to test an emitter or a channel, and the generic webhook
      channel's exact JSON payload shape.
- [ ] `docs/extensions.md` gains a Notifications section describing how an extension raises notifications and
      registers a channel.
- [ ] `docs/architecture.md` gains a row for the `notifications` module in its module table and a row for the
      notification-channel plugin category.
- [ ] `CLAUDE.md`'s module list and architecture-reference-file line mention the notifications module.
- [ ] `tasks/features/FEATURE-INFLUXDB-MEMORY-FALLBACK.md` notes that its admin notification is now delivered
      by the notifications module (the `fallback-active` issue).
- [ ] No documentation references a type or field name that `FEATURE-NOTIFICATIONS-BACKEND-CORE` or
      `FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH` did not actually define.
- [ ] `pnpm --filter ./packages/extension-sdk run build` (or its lint) succeeds, and the example extension
      builds.

## 6. Technical constraints

- Depends on: N-3 / FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH.
- Do not introduce new dependencies in the SDK package.
- Keep the SDK's `Notification`/`NotificationChannel` types free of any backend-only import (no TypeORM
  entity, no NestJS decorator).
- Documentation must not describe behaviour beyond what the merged tasks (N-1 through N-3 at minimum, and
  N-4 through N-10 where already merged) actually implement.
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `docs(cross): document the notifications module and export its SDK types`
- Suggested worker tier: implementer sonnet / low, reviewer sonnet / low.

## 7. Implementation hints

From the plan's Task N-11 Files list (verbatim):

- Create: `packages/extension-sdk/src/notification.types.ts` (`NotificationKind`, `NotificationSeverity`,
  `NotificationAction`, `CreateNotificationInput`, `NotificationChannel` interface mirroring
  `INotificationChannel` with a plain `Notification` payload type, and the shape of `ChannelDeliveryError`
  (`message: string`, `retryable: boolean`, `status?: number`) alongside it)
- Modify: `packages/extension-sdk/src/index.ts` (export), `packages/extension-sdk/README.md`
- Modify: `packages/example-extension/**` (a `notify` call in the example service, behind the existing
  pattern)
- Create: `docs/notifications.md` (developer guide: emitting, lifecycle table, writing a channel, testing,
  payload of the webhook channel)
- Modify: `docs/extensions.md` (Notifications section), `docs/architecture.md` (module table row, plugin
  category row), `CLAUDE.md` (module list and architecture reference line)
- Modify: `tasks/features/FEATURE-INFLUXDB-MEMORY-FALLBACK.md` (note that the admin notification is now
  delivered by the notifications module)

From the plan's Verification note: "Markdown reads against the spec; no reference to a type name that
N-1/N-3 did not define."

No TypeScript code block is given in the plan for this task beyond what N-1 and N-3 already define; derive
`notification.types.ts` directly from the spec's `NotificationAction` union (Concepts -> Actions) and from
`FEATURE-NOTIFICATIONS-BACKEND-CORE`'s `CreateNotificationInput`/`NotificationsService` interfaces and
`FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH`'s `INotificationChannel` and `ChannelDeliveryError`.

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`) and plan
  (`docs/superpowers/plans/2026-09-02-notifications-module.md`) in full - this task documents the whole
  epic, not one task section, so read both documents end to end before writing.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
