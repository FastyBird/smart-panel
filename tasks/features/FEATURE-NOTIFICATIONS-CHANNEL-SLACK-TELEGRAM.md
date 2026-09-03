# Task: Slack and Telegram notification channels

ID: FEATURE-NOTIFICATIONS-CHANNEL-SLACK-TELEGRAM
Type: feature
Scope: backend, admin
Size: small
Parent: EPIC-NOTIFICATIONS-MODULE
Status: planned

## 1. Business goal

In order to forward notifications to Slack or Telegram,
As a Smart Panel administrator,
I want to enable and configure a Slack channel plugin and a Telegram channel plugin with the same layout,
secret handling and test action as the webhook and Discord channels.

## 2. Context

- This is task N-9; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Depends on `FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD` (N-8) for the reference plugin layout (file
  structure, secret pattern, `send-test` action, both regression tables) that this task copies for two more
  plugins.
- Spec: `docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "First channels" table (Slack,
  Telegram rows).
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-9 section.

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/894 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope**

- `plugins/notifications-slack/**` and `plugins/notifications-telegram/**` on both backend and admin,
  mirroring the exact file layout `FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD` established for
  webhook/Discord.
- Secret regression table rows for `webhook_url` (Slack) and `bot_token` (Telegram).
- Registration lines in `app.module.ts` and `app.main.ts`.

**Out of scope**

- Any change to the webhook or Discord plugins from `FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD`.
- Core registry/dispatcher.

## 4. Acceptance criteria

- [ ] `notifications-slack` config model exposes `webhook_url` (write-only secret) and `min_severity`; the DTO
      rejects a `webhook_url` that does not start with `https://`.
- [ ] `notifications-telegram` config model exposes `bot_token` (write-only secret), `chat_id` (string) and
      `min_severity`.
- [ ] The Slack channel's `send()` posts `{ text: title, attachments: [{ color, title, text: message, footer
      }] }` to the configured incoming webhook, with colours `#3498db` (info), `#f39c12` (warning),
      `#e74c3c` (error), `#8e44ad` (critical), using `fetchWithSignal` with the dispatcher's signal and
      `redirect: 'error'`; every failure outcome (connection failure, 429, 5xx, timeout, redirect, other 4xx)
      throws a `ChannelDeliveryError` with the status and the classification from `classify()`.
- [ ] The Telegram channel's `send()` calls `POST https://api.telegram.org/bot<token>/sendMessage` with `{
      chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }` via `fetchWithSignal` with the
      dispatcher's signal and `redirect: 'error'`, then parses the JSON reply and throws a non-retryable
      `ChannelDeliveryError` unless `ok === true` (the Bot API can answer HTTP 200 with `ok: false`); every
      other failure outcome (connection failure, 429, 5xx, timeout, redirect, other 4xx) throws a
      `ChannelDeliveryError` with the status and the classification from `classify()`.
- [ ] The Telegram channel HTML-escapes `<`, `>` and `&` in both `title` and `message` before building
      `text`.
- [ ] The Telegram channel never logs the bot token; log output includes only `api.telegram.org` and the
      response status.
- [ ] Each plugin registers its own `send-test` extension action identical in shape to
      `FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD`'s: it calls the channel's own
      `send(sample, AbortSignal.timeout(10_000))` and returns the sanitized error text on failure.
- [ ] Both plugins' secrets (`webhook_url` for Slack, `bot_token` for Telegram) are redacted through
      `secretFields` and gain rows in `apps/admin/src/plugins/config-secrets.spec.ts` and
      `apps/backend/src/plugins/plugin-secret-removal.spec.ts`.
- [ ] A Telegram-specific test proves the HTML-escaping of `<`, `>` and `&` in the outgoing text.
- [ ] A Telegram-specific test proves an `ok: false` JSON reply (with an HTTP 200 status) causes `send()` to
      throw a non-retryable `ChannelDeliveryError`.
- [ ] A Slack config DTO test proves a `webhook_url` that does not start with `https://` is rejected.
- [ ] Channel specs (mocked `fetch`) assert request shape for both plugins, matching the coverage
      `FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD` established.
- [ ] `cd apps/backend && npx jest src/plugins/notifications-slack src/plugins/notifications-telegram src/plugins/plugin-secret-removal.spec.ts`
      passes.
- [ ] `pnpm run generate:openapi`, then
      `cd apps/admin && npx vitest run src/plugins/notifications-slack src/plugins/notifications-telegram src/plugins/config-secrets.spec.ts`
      passes.
- [ ] Backend `lint:js`, `lint:api`, `lint:openapi` and admin `type-check`, `lint:js` all pass.

## 6. Technical constraints

- Depends on: N-8 / FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD.
- No new runtime dependencies; both channels call `fetchWithSignal(url, init, signal)` with the
  `AbortSignal` the dispatcher passes into `send(notification, signal)`, not a channel-owned
  `AbortSignal.timeout`.
- The Telegram bot token must never appear in logs.
- Mirror the exact file layout, naming and secret pattern
  `FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD` established rather than inventing a new shape.
- Tabs, single quotes, semicolons, trailing commas; print width 120 (backend) / 150 (admin).
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `feat(cross): add Slack and Telegram notification channels`
- Suggested worker tier: implementer sonnet / low, reviewer sonnet / low.

## 7. Implementation hints

From the plan's Task N-9:

**Config:** Slack `webhook_url` (secret), `min_severity`; Telegram `bot_token` (secret), `chat_id` (string),
`min_severity`. Slack's `webhook_url` must start with `https://`, rejected by the DTO otherwise.

**Payloads:** Slack `{ text: title, attachments: [{ color, title, text: message, footer }] }` with colours
`#3498db / #f39c12 / #e74c3c / #8e44ad`; Telegram `POST https://api.telegram.org/bot<token>/sendMessage` with
`{ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }`, HTML-escaping `<`, `>`, `&` in title
and message; `send` parses the JSON reply and throws a non-retryable `ChannelDeliveryError` unless `ok ===
true` (the Bot API can answer HTTP 200 with `ok: false`); the token never appears in logs (log
`api.telegram.org` and the status only). Both channels call `fetchWithSignal` with the dispatcher's signal and
`redirect: 'error'`, and throw `ChannelDeliveryError` for every other failure outcome (connection failure,
429, 5xx, timeout, redirect, other 4xx) with the status and the classification from `classify()`; `send-test`
calls `send(sample, AbortSignal.timeout(10_000))` and returns the sanitized error text on failure.

Copy the file-by-file layout from `FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD`'s merged implementation
rather than the plan text alone, since that task is the concrete reference by the time this one starts.

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "First channels" table)
  and plan (`docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-9 section) in full before
  making any code changes, and review the merged `FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD` PR as the
  concrete reference layout.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
