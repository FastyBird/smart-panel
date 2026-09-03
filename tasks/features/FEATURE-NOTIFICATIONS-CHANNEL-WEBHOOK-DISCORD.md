# Task: Webhook and Discord notification channels

ID: FEATURE-NOTIFICATIONS-CHANNEL-WEBHOOK-DISCORD
Type: feature
Scope: backend, admin
Size: medium
Parent: EPIC-NOTIFICATIONS-MODULE
Status: planned

## 1. Business goal

In order to forward notifications to a generic HTTP endpoint or a Discord channel,
As a Smart Panel administrator,
I want to enable and configure a webhook channel plugin and a Discord channel plugin, each with a redacted
secret, a minimum severity, and a "send test notification" action.

## 2. Context

- This is task N-8; see `tasks/epics/EPIC-NOTIFICATIONS-MODULE.md`.
- Depends on `FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH` (N-3) for `BaseNotificationChannel` and
  `NotificationChannelRegistryService`.
- Spec: `docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "First channels" table (webhook,
  Discord rows) and "Security and privacy" section.
- Plan: `docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-8 section.
- Secret handling pattern: plugin config models carry the secret under `secretFields` (`webhook_url`),
  giving the existing redaction, `_configured` sibling and `ConfigSecretInput` component; regression coverage
  lives in `apps/admin/src/plugins/config-secrets.spec.ts` and
  `apps/backend/src/plugins/plugin-secret-removal.spec.ts` - both tables gain one row per new secret.
- Extension action pattern: `send-test` is a normal extension action in category `diagnostics`, rendered by
  the existing Actions tab (`apps/admin/src/modules/extensions/components/extension-actions.vue`, from
  `FEATURE-EXTENSION-ACTIONS-MVP`) - no bespoke channel UI is needed beyond the config form.
- This task establishes the reference plugin layout on both sides that
  `FEATURE-NOTIFICATIONS-CHANNEL-SLACK-TELEGRAM` copies for Slack and Telegram.

- GitHub issue: https://github.com/FastyBird/smart-panel/issues/893 (part of epic https://github.com/FastyBird/smart-panel/issues/885)

## 3. Scope

**In scope** (backend, per plugin `notifications-webhook` and `notifications-discord`)

- `<plugin>.plugin.ts`, `<plugin>.constants.ts`, `<plugin>.openapi.ts`, `models/config.model.ts`,
  `dto/update-config.dto.ts`.
- `platforms/<name>-channel.platform.ts` extending `BaseNotificationChannel`, with its spec.
- `services/<name>-actions.service.ts` registering `send-test`, with its spec.
- Registration in `apps/backend/src/app.module.ts` and a new row in
  `apps/backend/src/plugins/plugin-secret-removal.spec.ts` per secret.

**In scope** (admin, per plugin)

- `<plugin>.plugin.ts`, `<plugin>.constants.ts`, `index.ts`.
- `components/<name>-config-form.vue`, `components/components.ts`.
- `schemas/config.schemas.ts`, `schemas/schemas.ts`, `store/config.store.schemas.ts`.
- Six locale files and `locales/index.ts`.
- Registration in `apps/admin/src/app.main.ts`, aliases in `apps/admin/src/openapi.constants.ts`, and a new
  row in `apps/admin/src/plugins/config-secrets.spec.ts` per secret.

**Out of scope**

- Slack and Telegram (`FEATURE-NOTIFICATIONS-CHANNEL-SLACK-TELEGRAM`).
- Core registry/dispatcher (already merged by then).
- Any change to the notifications core entity or API.

## 4. Acceptance criteria

- [ ] `notifications-webhook` config model exposes `url` (write-only secret), `url_configured` (boolean),
      `min_severity` (default `warning`), and optional `headers` (write-only secret, JSON object of extra
      headers) with its own `headers_configured` sibling, with `secretFields: [{ path: 'url', configuredPath:
      'url_configured', inputPaths: ['url'] }, { path: 'headers', configuredPath: 'headers_configured',
      inputPaths: ['headers'] }]`; the DTO accepts an `http:` URL for trusted-network targets, and the config
      form shows a warning under the URL field for that case.
- [ ] `headers` is only accepted together with an `https:` URL: an `http:` URL combined with any header is
      rejected at DTO validation.
- [ ] `notifications-discord` config model exposes `webhook_url` (write-only secret),
      `webhook_url_configured`, `min_severity`, and optional `username`; the DTO rejects a `webhook_url` that
      does not start with `https://`.
- [ ] The webhook channel's `send()` issues `POST` with JSON body `{ id, source, kind, severity, title,
      message, occurrences, created_at, actions }` plus any configured extra headers, using
      `fetchWithSignal` with the dispatcher's signal and `redirect: 'error'`; every failure outcome
      (connection failure, HTTP 429, HTTP 5xx, timeout, redirect, any other 4xx) throws a
      `ChannelDeliveryError` with `status` and the classification from `classify()`.
- [ ] The Discord channel's `send()` issues a webhook embed payload `{ username?, embeds: [{ title,
      description: message, color, footer: { text: '<source> - <n> occurrences' }, timestamp }] }` with
      colours `info 0x3498db`, `warning 0xf39c12`, `error 0xe74c3c`, `critical 0x8e44ad`, using
      `fetchWithSignal` with the dispatcher's signal and `redirect: 'error'`; every failure outcome
      (connection failure, HTTP 429, HTTP 5xx, timeout, redirect, any other 4xx) throws a
      `ChannelDeliveryError` with `status` and the classification from `classify()`.
- [ ] Both channels' `hasRequiredConfig` returns `false` when the secret is absent, so `isConfigured()`
      resolves `false` and the dispatcher skips them.
- [ ] Each plugin registers exactly one extension action `send-test` (`id: 'send-test'`, `label: 'Send test
      notification'`, `category: DIAGNOSTICS`, `mode: 'immediate'`) that builds a fake notification
      (`severity: INFO`, title `Test notification from Smart Panel`) and calls the channel's own
      `send(sample, AbortSignal.timeout(10_000))`, returning `{ success, message }`; the action reports the
      sanitized error text when `send` throws.
- [ ] `ConfigSecretsService.toPublic` strips each secret from the public config and adds its `_configured`
      sibling.
- [ ] `apps/admin/src/plugins/config-secrets.spec.ts` and `apps/backend/src/plugins/plugin-secret-removal.spec.ts`
      gain one row per secret (`url` and `headers` for webhook, `webhook_url` for Discord) and stay green.
- [ ] Channel spec (mocked `fetch`) asserts the request URL, method, headers and body shape for both
      channels, that the dispatcher's `AbortSignal` is passed through to the `fetch` call via
      `fetchWithSignal`, not a channel-owned timeout signal, and that the call uses `redirect: 'error'`.
- [ ] Channel spec: a redirect outcome and an HTTP 400 both become a non-retryable `ChannelDeliveryError`, and
      an HTTP 503 becomes a retryable one.
- [ ] A Discord config DTO test proves a `webhook_url` that does not start with `https://` is rejected, while
      the same `http:` URL is accepted by the webhook config DTO.
- [ ] `cd apps/backend && npx jest src/plugins/notifications-webhook src/plugins/notifications-discord src/plugins/plugin-secret-removal.spec.ts`
      passes.
- [ ] `pnpm run generate:openapi`, then
      `cd apps/admin && npx vitest run src/plugins/notifications-webhook src/plugins/notifications-discord src/plugins/config-secrets.spec.ts`
      passes.
- [ ] Backend `lint:js`, `lint:api`, `lint:openapi` and admin `type-check`, `lint:js` all pass.
- [ ] Manual: configuring a real Discord webhook and running "Send test notification" from the Actions tab
      posts a visible embed.

## 6. Technical constraints

- Depends on: N-3 / FEATURE-NOTIFICATIONS-CHANNEL-DISPATCH.
- No new runtime dependencies: both channels use the global `fetch` with `AbortSignal.timeout`.
- Channel secrets go through `secretFields`, are write-only in Swagger, and are never logged; log the
  channel type and HTTP status, never the URL.
- Tabs, single quotes, semicolons, trailing commas; print width 120 (backend) / 150 (admin); import ordering
  as elsewhere.
- `lint:api` requires data models' `@ApiSchema` names to contain `Data` unless the name contains `Res`/`Req`
  or the file is under `/dto/`.
- PR titles `<type>(<scope>): <subject>`, lowercase subject, <= 100 characters; never push to `main`.
- PR title: `feat(cross): add webhook and Discord notification channels`
- Suggested worker tier: implementer sonnet / high, reviewer sonnet / medium.

## 7. Implementation hints

Copy verbatim from the plan's Task N-8 "Interfaces" block:

```ts
// backend webhook config model (NotificationsWebhookPluginDataConfig) - wire names
url: string (writeOnly), url_configured: boolean, min_severity: NotificationSeverity (default 'warning'), headers: Record<string, string> | null (writeOnly), headers_configured: boolean
// secretFields: [{ path: 'url', configuredPath: 'url_configured', inputPaths: ['url'] }, { path: 'headers', configuredPath: 'headers_configured', inputPaths: ['headers'] }]
// validation: headers are only allowed together with an https: url (an http: url with any header is rejected)
// discord config model (NotificationsDiscordPluginDataConfig)
webhook_url (writeOnly), webhook_url_configured, min_severity, username: string | null
```

Webhook `send`: `POST` JSON `{ id, source, kind, severity, title, message, occurrences, created_at, actions }`
plus configured headers. The webhook accepts `http:` URLs for trusted-network targets; its admin form shows a
warning under the URL field and the docs state the exception. The optional `headers` map is a declared secret
(`headers_configured` sibling, write-only, redacted by `ConfigSecretsService.toPublic` with a regression-table
row) and is only ever sent over `https:`: a configuration with an `http:` URL and any header is rejected at
validation. Discord's `webhook_url` must start with `https://`; the config DTO rejects anything else. Discord
`send`: `{ username?, embeds: [{ title, description: message, color, footer: { text: 'source - n occurrences'
}, timestamp }] }` with colours `info 0x3498db`, `warning 0xf39c12`, `error 0xe74c3c`, `critical 0x8e44ad`.
Both channels call `fetchWithSignal(url, init, signal)` with the `AbortSignal` the dispatcher passes into
`send` and `redirect: 'error'`; there is no channel-owned timeout, and every failure outcome (connection
failure, 429, 5xx, timeout, redirect, other 4xx) throws a `ChannelDeliveryError` with the status and the
classification from `classify()`.

`send-test` action: `{ id: 'send-test', label: 'Send test notification', category: DIAGNOSTICS, mode:
'immediate', execute }` builds a fake `NotificationEntity` (`severity: INFO`, title `Test notification from
Smart Panel`) and calls the channel's `send(sample, AbortSignal.timeout(10_000))`, returning `{ success,
message }` with the sanitized error text on failure.

## 8. AI instructions

- Read the spec (`docs/superpowers/specs/2026-09-02-notifications-module-design.md`, "First channels" table
  and "Security and privacy" section) and plan
  (`docs/superpowers/plans/2026-09-02-notifications-module.md`, Task N-8 section) in full before making any
  code changes.
- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
