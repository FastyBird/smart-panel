# Task: Telegram bot adapter

ID: FEATURE-BUDDY-CHANNEL-TELEGRAM
Type: feature
Scope: backend
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to interact with the buddy when I'm away from home,
As a home operator,
I want to chat with the buddy via Telegram — asking about home status, receiving alerts, and issuing commands.

## 2. Context

- Depends on Phase 1 conversation API and (optionally) Phase 3 voice intent routing.
- Telegram Bot API is well-documented and supports text, photos, and inline keyboards.
- The buddy conversation service already handles chat logic — this task adds a Telegram transport layer.
- Messages from Telegram are routed through `BuddyConversationService` like panel messages.

## 3. Scope

**In scope**

- `TelegramAdapterService`:
  - Telegram Bot API integration (long polling or webhook)
  - Map Telegram messages to buddy conversations
  - Map buddy responses back to Telegram messages
  - Inline keyboard for suggestion accept/dismiss
  - Proactive notifications (suggestions, alerts) sent to registered Telegram users
- Configuration: bot token, allowed user IDs (whitelist)
- Admin settings: Telegram bot token field, enable/disable
- Per-user conversation mapping (Telegram user ID → buddy conversation)

**Out of scope**

- Telegram voice messages (text only for now)
- Group chat support
- Rich media (images, charts) in responses
- Telegram bot commands (`/start`, `/help` etc.) beyond basics

## 4. Acceptance criteria

- [x] `TelegramAdapterService` connects to Telegram Bot API using configured bot token
- [x] Incoming Telegram messages create/continue buddy conversations
- [x] Buddy responses are sent back to the Telegram user
- [x] Suggestion notifications are forwarded to registered Telegram users with inline keyboards
- [x] Inline keyboard buttons map to suggestion feedback (accept/dismiss)
- [x] User whitelist: only configured Telegram user IDs can interact
- [x] Bot token configurable in admin buddy settings
- [x] Handles Telegram API errors gracefully (retry with backoff)
- [x] Unit tests with mocked Telegram API

## 5. Example scenarios

### Scenario: Remote home check

Given the operator is away from home
When they send "Are any lights on?" to the Telegram bot
Then the buddy responds with the current lighting state across all spaces

### Scenario: Alert forwarding

Given the buddy detects a heating + open window conflict
When the suggestion is created
Then the registered Telegram user receives: "Living room window is open but heating is active. [Lower setpoint] [Dismiss]"

## 6. Technical constraints

- Use `node-telegram-bot-api` or `telegraf` npm package
- Long polling preferred over webhooks (simpler setup, works behind NAT)
- Bot token stored encrypted in config (treat as sensitive)
- Rate limit Telegram API calls (30 messages/second global)
- Conversation mapping: 1 Telegram user → 1 active buddy conversation

## 7. Implementation hints

- **Telegraf**: `npm install telegraf` — lightweight, well-maintained Telegram bot framework
- **Message routing**: `bot.on('text', (ctx) => buddyConversationService.sendMessage(conversationId, ctx.message.text))`
- **Inline keyboards**: Use `Markup.inlineKeyboard()` for suggestion actions
- **Notification forwarding**: Subscribe to `BuddyModule.Suggestion.Created` events and forward to registered chats

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to backend only.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
