# Task: Buddy Module — AI Assistant for Smart Panel
ID: EPIC-BUDDY-MODULE
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to make the smart panel more intelligent and proactive,
As a home operator using the panel,
I want an AI "buddy" that observes my actions, learns my patterns, and suggests automations or optimizations — starting with text interaction and evolving toward voice.

Inspired by the [OpenClaw](https://github.com/openclaw/openclaw) project's proactive agent model, but purpose-built for the smart panel's device/space/scene domain.

## 2. Context

- **Existing foundation**: `SpaceSuggestionService` in `apps/backend/src/modules/spaces/` already implements time-based lighting suggestions with cooldown management, feedback tracking, and intent execution. The buddy module generalises this pattern.
- **Intents module**: Tracks every operator action (30+ intent types) with full context (origin, space, device, targets, timestamps). This is the "action recognition" backbone.
- **Scenes module**: Scene executor with platform registry — buddy can suggest scene creation from detected patterns and trigger scenes.
- **WebSocket gateway**: Real-time bidirectional communication via Socket.IO with room-based routing. All `EventEmitter2` events are forwarded to subscribed clients.
- **Extension system**: Mature plugin lifecycle management (`IManagedPluginService`) with health checks, dependency ordering, config persistence, and enable/disable toggling.
- **OpenClaw reference**: Self-hosted AI agent with heartbeat daemon, proactive suggestions, persistent memory, multi-channel messaging, and voice support. We adopt the concepts but integrate deeply with smart panel's domain model.

## 3. Scope

### In scope (phased)

**Phase 1 — Observer + Text Suggestions (MVP)**
- Backend `buddy` module with event observation service
- Action pattern detection from intent stream
- Rule-based + LLM-powered suggestion engine
- REST API for chat/conversation, suggestions, feedback
- WebSocket events for real-time suggestion delivery
- Panel: chat drawer UI for text interaction
- Panel: suggestion notification badges
- Admin: buddy settings page (enable/disable, AI provider config)
- Conversation history persistence (SQLite/TypeORM)

**Phase 2 — Proactive Intelligence**
- Heartbeat service (periodic state evaluation)
- Anomaly detection (sensor drift, unusual patterns)
- Energy optimisation suggestions
- Scene creation suggestions from repeated patterns
- Conflict detection (heating + open window)

**Phase 3 — Voice Interaction**
- Wake word detection on panel device
- Speech-to-text (Whisper local or cloud STT)
- Text-to-speech (ElevenLabs or local TTS)
- Voice commands routed through intent system

**Phase 4 — Multi-Channel**
- Telegram/Signal/WhatsApp adapters
- Admin web chat interface
- SOUL.md personality configuration

### Out of scope

- Training custom ML models
- Image/camera-based recognition
- Third-party skill marketplace (OpenClaw ClawHub equivalent)
- Multi-tenant / multi-user buddy personalities

## 4. Acceptance criteria

### Phase 1 (MVP)

- [ ] Backend `BuddyModule` registered as a toggleable module
- [ ] `ActionObserverService` subscribes to intent events and records action history
- [ ] `PatternDetectorService` identifies repeated action sequences (rule-based MVP)
- [ ] `SuggestionEngine` generates context-aware suggestions (time, space, device state)
- [ ] `BuddyConversationService` handles text chat with LLM integration (configurable provider: Claude, OpenAI, Ollama)
- [ ] REST API endpoints:
  - `GET /v1/modules/buddy/conversations` — list conversations
  - `POST /v1/modules/buddy/conversations` — start new conversation
  - `POST /v1/modules/buddy/conversations/:id/messages` — send message
  - `GET /v1/modules/buddy/suggestions` — get active suggestions for a space
  - `POST /v1/modules/buddy/suggestions/:id/feedback` — accept/dismiss suggestion
  - `GET /v1/modules/buddy/config` — get buddy configuration
  - `PATCH /v1/modules/buddy/config` — update configuration
- [ ] WebSocket events emitted:
  - `BuddyModule.Suggestion.Created` — new suggestion available
  - `BuddyModule.Conversation.MessageReceived` — buddy response ready
- [ ] Panel app: buddy module with chat drawer accessible from deck UI
- [ ] Panel app: suggestion cards displayed as dismissible notifications
- [ ] Admin app: buddy settings page (enable/disable, provider selection, API key)
- [ ] Buddy has full context of spaces, devices, scenes, energy, weather when responding
- [ ] Conversation history persisted in database
- [ ] Suggestions respect cooldown (reuse existing pattern from SpaceSuggestionService)
- [ ] Unit tests for pattern detection and suggestion rules
- [ ] E2E tests for conversation and suggestion API endpoints

## 5. Example scenarios

### Scenario: Repeated action detection

Given the operator turns off living room lights at ~23:00 for 5 consecutive days
When the buddy detects this pattern
Then it emits a `BuddyModule.Suggestion.Created` event
And the panel shows a suggestion: "You turn off the living room lights around 11 PM every night. Want me to create a scene for this?"

### Scenario: Text conversation

Given the operator opens the buddy chat drawer on the panel
When they type "What's the temperature in the bedroom?"
Then the buddy queries the devices module for bedroom temperature sensors
And responds with "The bedroom is currently 21.5°C (humidity 45%). The thermostat is set to 22°C."

### Scenario: Energy suggestion

Given solar production exceeds current consumption by 2kW
When the buddy's heartbeat evaluates the energy state
Then it suggests "Your solar panels are producing 2kW excess energy. Consider running the dishwasher or charging your EV."

### Scenario: Conflict detection

Given the heating is set to 25°C in the living room
And a window sensor shows the living room window is open
When the buddy detects this conflict
Then it suggests "The living room window is open but heating is on at 25°C. Want to lower the setpoint or close the window?"

## 6. Technical constraints

- Follow the existing module structure in `apps/backend/src/modules/`
- Follow API conventions from `.ai-rules/API_CONVENTIONS.md`
- Follow panel module patterns from `apps/panel/lib/modules/`
- Do not modify generated code (OpenAPI spec, panel API client, etc.)
- AI provider integration must be configurable and swappable (no hard dependency on a single provider)
- Must work without an AI provider configured (rule-based suggestions only, chat disabled)
- Must not introduce excessive latency on the main event loop
- LLM calls must be async with proper error handling and timeouts
- Respect existing auth patterns (JWT tokens, display tokens)
- Do not introduce new dependencies unless really needed
- Tests are expected for new business logic

## 7. Implementation hints

### Backend module structure
```
apps/backend/src/modules/buddy/
├── buddy.constants.ts
├── buddy.exceptions.ts
├── buddy.module.ts
├── buddy.openapi.ts
├── controllers/
│   ├── buddy-conversations.controller.ts
│   └── buddy-suggestions.controller.ts
├── dto/
│   ├── create-conversation.dto.ts
│   ├── send-message.dto.ts
│   ├── suggestion-feedback.dto.ts
│   └── update-config.dto.ts
├── entities/
│   ├── buddy-conversation.entity.ts
│   ├── buddy-message.entity.ts
│   └── buddy-suggestion.entity.ts
├── models/
│   ├── config.model.ts
│   ├── conversation.model.ts
│   ├── message.model.ts
│   └── suggestion.model.ts
├── services/
│   ├── action-observer.service.ts        # Listens to intent events
│   ├── buddy-context.service.ts          # Aggregates device/space/weather state
│   ├── buddy-conversation.service.ts     # Chat with LLM
│   ├── llm-provider.service.ts           # Swappable LLM integration
│   ├── pattern-detector.service.ts       # Detects repeated actions
│   └── suggestion-engine.service.ts      # Generates suggestions
└── listeners/
    └── intent-event.listener.ts          # EventEmitter2 subscriber
```

### Panel module structure
```
apps/panel/lib/modules/buddy/
├── constants.dart
├── export.dart
├── module.dart
├── models/
│   ├── conversation.dart
│   ├── message.dart
│   └── suggestion.dart
├── repositories/
│   └── buddy_repository.dart
├── services/
│   └── buddy_service.dart
├── presentation/
│   ├── buddy_chat_drawer.dart
│   ├── buddy_suggestion_card.dart
│   └── widgets/
│       ├── message_bubble.dart
│       └── suggestion_badge.dart
└── types/
    └── buddy_event_type.dart
```

### Key patterns to follow
- Look at `SpaceSuggestionService` for suggestion + cooldown + feedback pattern
- Look at `IntentsService` for event emission pattern
- Look at `SceneExecutorService` for platform registry pattern (for LLM providers)
- Look at `WebsocketGateway.handleBusEvent()` for event forwarding to clients
- Look at `CommandEventRegistryService` for WebSocket command handling
- Look at existing panel modules (deck, intents) for Flutter module structure

### LLM context building
The buddy should build a system prompt that includes:
- Current space layout (rooms, zones, device counts)
- Active device states (lights on/off, thermostat setpoints, sensor readings)
- Recent intent history (last N actions)
- Active scenes
- Weather conditions
- Energy state (if energy module enabled)
- Time of day, day of week

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Start with Phase 1 only. Phases 2-4 are documented for architectural planning but should not be implemented yet.
- The existing `SpaceSuggestionService` should NOT be modified or replaced — it continues to serve space-specific lighting suggestions independently. The buddy module is a higher-level system that can incorporate those suggestions along with many other types.
