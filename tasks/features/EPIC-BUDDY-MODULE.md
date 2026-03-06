# Epic: Buddy module — AI assistant for Smart Panel

ID: EPIC-BUDDY-MODULE
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to make the smart panel more intelligent and proactive,
As a home operator using the wall panel,
I want an AI "buddy" that observes my actions, learns my patterns, and suggests automations or optimisations — starting with text interaction and evolving toward voice and multi-channel messaging.

Inspired by the [OpenClaw](https://github.com/openclaw/openclaw) project's proactive agent model, but purpose-built for the smart panel's device / space / scene domain.

## 2. Context

### Existing infrastructure to build on

| System | What it provides | Key files |
|--------|-----------------|-----------|
| **Intents module** | Tracks every operator action (30+ intent types) with full context: origin, space, device, targets, timestamps. This is the "action recognition" backbone. | `modules/intents/intents.service.ts`, `intents.constants.ts` |
| **Space suggestion service** | Time-based lighting suggestions with cooldown, feedback tracking, and intent execution. This is the pattern the buddy generalises. | `modules/spaces/services/space-suggestion.service.ts` |
| **Scenes module** | Scene executor with platform registry — buddy can suggest scene creation from detected patterns and trigger existing scenes. | `modules/scenes/` |
| **WebSocket gateway** | Real-time bidirectional Socket.IO with room-based routing. All `EventEmitter2` events forwarded to subscribed clients. | `modules/websocket/` |
| **Config module** | Per-module configuration with `ModulesTypeMapperService` registration pattern. | `modules/config/` |
| **Extensions service** | Module metadata registration for the extensions UI. | `modules/extensions/services/extensions.service.ts` |
| **Security listener** | Reference for `@OnEvent` listener pattern with debounce. | `modules/security/listeners/security-state.listener.ts` |

### Architecture decisions

- **Buddy is a module** (not a plugin). Modules are core building blocks; plugins are add-ons to modules.
- **Buddy module does not replace** the existing `SpaceSuggestionService` — it is a higher-level system that can incorporate those suggestions along with many other types.
- **LLM provider is swappable** — Claude, OpenAI, Ollama, or none (rule-based only).
- **Offline-first** — rule-based suggestions work without any AI provider configured; chat requires a provider.

## 3. Scope

### In scope (phased)

**Phase 1 — Observer + Text Chat (MVP)** `FEATURE-BUDDY-*`

| Sub-task | Scope | Size |
|----------|-------|------|
| FEATURE-BUDDY-BACKEND-FOUNDATION | backend | medium |
| FEATURE-BUDDY-BACKEND-CONVERSATION | backend | medium |
| FEATURE-BUDDY-BACKEND-SUGGESTIONS | backend | medium |
| FEATURE-BUDDY-PANEL-MODULE | panel | medium |
| FEATURE-BUDDY-ADMIN-MODULE | admin | small |
| FEATURE-BUDDY-BACKEND-TESTS | backend | small |

**Phase 2 — Proactive Intelligence** `FEATURE-BUDDY-PROACTIVE-*`

| Sub-task | Scope | Size |
|----------|-------|------|
| FEATURE-BUDDY-PROACTIVE-HEARTBEAT | backend | medium |
| FEATURE-BUDDY-PROACTIVE-ANOMALY | backend | medium |
| FEATURE-BUDDY-PROACTIVE-ENERGY | backend | small |
| FEATURE-BUDDY-PROACTIVE-CONFLICTS | backend | small |
| FEATURE-BUDDY-PROACTIVE-SCENE-SUGGEST | backend | medium |
| FEATURE-BUDDY-PROACTIVE-PANEL | panel | small |

**Phase 3 — Voice Interaction** `FEATURE-BUDDY-VOICE-*`

| Sub-task | Scope | Size |
|----------|-------|------|
| FEATURE-BUDDY-VOICE-STT | backend, panel | medium |
| FEATURE-BUDDY-VOICE-TTS | backend, panel | medium |
| FEATURE-BUDDY-VOICE-WAKE-WORD | panel | medium |
| FEATURE-BUDDY-VOICE-INTENT-ROUTING | backend | small |

**Phase 4 — Multi-Channel** `FEATURE-BUDDY-CHANNEL-*`

| Sub-task | Scope | Size |
|----------|-------|------|
| FEATURE-BUDDY-CHANNEL-TELEGRAM | backend | medium |
| FEATURE-BUDDY-CHANNEL-ADMIN-CHAT | admin | small |
| FEATURE-BUDDY-CHANNEL-PERSONALITY | backend | small |

### Out of scope

- Training custom ML models
- Image/camera-based recognition
- Third-party skill marketplace (OpenClaw ClawHub equivalent)
- Multi-tenant / multi-user buddy personalities
- Replacing existing `SpaceSuggestionService`

## 4. Acceptance criteria

### Phase 1 (MVP)

- [x] Backend `BuddyModule` registered in `app.module.ts` with route prefix `buddy` under `MODULES_PREFIX`
- [x] Module constants follow naming: `BUDDY_MODULE_PREFIX`, `BUDDY_MODULE_NAME = 'buddy-module'`, `BUDDY_MODULE_API_TAG_NAME = 'Buddy module'`
- [x] Module registers with `ExtensionsService.registerModuleMetadata()` and `ModulesTypeMapperService.registerMapping()`
- [x] Swagger models registered via `buddy.openapi.ts` pattern
- [x] `ActionObserverListener` subscribes to `IntentEventType.COMPLETED` events and records action history in-memory (ring buffer)
- [x] `BuddyContextService` aggregates: spaces, devices (state), scenes, weather, energy, recent intents — into a structured context object
- [x] `LlmProviderService` abstracts LLM calls with swappable provider: `claude` | `openai` | `ollama` | `none`
- [x] `BuddyConversationService` handles text chat with conversation history persistence (TypeORM entities)
- [x] `SuggestionEngineService` generates context-aware suggestions with cooldown management
- [x] `PatternDetectorService` identifies repeated action sequences from the action history buffer (rule-based MVP)
- [x] REST API endpoints following API conventions (controllers return `*ResponseModel`, DTOs are input only):
  - `GET /v1/modules/buddy/conversations` — list conversations
  - `POST /v1/modules/buddy/conversations` — start new conversation
  - `GET /v1/modules/buddy/conversations/:id` — get conversation with messages
  - `POST /v1/modules/buddy/conversations/:id/messages` — send message, get buddy response
  - `DELETE /v1/modules/buddy/conversations/:id` — delete conversation
  - `GET /v1/modules/buddy/suggestions` — get active suggestions (optional `?space_id=`)
  - `POST /v1/modules/buddy/suggestions/:id/feedback` — accept/dismiss suggestion
- [x] WebSocket events emitted via `EventEmitter2`:
  - [x] `BuddyModule.Suggestion.Created` — new suggestion available
  - [x] `BuddyModule.Conversation.MessageReceived` — buddy response ready
- [x] Database entities: `BuddyConversationEntity`, `BuddyMessageEntity` with migration
- [x] Panel: buddy module with chat drawer accessible from deck UI
- [x] Panel: suggestion cards displayed as dismissible notifications
- [x] Admin: buddy settings page (enable/disable, provider selection, API key configuration)
- [x] Works without an AI provider configured (rule-based suggestions only, chat returns 503)
- [x] Unit tests for pattern detection, suggestion rules, context building
- [x] E2E tests for conversation and suggestion API endpoints

### Phase 2 (Proactive)

- [x] `HeartbeatService` runs periodic evaluation (configurable interval, default 5 min) via `@nestjs/schedule`
- [x] Anomaly detection: sensor drift (temperature deviation > threshold), unusual device activity
- [x] Energy suggestions: excess solar, high consumption alerts
- [x] Conflict detection: heating + open window, AC + open door, lights on in empty room
- [x] Scene creation suggestions: repeated action patterns → "Create a scene for this?"
- [x] Panel: proactive suggestion notifications in buddy drawer

### Phase 3 (Voice)

- [x] Speech-to-text integration (Whisper local or cloud provider)
- [x] Text-to-speech integration (system TTS, ElevenLabs, or similar)
- [x] Wake word detection on panel hardware
- [x] Voice commands routed through buddy conversation → intent system
- [x] Panel: microphone button in buddy drawer, audio playback for responses

### Phase 4 (Multi-Channel)

- [x] Telegram bot adapter for buddy conversations
- [x] Admin web chat interface embedded in admin settings
- [x] `personality.md` configuration file for buddy tone/style customisation

## 5. Example scenarios

### Scenario: Repeated action detection (Phase 1)

Given the operator turns off living room lights at ~23:00 for 5 consecutive days
When the pattern detector identifies this sequence
Then a suggestion is created: "You turn off the living room lights around 11 PM every night. Want me to create a scene for this?"
And a `BuddyModule.Suggestion.Created` event is emitted

### Scenario: Text conversation (Phase 1)

Given the operator opens the buddy chat drawer on the panel
When they type "What's the temperature in the bedroom?"
Then the buddy builds context from the devices module (bedroom temperature sensors)
And responds: "The bedroom is currently 21.5°C (humidity 45%). The thermostat is set to 22°C."

### Scenario: Chat without AI provider (Phase 1)

Given no AI provider is configured in buddy settings
When the operator tries to open the buddy chat
Then the chat is disabled with a message: "Configure an AI provider in admin settings to enable chat."
And rule-based suggestions still work normally

### Scenario: Conflict detection (Phase 2)

Given the heating is set to 25°C in the living room
And a window sensor shows the living room window is open
When the heartbeat service evaluates the state
Then it creates a suggestion: "The living room window is open but heating is at 25°C. Lower the setpoint?"

### Scenario: Energy optimisation (Phase 2)

Given solar production exceeds consumption by 2kW
When the heartbeat service evaluates the energy state
Then it suggests: "Excess solar energy available (2kW). Good time to run the dishwasher or charge your EV."

### Scenario: Voice command (Phase 3)

Given the operator says "Hey panel, turn off the kitchen lights"
When the wake word is detected and speech is transcribed
Then the text is sent through the buddy conversation service
And the buddy creates a lighting intent for the kitchen space
And responds via TTS: "Done, kitchen lights are off."

## 6. Technical constraints

- **Module, not plugin** — follows `apps/backend/src/modules/` structure, registered in `app.module.ts` `RouterModule` under `MODULES_PREFIX`
- Follow API conventions from `.ai-rules/API_CONVENTIONS.md`:
  - Controllers return `*ResponseModel` (extend `BaseSuccessResponseModel<T>`)
  - DTOs are input only, never in `@ApiOkResponse`
  - `@ApiOperation` required with tags, summary, description, operationId
  - Swagger schema names: `BuddyModule*`
- Follow panel module patterns from `apps/panel/lib/modules/` (module.dart, repositories, services, presentation)
- Follow admin module patterns from `apps/admin/src/modules/` (stores, pages, router)
- Do not modify generated code (OpenAPI spec, panel API client, etc.)
- AI provider integration must be configurable and swappable
- Must work without an AI provider configured (rule-based suggestions only)
- LLM calls must be async with proper error handling and timeouts (30s default)
- Do not introduce new dependencies unless really needed; exceptions:
  - `@anthropic-ai/sdk` or `openai` for LLM provider (optional peer dependency)
- Respect existing auth patterns (JWT tokens, display tokens)
- Tests are expected for new business logic

## 7. Implementation hints

### Backend module structure

```
apps/backend/src/modules/buddy/
├── buddy.constants.ts                      # Module name, prefix, event types, enums
├── buddy.exceptions.ts                     # Custom exceptions
├── buddy.module.ts                         # @ApiTag + @Module + OnModuleInit
├── buddy.openapi.ts                        # BUDDY_SWAGGER_EXTRA_MODELS array
├── controllers/
│   ├── buddy-conversations.controller.ts   # Conversation CRUD + message send
│   └── buddy-suggestions.controller.ts     # Suggestions list + feedback
├── dto/
│   ├── create-conversation.dto.ts
│   ├── send-message.dto.ts
│   ├── suggestion-feedback.dto.ts
│   └── update-config.dto.ts
├── entities/
│   ├── buddy-conversation.entity.ts        # Table: buddy_module_conversations
│   └── buddy-message.entity.ts             # Table: buddy_module_messages
├── models/
│   ├── config.model.ts                     # BuddyModuleConfigModel
│   ├── conversation-response.model.ts      # Response models for API
│   ├── message-response.model.ts
│   └── suggestion-response.model.ts
├── services/
│   ├── action-observer.service.ts          # Ring buffer of completed intents
│   ├── buddy-context.service.ts            # Aggregates home state for LLM
│   ├── buddy-conversation.service.ts       # Conversation + message CRUD
│   ├── llm-provider.service.ts             # Swappable LLM abstraction
│   ├── pattern-detector.service.ts         # Rule-based repeated action detection
│   └── suggestion-engine.service.ts        # Suggestion generation + cooldown
└── listeners/
    └── intent-event.listener.ts            # @OnEvent(IntentEventType.COMPLETED)
```

### Key patterns to follow

| Pattern | Reference implementation |
|---------|------------------------|
| Module registration + OnModuleInit | `modules/weather/weather.module.ts` |
| Constants (prefix, name, event types) | `modules/security/security.constants.ts` |
| Entity (TypeORM + SQLite) | `modules/security/entities/security-alert-ack.entity.ts` |
| Event listener with @OnEvent | `modules/security/listeners/security-state.listener.ts` |
| Suggestion + cooldown + feedback | `modules/spaces/services/space-suggestion.service.ts` |
| Intent event emission | `modules/intents/services/intents.service.ts` |
| Config model + DTO registration | `modules/weather/weather.module.ts` onModuleInit |
| Swagger model registration | `modules/weather/weather.openapi.ts` |
| Migration (SQLite) | `migrations/1766000000000-SecurityModuleInfluxMigration.ts` |

### LLM context building

The `BuddyContextService` should build a structured snapshot:

```typescript
interface BuddyContext {
  timestamp: string;
  spaces: { id: string; name: string; category: string; deviceCount: number }[];
  devices: { id: string; name: string; space: string; category: string; state: Record<string, unknown> }[];
  scenes: { id: string; name: string; space: string; enabled: boolean }[];
  weather: { temperature: number; conditions: string; humidity: number } | null;
  energy: { solarProduction: number; gridConsumption: number; batteryLevel: number } | null;
  recentIntents: { type: string; space: string; timestamp: string }[];
}
```

This context is serialised into the LLM system prompt so the buddy can answer questions about the home.

## 8. Child tasks

### Phase 1 — MVP

| ID | Title | Scope | Size |
|----|-------|-------|------|
| [FEATURE-BUDDY-BACKEND-FOUNDATION](./FEATURE-BUDDY-BACKEND-FOUNDATION.md) | Backend buddy module foundation (module, entities, constants, context service, action observer) | backend | medium |
| [FEATURE-BUDDY-BACKEND-CONVERSATION](./FEATURE-BUDDY-BACKEND-CONVERSATION.md) | Backend conversation API (LLM provider, chat service, conversation CRUD endpoints) | backend | medium |
| [FEATURE-BUDDY-BACKEND-SUGGESTIONS](./FEATURE-BUDDY-BACKEND-SUGGESTIONS.md) | Backend suggestion engine (pattern detector, suggestion generation, feedback API) | backend | medium |
| [FEATURE-BUDDY-PANEL-MODULE](./FEATURE-BUDDY-PANEL-MODULE.md) | Panel buddy module (chat drawer, suggestion cards, WebSocket integration) | panel | medium |
| [FEATURE-BUDDY-ADMIN-MODULE](./FEATURE-BUDDY-ADMIN-MODULE.md) | Admin buddy settings page (enable/disable, provider config, API key) | admin | small |
| [FEATURE-BUDDY-BACKEND-TESTS](./FEATURE-BUDDY-BACKEND-TESTS.md) | Backend unit + E2E tests for buddy module | backend | small |

### Phase 2 — Proactive Intelligence

| ID | Title | Scope | Size |
|----|-------|-------|------|
| [FEATURE-BUDDY-PROACTIVE-HEARTBEAT](./FEATURE-BUDDY-PROACTIVE-HEARTBEAT.md) | Heartbeat service for periodic state evaluation | backend | medium |
| [FEATURE-BUDDY-PROACTIVE-ANOMALY](./FEATURE-BUDDY-PROACTIVE-ANOMALY.md) | Anomaly detection (sensor drift, unusual patterns) | backend | medium |
| [FEATURE-BUDDY-PROACTIVE-ENERGY](./FEATURE-BUDDY-PROACTIVE-ENERGY.md) | Energy optimisation suggestions | backend | small |
| [FEATURE-BUDDY-PROACTIVE-CONFLICTS](./FEATURE-BUDDY-PROACTIVE-CONFLICTS.md) | Conflict detection rules (heating + open window, etc.) | backend | small |
| [FEATURE-BUDDY-PROACTIVE-SCENE-SUGGEST](./FEATURE-BUDDY-PROACTIVE-SCENE-SUGGEST.md) | Scene creation suggestions from repeated patterns | backend | medium |
| [FEATURE-BUDDY-PROACTIVE-PANEL](./FEATURE-BUDDY-PROACTIVE-PANEL.md) | Panel UI for proactive suggestion notifications | panel | small |

### Phase 3 — Voice Interaction

| ID | Title | Scope | Size |
|----|-------|-------|------|
| [FEATURE-BUDDY-VOICE-STT](./FEATURE-BUDDY-VOICE-STT.md) | Speech-to-text integration (Whisper / cloud STT) | backend, panel | medium |
| [FEATURE-BUDDY-VOICE-TTS](./FEATURE-BUDDY-VOICE-TTS.md) | Text-to-speech integration (system TTS / ElevenLabs) | backend, panel | medium |
| [FEATURE-BUDDY-VOICE-WAKE-WORD](./FEATURE-BUDDY-VOICE-WAKE-WORD.md) | Wake word detection on panel device | panel | medium |
| [FEATURE-BUDDY-VOICE-INTENT-ROUTING](./FEATURE-BUDDY-VOICE-INTENT-ROUTING.md) | Voice commands routed through intent system | backend | small |

### Phase 4 — Multi-Channel

| ID | Title | Scope | Size |
|----|-------|-------|------|
| [FEATURE-BUDDY-CHANNEL-TELEGRAM](./FEATURE-BUDDY-CHANNEL-TELEGRAM.md) | Telegram bot adapter | backend | medium |
| [FEATURE-BUDDY-CHANNEL-ADMIN-CHAT](./FEATURE-BUDDY-CHANNEL-ADMIN-CHAT.md) | Admin web chat interface | admin | small |
| [FEATURE-BUDDY-CHANNEL-PERSONALITY](./FEATURE-BUDDY-CHANNEL-PERSONALITY.md) | Personality configuration (personality.md) | backend | small |

## 9. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this epic and its child tasks.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- **Start with Phase 1 only.** Phases 2-4 are documented for architectural planning but should not be implemented until Phase 1 is complete and reviewed.
- The existing `SpaceSuggestionService` should NOT be modified or replaced — it continues to serve space-specific lighting suggestions independently.
- Follow the implementation order: Foundation → Conversation → Suggestions → Panel → Admin → Tests.
