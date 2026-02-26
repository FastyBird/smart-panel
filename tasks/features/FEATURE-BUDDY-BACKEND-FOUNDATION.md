# Task: Backend buddy module foundation

ID: FEATURE-BUDDY-BACKEND-FOUNDATION
Type: feature
Scope: backend
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to have the foundational infrastructure for the AI buddy,
As a developer,
I want a backend `BuddyModule` with entity persistence, context aggregation, action observation, and proper NestJS registration — so that follow-up tasks (conversation API, suggestion engine) can build on it.

## 2. Context

- This is the first task in the buddy module Phase 1 sequence. It creates the scaffolding that all other buddy tasks depend on.
- Follow the same module registration pattern as `WeatherModule` and `SecurityModule`:
  - `@ApiTag` decorator on the module class
  - `OnModuleInit` to register Swagger models, config mapping, and extension metadata
  - Router prefix in `app.module.ts` under `MODULES_PREFIX`
- The `ActionObserverService` subscribes to completed intent events (via `@OnEvent`) to build a history buffer. This is analogous to how `SecurityStateListener` subscribes to device property changes.
- The `BuddyContextService` aggregates home state from multiple modules — it does NOT own any data, it reads from `SpacesService`, `DevicesModule`, `ScenesModule`, `WeatherService`, and `EnergyModule`.

## 3. Scope

**In scope**

- `buddy.constants.ts` — module prefix, name, API tag, event types enum
- `buddy.module.ts` — NestJS module with `@ApiTag`, `@Module`, `OnModuleInit`
- `buddy.openapi.ts` — Swagger extra models array
- `buddy.exceptions.ts` — custom exceptions (`BuddyProviderNotConfiguredException`, `BuddyConversationNotFoundException`)
- Entity files:
  - `BuddyConversationEntity` — table `buddy_module_conversations` (id, title, spaceId?, createdAt, updatedAt)
  - `BuddyMessageEntity` — table `buddy_module_messages` (id, conversationId, role, content, createdAt)
- Migration for creating the two tables
- `BuddyContextService` — reads and aggregates state from spaces, devices, scenes, weather, energy modules
- `ActionObserverService` — subscribes to `IntentEventType.COMPLETED` events, stores in ring buffer (configurable size, default 200)
- `IntentEventListener` — the `@OnEvent` subscriber class that delegates to `ActionObserverService`
- `UpdateBuddyConfigDto` — configuration DTO (enabled, provider, apiKey, model, etc.)
- `BuddyConfigModel` — response model for module configuration
- Registration in `app.module.ts`: add `BuddyModule` import and router entry

**Out of scope**

- LLM provider integration (→ FEATURE-BUDDY-BACKEND-CONVERSATION)
- Suggestion engine (→ FEATURE-BUDDY-BACKEND-SUGGESTIONS)
- API controllers and endpoints (→ FEATURE-BUDDY-BACKEND-CONVERSATION, FEATURE-BUDDY-BACKEND-SUGGESTIONS)
- Panel and admin UI
- Tests (→ FEATURE-BUDDY-BACKEND-TESTS)

## 4. Acceptance criteria

- [x] `buddy.constants.ts` exports: `BUDDY_MODULE_PREFIX = 'buddy'`, `BUDDY_MODULE_NAME = 'buddy-module'`, `BUDDY_MODULE_API_TAG_NAME = 'Buddy module'`, `BUDDY_MODULE_API_TAG_DESCRIPTION`, `EventType` enum with `SUGGESTION_CREATED`, `CONVERSATION_MESSAGE_RECEIVED`, and `LlmProvider` enum with `CLAUDE`, `OPENAI`, `OLLAMA`, `NONE`
- [x] `BuddyConversationEntity` has columns: `id` (UUID PK), `title` (varchar, nullable), `spaceId` (varchar, nullable), `createdAt` (datetime), `updatedAt` (datetime). Table name: `buddy_module_conversations`
- [x] `BuddyMessageEntity` has columns: `id` (UUID PK), `conversationId` (varchar FK), `role` (varchar: 'user' | 'assistant' | 'system'), `content` (text), `createdAt` (datetime). Table name: `buddy_module_messages`
- [x] Migration creates both tables with proper column types for SQLite
- [x] `BuddyContextService` exposes `buildContext(spaceId?: string): Promise<BuddyContext>` that returns aggregated home state
- [x] `ActionObserverService` exposes `getRecentActions(limit?: number): ActionRecord[]` and internally stores completed intents in a ring buffer
- [x] `IntentEventListener` uses `@OnEvent(IntentEventType.COMPLETED)` decorator and passes completed intent data to `ActionObserverService`
- [x] `BuddyModule` is registered in `app.module.ts` with route prefix `BUDDY_MODULE_PREFIX` under `MODULES_PREFIX` in the `RouterModule.register` children, and in the direct imports list
- [x] `BuddyModule.onModuleInit()` registers: Swagger models, config mapping (`ModulesTypeMapperService`), and extension metadata (`ExtensionsService`)
- [x] Module compiles without errors (`pnpm run lint:js` passes)

## 5. Example scenarios

### Scenario: Action observation

Given a user toggles the living room lights via the panel
When the intent completes with `IntentEventType.COMPLETED`
Then the `IntentEventListener` receives the event
And `ActionObserverService` stores it in the ring buffer
And `getRecentActions(10)` returns the action with intent type, space, device, and timestamp

### Scenario: Context aggregation

Given the living room has 3 lights (2 on), a thermostat at 22°C, and 1 scene
When `BuddyContextService.buildContext('living-room-id')` is called
Then it returns a `BuddyContext` with the space, all 3 devices with current state, the scene, and recent intents for that space

## 6. Technical constraints

- Follow exact module registration pattern from `WeatherModule`:
  ```typescript
  @ApiTag({ tagName: BUDDY_MODULE_NAME, displayName: BUDDY_MODULE_API_TAG_NAME, description: BUDDY_MODULE_API_TAG_DESCRIPTION })
  @Module({ imports: [...], controllers: [...], providers: [...], exports: [...] })
  export class BuddyModule implements OnModuleInit { ... }
  ```
- Entity table names must be prefixed: `buddy_module_*`
- Migration file name: timestamp-based, e.g. `1766100000000-BuddyModuleInit.ts`
- Use `forwardRef(() => ...)` for circular module imports (e.g., `InfluxDbModule`)
- Ring buffer for action observer should be a simple array with `.shift()` when at capacity — no external dependency
- `BuddyContextService` must handle unavailable modules gracefully (weather/energy may not return data)
- Do not modify generated code
- Do not introduce new npm dependencies

## 7. Implementation hints

- **Module registration order in `app.module.ts`**: Add the router entry after `SecurityModule`. Add the direct import after `SecurityModule` as well.
- **Constants pattern**: Copy structure from `modules/security/security.constants.ts`
- **Entity pattern**: Copy structure from `modules/security/entities/security-alert-ack.entity.ts`
- **Listener pattern**: Copy `@OnEvent` decorator usage from `modules/security/listeners/security-state.listener.ts`
- **Context service**: Import `SpacesService` (from SpacesModule), device-related services (from DevicesModule), `ScenesService` (from ScenesModule), `WeatherService` (from WeatherModule), energy service (from EnergyModule) — use `forwardRef` where needed
- **Config DTO**: Follow `modules/weather/dto/update-config.dto.ts` for the DTO pattern, and `modules/weather/models/config.model.ts` for the response model

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to backend only.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- This task creates the foundation — do NOT implement controllers, LLM integration, or suggestion logic. Those belong to follow-up tasks.
