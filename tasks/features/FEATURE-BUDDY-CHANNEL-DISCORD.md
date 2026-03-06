# Task: Discord bot adapter for buddy conversations

ID: FEATURE-BUDDY-CHANNEL-DISCORD
Type: feature
Scope: backend, admin
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: todo

## 1. Business goal

In order to interact with the buddy from a platform my household already uses,
As a home operator,
I want to chat with the buddy via Discord — with smart home spaces mapped to Discord channels so each room has its own conversation thread and notifications land in the right place.

## 2. Context

- Depends on Phase 1 conversation API (`BuddyConversationService`).
- Follows the same adapter pattern as the Telegram plugin (`plugins/buddy-telegram/`).
- Discord supports **channels within a guild (server)** — this naturally maps to smart home **spaces/rooms**.
- Unlike Telegram and WhatsApp (single-channel), Discord enables **multi-channel** interaction:
  - Each space/room can have a dedicated Discord channel
  - A general channel handles cross-space queries
  - Suggestion notifications are routed to the relevant space channel
- Discord.js is the standard Node.js library for Discord bots.
- Discord uses a WebSocket gateway for real-time message delivery (similar to Telegram's long polling — no webhook setup needed).

### Key references

| System | What it provides | Key files |
|--------|-----------------|-----------|
| **Telegram plugin** | Reference adapter implementation | `plugins/buddy-telegram/` |
| **Buddy conversation service** | Conversation CRUD + message send | `modules/buddy/services/buddy-conversation.service.ts` |
| **Suggestion engine** | Suggestion creation events with space context | `modules/buddy/services/suggestion-engine.service.ts` |
| **Spaces module** | Space list for channel mapping | `modules/spaces/` |
| **Config module** | Plugin config registration pattern | `modules/config/` |

## 3. Scope

**In scope**

- `BuddyDiscordPlugin` (NestJS plugin module under `plugins/buddy-discord/`):
  - Plugin registration with `ExtensionsService` and `PluginsTypeMapperService`
  - Swagger model registration
- `DiscordBotProvider` service:
  - Connect to Discord via bot token using Discord.js gateway
  - Listen for messages in configured channels
  - Map Discord messages to buddy conversations via `BuddyConversationService`
  - Send buddy responses back to the Discord channel
  - **Space-channel mapping**: associate Discord channels with smart home spaces
  - When a message arrives in a space-mapped channel, include that space context in the buddy conversation
  - Forward suggestion notifications to the relevant space channel (or general channel if no mapping)
  - Discord button components for suggestion accept/dismiss
  - Role-based access: only users with a configured Discord role can interact
- Configuration:
  - Bot Token (Discord Developer Portal)
  - Guild ID (server ID)
  - General Channel ID (for cross-space queries)
  - Space-Channel Mappings (JSON: `{ "space_id": "channel_id" }`)
  - Allowed Role ID (Discord role required to interact; empty = allow all server members)
  - Enable/disable toggle
- Admin settings: Discord config form in plugin settings
- Auto-create channels (optional): if enabled, auto-create Discord channels for spaces that don't have a mapping

**Out of scope**

- Discord voice channels (text only)
- Discord slash commands (plain text messages for now)
- Discord threads (messages go to channels directly)
- Multiple guild (server) support
- Discord OAuth2 for user linking
- Rich embeds beyond simple text + buttons

## 4. Acceptance criteria

- [ ] `BuddyDiscordPlugin` registered in `app.module.ts` router under `PLUGINS_PREFIX` with path `buddy-discord`
- [ ] Plugin registers with `ExtensionsService.registerPluginMetadata()` and `PluginsTypeMapperService.registerMapping()`
- [ ] Swagger models registered via `buddy-discord.openapi.ts`
- [ ] `DiscordBotProvider` connects to Discord gateway using configured bot token
- [ ] Incoming Discord messages in configured channels create/continue buddy conversations
- [ ] Messages in space-mapped channels automatically include that space as context
- [ ] Messages in the general channel handle cross-space queries
- [ ] Buddy responses are sent back to the originating Discord channel
- [ ] Suggestion notifications are routed to the correct space channel (or general channel as fallback)
- [ ] Discord button components allow suggestion accept/dismiss
- [ ] Role-based access: only users with the configured role can interact (if role is set)
- [ ] Bot ignores its own messages and messages from other bots
- [ ] Space-channel mapping is configurable in admin settings
- [ ] Bot token configurable in admin plugin settings (masked in API responses)
- [ ] Re-reads config on `ConfigModule.CONFIG_UPDATED` events (reconnects if token changes)
- [ ] Handles Discord API errors and disconnections gracefully (auto-reconnect is built into Discord.js)
- [ ] Works independently — plugin can be enabled/disabled without affecting other buddy features
- [ ] Unit tests with mocked Discord.js client

## 5. Example scenarios

### Scenario: Space-specific query

Given the operator has mapped the "Living Room" space to Discord channel `#living-room`
When they type "What's the temperature?" in `#living-room`
Then the buddy responds with the living room temperature specifically (not all spaces)

### Scenario: Cross-space query in general channel

Given the operator types "Turn off all lights" in the `#smart-home` general channel
When the buddy processes the message
Then it responds with a summary of all lights turned off across all spaces

### Scenario: Suggestion routed to space channel

Given the buddy detects that the bedroom window is open while heating is on
When the suggestion is created with space context "Bedroom"
And a Discord channel is mapped to the "Bedroom" space
Then the suggestion notification appears in the `#bedroom` channel with [Lower setpoint] [Dismiss] buttons

### Scenario: Suggestion in general channel (no mapping)

Given a suggestion is created for a space that has no Discord channel mapping
When the notification is sent
Then it appears in the configured general channel

### Scenario: Unauthorized user

Given a Discord user without the required role sends a message
When the bot receives the message
Then the message is ignored (optionally: bot reacts with a lock emoji)

## 6. Technical constraints

- Use `discord.js` v14+ npm package (well-maintained, supports gateway intents, message components)
- Requires Gateway Intents: `Guilds`, `GuildMessages`, `MessageContent`
- Bot token stored securely in config (masked in API responses)
- Discord rate limits: 50 requests/second per bot — respect `429` responses with retry-after header
- Message components (buttons): use `ActionRowBuilder` + `ButtonBuilder` for suggestion actions
- Conversation mapping: 1 Discord channel → 1 active buddy conversation (keyed by channel ID)
- Space context injection: when a message arrives in a space-mapped channel, prepend space context to the buddy conversation
- Discord.js handles reconnection automatically — no manual reconnect logic needed
- Max message length: 2000 characters — split longer responses

## 7. Implementation hints

### Plugin structure

```
apps/backend/src/plugins/buddy-discord/
├── buddy-discord.constants.ts            # Plugin name, prefix, intents config
├── buddy-discord.openapi.ts              # Swagger extra models
├── buddy-discord.plugin.ts               # @Module + OnModuleInit
├── dto/
│   └── update-config.dto.ts              # UpdateBuddyDiscordConfigDto
├── models/
│   └── config.model.ts                   # BuddyDiscordConfigModel
└── platforms/
    ├── discord-bot.provider.ts           # Discord.js gateway integration
    └── discord-bot.provider.spec.ts      # Unit tests
```

### Key differences from Telegram adapter

| Aspect | Telegram | Discord |
|--------|----------|---------|
| Transport | Long polling | WebSocket gateway (Discord.js) |
| Channels | Single chat per user | Multiple channels per guild |
| Space mapping | N/A | Channel ID → Space ID |
| Auth | Bot token + user ID whitelist | Bot token + role-based access |
| Interactive UI | Inline keyboards | Message components (buttons) |
| Library | `telegraf` | `discord.js` |
| Suggestions | Sent to all registered users | Routed to space-specific channel |

### Discord.js setup

```typescript
import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  // Route to buddy conversation service...
});
```

### Space-channel mapping config

The `spaceChannelMappings` config field stores a JSON string of `{ spaceId: channelId }` pairs:

```typescript
// Config model field
@ApiPropertyOptional({
  description: 'JSON mapping of space IDs to Discord channel IDs',
  name: 'space_channel_mappings',
  type: 'string',
  nullable: true,
})
spaceChannelMappings: string | null = null;  // e.g. '{"space-uuid-1":"123456789","space-uuid-2":"987654321"}'
```

### Suggestion routing

```typescript
@OnEvent(EventType.SUGGESTION_CREATED)
async onSuggestionCreated(suggestion: BuddySuggestion): Promise<void> {
  // Find the channel mapped to the suggestion's space
  const channelId = this.getChannelForSpace(suggestion.spaceId) ?? this.generalChannelId;
  // Send with action buttons
}
```

### Admin config form

Follow the `telegram-config-form.vue` pattern with fields:
- **Bot Token** (password input, masked)
- **Guild ID** (text input)
- **General Channel ID** (text input — the default channel for cross-space queries)
- **Space-Channel Mappings** (JSON editor or key-value pairs UI mapping spaces to channel IDs)
- **Allowed Role ID** (text input, optional — Discord role ID required to interact)
- **Enable/Disable** toggle

### Admin plugin structure

```
apps/admin/src/plugins/buddy-discord/
├── buddy-discord.constants.ts
├── buddy-discord.plugin.ts
├── components/
│   ├── components.ts
│   ├── discord-config-form.types.ts
│   └── discord-config-form.vue
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
- The main differentiator is **multi-channel support** — space-channel mapping is the core feature that sets Discord apart from Telegram/WhatsApp.
- `discord.js` is the only new npm dependency needed — add it as an optional peer dependency.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Follow API conventions from `/.ai-rules/API_CONVENTIONS.md`.
