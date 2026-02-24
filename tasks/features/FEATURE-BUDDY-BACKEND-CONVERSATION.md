# Task: Backend conversation API (LLM provider + chat)

ID: FEATURE-BUDDY-BACKEND-CONVERSATION
Type: feature
Scope: backend
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: planned

## 1. Business goal

In order to have a text-based AI assistant on the smart panel,
As a home operator,
I want to chat with the buddy about my home — ask questions, request actions, and get intelligent responses based on the full home context.

## 2. Context

- Depends on FEATURE-BUDDY-BACKEND-FOUNDATION (entities, context service, action observer).
- The LLM provider must be swappable: Claude (Anthropic SDK), OpenAI, Ollama (local), or none.
- When no provider is configured, conversation endpoints return 503 with a descriptive message.
- The buddy receives the full home context (from `BuddyContextService`) as a system prompt, so it can answer questions like "What's the temperature in the bedroom?" or "Are any lights on?"
- Follow the controller/DTO/response-model patterns from `API_CONVENTIONS.md`.

## 3. Scope

**In scope**

- `LlmProviderService` — abstraction layer for LLM API calls:
  - `sendMessage(systemPrompt: string, messages: ChatMessage[], options?: LlmOptions): Promise<string>`
  - Provider selection from config: `claude` | `openai` | `ollama` | `none`
  - Timeout handling (default 30s)
  - Error handling (rate limits, network errors, invalid API keys)
- `BuddyConversationService` — CRUD for conversations and messages:
  - Create conversation (with optional title and spaceId)
  - Send message (persist user message, call LLM, persist assistant response)
  - List conversations
  - Get conversation with messages
  - Delete conversation
- `BuddyConversationsController` — REST endpoints:
  - `GET /v1/modules/buddy/conversations` — list
  - `POST /v1/modules/buddy/conversations` — create
  - `GET /v1/modules/buddy/conversations/:id` — get with messages
  - `POST /v1/modules/buddy/conversations/:id/messages` — send message
  - `DELETE /v1/modules/buddy/conversations/:id` — delete
- DTOs: `CreateConversationDto`, `SendMessageDto`
- Response models: `ConversationResponseModel`, `ConversationsResponseModel`, `MessageResponseModel`
- System prompt builder that includes `BuddyContext` data
- WebSocket event emission: `BuddyModule.Conversation.MessageReceived`

**Out of scope**

- Suggestion engine (→ FEATURE-BUDDY-BACKEND-SUGGESTIONS)
- Panel/admin UI (→ FEATURE-BUDDY-PANEL-MODULE, FEATURE-BUDDY-ADMIN-MODULE)
- Streaming responses (Phase 2+)
- Function calling / tool use (Phase 2+)

## 4. Acceptance criteria

- [ ] `LlmProviderService` supports provider selection: `claude`, `openai`, `ollama`, `none`
- [ ] When provider is `none` or not configured, `sendMessage()` throws `BuddyProviderNotConfiguredException`
- [ ] For `claude` provider: uses `@anthropic-ai/sdk` to call Claude API (API key from config)
- [ ] For `openai` provider: uses `openai` npm package (API key from config)
- [ ] For `ollama` provider: uses HTTP fetch to local Ollama endpoint (configurable URL, default `http://localhost:11434`)
- [ ] LLM calls have configurable timeout (default 30s) and proper error handling
- [ ] `BuddyConversationService.sendMessage()`:
  1. Persists user message to DB
  2. Builds system prompt with `BuddyContextService.buildContext()`
  3. Loads conversation history from DB
  4. Calls `LlmProviderService.sendMessage()`
  5. Persists assistant response to DB
  6. Emits `BuddyModule.Conversation.MessageReceived` event
  7. Returns the assistant message
- [ ] `POST /v1/modules/buddy/conversations/:id/messages` returns the assistant's response message
- [ ] `GET /v1/modules/buddy/conversations` returns paginated list (newest first)
- [ ] `DELETE /v1/modules/buddy/conversations/:id` cascades to delete messages
- [ ] All controller methods have proper Swagger decorators (`@ApiOperation`, `@ApiSuccessResponse`, etc.)
- [ ] Response models follow naming convention: `BuddyModuleRes*` for Swagger schema names
- [ ] System prompt includes: current timestamp, space layout, device states, scenes, weather, energy, recent actions

## 5. Example scenarios

### Scenario: Ask about device state

Given the bedroom has a temperature sensor reading 21.5°C
When the operator sends "What's the temperature in the bedroom?"
Then the buddy receives the full context including bedroom sensor data
And responds with the current temperature

### Scenario: No AI provider configured

Given the buddy config has provider set to `none`
When the operator calls `POST /v1/modules/buddy/conversations/abc/messages`
Then the API returns 503 with message "AI provider not configured"

### Scenario: LLM timeout

Given the AI provider takes longer than 30s to respond
When the operator sends a message
Then the API returns 504 with message "AI provider timeout"
And the user message is still persisted (but no assistant response)

## 6. Technical constraints

- Follow API conventions from `.ai-rules/API_CONVENTIONS.md`
- Controller returns `*ResponseModel`, DTOs are input only
- `@ApiOperation` required with: tags, summary, description, operationId
- Swagger schema names: `BuddyModuleRes*` for responses, `BuddyModule*` for entities
- LLM SDK packages (`@anthropic-ai/sdk`, `openai`) should be optional peer dependencies — the module must not crash if they're not installed, it should just make the provider unavailable
- Do not modify generated code
- System prompt must not exceed reasonable token limits — truncate device state if needed (max ~4000 tokens for context)

## 7. Implementation hints

- **LLM provider pattern**: Use a factory/strategy pattern. The `LlmProviderService` reads the configured provider from `ConfigModule` and delegates to the appropriate implementation. Do NOT create separate provider classes for MVP — a single service with a switch/case is sufficient.
- **System prompt**: Build it in `BuddyConversationService` using `BuddyContextService.buildContext()`. Format as structured text:
  ```
  You are a smart home assistant for the FastyBird Smart Panel.
  Current time: 2024-01-15T22:30:00Z

  ## Spaces
  - Living Room (room): 3 devices, 1 scene
  - Bedroom (room): 2 devices

  ## Devices
  - Living Room / Main Light: ON, brightness 80%
  - Bedroom / Temperature Sensor: 21.5°C
  ...
  ```
- **Conversation history**: Load last N messages (configurable, default 20) for the LLM context window
- **WebSocket event**: Emit via `EventEmitter2` using the event type from `buddy.constants.ts`. The existing WebSocket gateway will automatically forward it.
- **Optional SDK loading**: Use dynamic `import()` to load `@anthropic-ai/sdk` or `openai` at runtime:
  ```typescript
  const { Anthropic } = await import('@anthropic-ai/sdk');
  ```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to backend only.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Depends on FEATURE-BUDDY-BACKEND-FOUNDATION — assume entities, context service, and constants already exist.
