# Task: Backend buddy module tests

ID: FEATURE-BUDDY-BACKEND-TESTS
Type: feature
Scope: backend
Size: small
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to ensure the buddy module works correctly and doesn't regress,
As a developer,
I want unit tests for business logic and E2E tests for API endpoints.

## 2. Context

- Depends on all Phase 1 backend tasks: FEATURE-BUDDY-BACKEND-FOUNDATION, FEATURE-BUDDY-BACKEND-CONVERSATION, FEATURE-BUDDY-BACKEND-SUGGESTIONS.
- Backend tests use Jest with `ts-jest`.
- Unit tests go next to source files: `*.spec.ts` in `src/`.
- E2E tests go in `test/`: `*.e2e-spec.ts`.
- Follow existing test patterns from `modules/security/services/*.spec.ts` (unit) and `test/` (E2E).

## 3. Scope

**In scope**

- Unit tests:
  - `PatternDetectorService` — pattern detection algorithm, edge cases (no actions, single action, actions across midnight, actions in different spaces)
  - `SuggestionEngineService` — suggestion generation, cooldown management, suggestion expiry
  - `ActionObserverService` — ring buffer behavior (add, overflow, get recent)
  - `BuddyContextService` — context building (mock dependencies, verify aggregation)
  - `BuddyConversationService` — message persistence, conversation CRUD (mock LLM provider)
  - `LlmProviderService` — provider selection, error handling (mock external APIs)
- E2E tests:
  - `GET /v1/modules/buddy/conversations` — list empty, list with conversations
  - `POST /v1/modules/buddy/conversations` — create conversation
  - `POST /v1/modules/buddy/conversations/:id/messages` — send message (mock LLM)
  - `GET /v1/modules/buddy/suggestions` — list suggestions
  - `POST /v1/modules/buddy/suggestions/:id/feedback` — accept/dismiss

**Out of scope**

- Panel widget tests
- Admin component tests
- Integration tests with real LLM providers

## 4. Acceptance criteria

- [x] `PatternDetectorService` unit tests cover:
  - No actions → no patterns
  - Single action → no patterns
  - 3+ same actions (same space, similar time) → pattern detected
  - Actions in different spaces → separate patterns
  - Actions spread over time (> ±60 min) → no cluster
  - Old actions (> 7 days) → excluded
  - Confidence calculation is correct
- [x] `SuggestionEngineService` unit tests cover:
  - Pattern → suggestion created
  - Cooldown prevents duplicate suggestions
  - Dismissed suggestion sets cooldown
  - Applied suggestion sets cooldown
  - Expired suggestions cleaned up
- [x] `ActionObserverService` unit tests cover:
  - Add action to buffer
  - Buffer overflow (oldest removed)
  - Get recent actions with limit
  - Get all actions
- [x] `BuddyContextService` unit tests cover:
  - Context includes spaces, devices, scenes
  - Context handles missing weather/energy gracefully
  - Space-filtered context returns only relevant data
- [x] `BuddyConversationService` unit tests cover:
  - Create conversation
  - Send message persists both user and assistant messages
  - Provider not configured → throws `BuddyProviderNotConfiguredException`
  - LLM timeout → throws appropriate error
- [x] E2E tests for conversation endpoints work end-to-end with mocked LLM
- [x] E2E tests for suggestion endpoints work end-to-end
- [x] All tests pass: `pnpm run test:unit` and `pnpm run test:e2e`

## 5. Example scenarios

### Scenario: Pattern detection unit test

Given an action history with 5 entries:
  - `light.toggle` in `living-room` at 23:00 (day 1)
  - `light.toggle` in `living-room` at 22:55 (day 2)
  - `light.toggle` in `living-room` at 23:10 (day 3)
  - `light.toggle` in `bedroom` at 23:00 (day 4)
  - `light.toggle` in `living-room` at 22:50 (day 5)
When `detectPatterns()` is called
Then it returns 1 pattern: `living-room` + `light.toggle` with 4 occurrences

### Scenario: E2E conversation test

Given a test module with mocked LLM provider that always responds "Test response"
When `POST /v1/modules/buddy/conversations` creates a conversation
And `POST /v1/modules/buddy/conversations/:id/messages` sends "Hello"
Then the response contains the assistant message "Test response"
And `GET /v1/modules/buddy/conversations/:id` returns both messages

## 6. Technical constraints

- Use Jest with `ts-jest` — follow existing test config
- Unit tests: `Test.createTestingModule()` with mocked dependencies
- E2E tests: `Test.createTestingModule()` with full module setup (SQLite :memory:)
- Mock the LLM provider for all tests — never call real APIs
- Follow existing naming: `*.spec.ts` for unit, `*.e2e-spec.ts` for E2E
- Do not introduce new test dependencies

## 7. Implementation hints

- **Unit test pattern**: Follow `modules/security/services/security-aggregator.service.spec.ts`
- **E2E test pattern**: Follow existing E2E tests in `test/` directory
- **Mocking LLM**: Create a mock `LlmProviderService` that returns predetermined responses:
  ```typescript
  const mockLlmProvider = { sendMessage: jest.fn().mockResolvedValue('Mocked response') };
  ```
- **Time manipulation**: Use `jest.useFakeTimers()` for pattern detection tests with time-based logic
- **Ring buffer tests**: Test with small buffer size (e.g., 5) to easily verify overflow behavior

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to backend test files only.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Depends on all Phase 1 backend tasks being complete.
