# Task: WhatsApp adapter for buddy conversations

ID: FEATURE-BUDDY-CHANNEL-WHATSAPP
Type: feature
Scope: backend, admin
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to interact with the buddy from the most widely used messaging platform,
As a home operator,
I want to chat with the buddy via WhatsApp — asking about home status, receiving alerts, and issuing commands from anywhere.

## 2. Context

- Depends on Phase 1 conversation API (`BuddyConversationService`).
- Follows the same adapter pattern as the Telegram plugin (`plugins/buddy-telegram/`).
- WhatsApp Business API (via Meta Cloud API) provides a REST-based webhook model.
- Unlike Telegram (long polling), WhatsApp uses **webhooks** — the backend must expose a webhook endpoint for incoming messages.
- WhatsApp conversations are **single-channel** — one phone number maps to one conversation thread (no rooms/channels concept).
- The WhatsApp Business API requires a Meta Business account and a verified phone number.

### Key references

| System | What it provides | Key files |
|--------|-----------------|-----------|
| **Telegram plugin** | Reference adapter implementation (bot provider, config model, dto, plugin registration) | `plugins/buddy-telegram/` |
| **Buddy conversation service** | Conversation CRUD + message send (reused by all channel adapters) | `modules/buddy/services/buddy-conversation.service.ts` |
| **Suggestion engine** | Suggestion creation events to forward as notifications | `modules/buddy/services/suggestion-engine.service.ts` |
| **Config module** | Plugin config registration pattern | `modules/config/` |
| **Extensions service** | Plugin metadata registration | `modules/extensions/services/extensions.service.ts` |

## 3. Scope

**In scope**

- `BuddyWhatsappPlugin` (NestJS plugin module under `plugins/buddy-whatsapp/`):
  - Plugin registration with `ExtensionsService` and `PluginsTypeMapperService`
  - Swagger model registration
- `WhatsAppBotProvider` service:
  - Webhook endpoint for incoming WhatsApp messages (verification + message handling)
  - Map incoming WhatsApp messages to buddy conversations via `BuddyConversationService`
  - Send buddy responses back via WhatsApp Cloud API
  - Forward suggestion notifications to the registered WhatsApp number with interactive buttons
  - Interactive button callbacks map to suggestion feedback (accept/dismiss)
  - Phone number whitelist for security
- Configuration:
  - Phone Number ID (WhatsApp Business)
  - Access Token (Meta Cloud API)
  - Webhook Verify Token (for webhook registration)
  - Allowed phone numbers (whitelist, comma-separated)
  - Enable/disable toggle
- Admin settings: WhatsApp config form in plugin settings (token fields, phone number ID, enable/disable)
- Retry with exponential backoff for WhatsApp API calls

**Out of scope**

- WhatsApp voice messages / media messages (text only)
- WhatsApp group chats
- WhatsApp Business on-premises API (cloud API only)
- Template messages (marketing, utility) — only session messages
- Payment / order messages
- Multi-device support (single phone number per installation)

## 4. Acceptance criteria

- [x] `BuddyWhatsappPlugin` registered in `app.module.ts` router under `PLUGINS_PREFIX` with path `buddy-whatsapp`
- [x] Plugin registers with `ExtensionsService.registerPluginMetadata()` and `PluginsTypeMapperService.registerMapping()`
- [x] Swagger models registered via `buddy-whatsapp.openapi.ts`
- [x] `WhatsAppBotProvider` exposes a webhook controller:
  - `GET /v1/plugins/buddy-whatsapp/webhook` — webhook verification (hub.mode, hub.verify_token, hub.challenge)
  - `POST /v1/plugins/buddy-whatsapp/webhook` — incoming message handler
- [x] Incoming WhatsApp text messages create/continue buddy conversations
- [x] Buddy responses are sent back to the WhatsApp user via Cloud API
- [x] Suggestion notifications are forwarded to registered WhatsApp numbers with interactive buttons
- [x] Interactive button replies map to suggestion feedback (accept/dismiss)
- [x] Phone number whitelist: only configured numbers can interact
- [x] Access token and webhook verify token configurable in admin plugin settings
- [x] Token fields are masked in API responses (display `***`)
- [x] Handles WhatsApp API errors gracefully (retry with exponential backoff)
- [x] Re-reads config on `ConfigModule.CONFIG_UPDATED` events (no restart needed)
- [x] Works independently — plugin can be enabled/disabled without affecting other buddy features
- [x] Unit tests with mocked WhatsApp API

## 5. Example scenarios

### Scenario: Remote home check

Given the operator is away from home
When they send "Are any lights on?" via WhatsApp to the configured number
Then the buddy responds with the current lighting state across all spaces

### Scenario: Alert forwarding

Given the buddy detects a heating + open window conflict
When the suggestion is created
Then the registered WhatsApp number receives a message: "Living room window is open but heating is active." with interactive buttons [Lower setpoint] [Dismiss]

### Scenario: Interactive button feedback

Given the operator receives a suggestion notification on WhatsApp
When they tap the "Lower setpoint" button
Then the suggestion feedback is recorded as accepted
And the buddy confirms: "Done — lowered the living room setpoint."

### Scenario: Unauthorized number

Given a phone number not in the whitelist sends a message
When the webhook receives the message
Then the message is ignored (no response sent, logged as debug)

## 6. Technical constraints

- Use **WhatsApp Cloud API** (Meta Graph API v21.0+) — no third-party wrapper libraries needed; use plain HTTP via `fetch` or `axios` (already available in the project)
- Webhook endpoint must be publicly accessible (user is responsible for exposing via reverse proxy / tunnel)
- Webhook verification: respond to GET with `hub.challenge` when `hub.verify_token` matches
- Access token stored securely in config (masked in API responses)
- Rate limits: WhatsApp Business API allows ~80 messages/second (per phone number) — unlikely to hit but respect backoff headers
- Message types: use `text` type for responses, `interactive` type with `button` reply for suggestion notifications (max 3 buttons)
- WhatsApp requires responding within 24h window for session messages (buddy responses are immediate, so this is not an issue)
- Conversation mapping: 1 WhatsApp phone number → 1 active buddy conversation

## 7. Implementation hints

### Plugin structure

```
apps/backend/src/plugins/buddy-whatsapp/
├── buddy-whatsapp.constants.ts           # Plugin name, prefix, retry delays
├── buddy-whatsapp.openapi.ts             # Swagger extra models
├── buddy-whatsapp.plugin.ts              # @Module + OnModuleInit (follows buddy-telegram pattern)
├── controllers/
│   └── whatsapp-webhook.controller.ts    # GET (verify) + POST (incoming messages)
├── dto/
│   └── update-config.dto.ts              # UpdateBuddyWhatsappConfigDto
├── models/
│   └── config.model.ts                   # BuddyWhatsappConfigModel
└── platforms/
    ├── whatsapp-bot.provider.ts          # WhatsApp Cloud API integration
    └── whatsapp-bot.provider.spec.ts     # Unit tests
```

### Key differences from Telegram adapter

| Aspect | Telegram | WhatsApp |
|--------|----------|----------|
| Transport | Long polling (outbound only) | Webhooks (inbound HTTP) |
| Message routing | Telegraf bot framework | Raw webhook JSON parsing |
| Auth | Bot token | Access token + webhook verify token |
| User ID | Telegram user ID (number) | Phone number (string, E.164 format) |
| Interactive UI | Inline keyboards | Interactive buttons (max 3) |
| Library | `telegraf` | No library — plain HTTP calls to Graph API |

### WhatsApp Cloud API endpoints

- **Send message**: `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages`
- **Webhook payload**: Messages arrive as `entry[].changes[].value.messages[]`
- **Interactive buttons**: Use `type: "interactive"` with `action.buttons[]` (max 3)

### Webhook controller

```typescript
@Controller()
export class WhatsAppWebhookController {
  @Get('webhook')
  verify(@Query('hub.mode') mode, @Query('hub.verify_token') token, @Query('hub.challenge') challenge) {
    // Return challenge if mode === 'subscribe' && token matches configured verify token
  }

  @Post('webhook')
  async handleIncoming(@Body() body: unknown) {
    // Parse webhook payload, extract messages, route to provider
  }
}
```

### Admin config form

Follow the `telegram-config-form.vue` pattern with fields:
- **Phone Number ID** (text input)
- **Access Token** (password input, masked)
- **Webhook Verify Token** (password input, masked)
- **Allowed Phone Numbers** (text input, comma-separated E.164 numbers)
- **Enable/Disable** toggle

### Admin plugin structure

```
apps/admin/src/plugins/buddy-whatsapp/
├── buddy-whatsapp.constants.ts
├── buddy-whatsapp.plugin.ts
├── components/
│   ├── components.ts
│   ├── whatsapp-config-form.types.ts
│   └── whatsapp-config-form.vue
├── index.ts
├── locales/
│   └── en-US.json
├── schemas/
│   ├── config.schemas.ts
│   ├── config.types.ts
│   └── schemas.ts
└── store/
    └── config.store.schemas.ts
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Use the Telegram plugin as the primary reference (`plugins/buddy-telegram/`).
- Keep changes scoped to backend and admin.
- The webhook controller is the main difference from Telegram — it requires a dedicated controller (not just a provider).
- Do NOT add new npm dependencies for WhatsApp — use plain HTTP calls via the built-in `fetch` or existing HTTP client.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Follow API conventions from `/.ai-rules/API_CONVENTIONS.md`.
