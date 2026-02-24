# Task: Backend suggestion engine

ID: FEATURE-BUDDY-BACKEND-SUGGESTIONS
Type: feature
Scope: backend
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: planned

## 1. Business goal

In order to receive proactive, context-aware tips from the buddy,
As a home operator,
I want the buddy to detect patterns in my actions and generate useful suggestions — like creating scenes for repeated actions, or adjusting settings based on time of day.

## 2. Context

- Depends on FEATURE-BUDDY-BACKEND-FOUNDATION (action observer, context service, entities).
- The existing `SpaceSuggestionService` provides time-based lighting suggestions. The buddy suggestion engine is complementary — it generates higher-level suggestions (patterns, energy, conflicts) while the space suggestions continue independently.
- The suggestion engine uses `ActionObserverService.getRecentActions()` to detect patterns and `BuddyContextService.buildContext()` for context-aware rule evaluation.
- Suggestions are ephemeral (in-memory) with cooldown management — same pattern as `SpaceSuggestionService`.

## 3. Scope

**In scope**

- `PatternDetectorService`:
  - Analyses the action history ring buffer for repeated sequences
  - MVP rule: "same intent type + same space + similar time-of-day, 3+ occurrences in last 7 days"
  - Returns detected patterns with confidence score
- `SuggestionEngineService`:
  - Generates suggestions from detected patterns
  - Manages suggestion lifecycle: create, retrieve, apply, dismiss
  - Cooldown management (reuses the pattern from `SpaceSuggestionService`)
  - In-memory suggestion storage with auto-expiry
  - Emits `BuddyModule.Suggestion.Created` event via `EventEmitter2`
- `BuddySuggestionsController` — REST endpoints:
  - `GET /v1/modules/buddy/suggestions` — list active suggestions (optional `?space_id=`)
  - `POST /v1/modules/buddy/suggestions/:id/feedback` — accept or dismiss
- DTOs: `SuggestionFeedbackDto`
- Response models: `SuggestionResponseModel`, `SuggestionsResponseModel`
- Suggestion types enum: `PATTERN_SCENE_CREATE`, `LIGHTING_OPTIMISE`, `GENERAL_TIP`

**Out of scope**

- Heartbeat / periodic evaluation (→ FEATURE-BUDDY-PROACTIVE-HEARTBEAT, Phase 2)
- Energy suggestions (→ FEATURE-BUDDY-PROACTIVE-ENERGY, Phase 2)
- Conflict detection (→ FEATURE-BUDDY-PROACTIVE-CONFLICTS, Phase 2)
- Anomaly detection (→ FEATURE-BUDDY-PROACTIVE-ANOMALY, Phase 2)
- Panel/admin UI

## 4. Acceptance criteria

- [ ] `PatternDetectorService.detectPatterns()` analyses the action history and returns patterns:
  ```typescript
  interface DetectedPattern {
    intentType: IntentType;
    spaceId: string;
    spaceName: string;
    timeOfDay: { hour: number; minute: number };
    occurrences: number;
    confidence: number; // 0-1
    firstSeen: Date;
    lastSeen: Date;
  }
  ```
- [ ] Pattern detection rule: same `intent.type` + same `intent.context.spaceId` + time within ±60 min window, with 3+ occurrences in last 7 days, produces a pattern with confidence ≥ 0.6
- [ ] `SuggestionEngineService.generateSuggestions()` creates suggestions from detected patterns:
  - For `PATTERN_SCENE_CREATE`: "You [action] in [space] around [time] regularly. Create a scene?"
  - For `LIGHTING_OPTIMISE`: time-of-day lighting suggestions (complementary to existing space suggestions)
- [ ] Each suggestion has: `id` (UUID), `type`, `title`, `reason`, `spaceId`, `metadata` (pattern details), `createdAt`, `expiresAt`
- [ ] Suggestions have configurable cooldown (default 4 hours per suggestion type + space)
- [ ] Dismissed suggestions set cooldown; accepted suggestions set cooldown and optionally execute an action
- [ ] `GET /v1/modules/buddy/suggestions` returns active (non-expired, non-cooldown) suggestions
- [ ] `GET /v1/modules/buddy/suggestions?space_id=X` filters by space
- [ ] `POST /v1/modules/buddy/suggestions/:id/feedback` accepts body `{ feedback: 'applied' | 'dismissed' }`
- [ ] `BuddyModule.Suggestion.Created` event is emitted when a new suggestion is generated, with payload containing the suggestion data
- [ ] All controller methods have proper Swagger decorators
- [ ] Cooldown key format: `{spaceId}:{suggestionType}` (same pattern as `SpaceSuggestionService`)

## 5. Example scenarios

### Scenario: Repeated action detection

Given the action history buffer contains 5 entries of `light.toggle` in `living-room` between 22:45 and 23:15 over the past week
When `PatternDetectorService.detectPatterns()` is called
Then it returns a pattern with `intentType: 'light.toggle'`, `spaceId: 'living-room'`, `occurrences: 5`, `confidence: 0.8`

### Scenario: Suggestion from pattern

Given a detected pattern for "lights off in living room at ~23:00"
When `SuggestionEngineService.generateSuggestions()` processes the pattern
Then a suggestion is created: type=`PATTERN_SCENE_CREATE`, title="Create a scene for this?", reason="You turn off the living room lights around 11 PM regularly"
And a `BuddyModule.Suggestion.Created` event is emitted

### Scenario: Suggestion cooldown

Given a suggestion of type `PATTERN_SCENE_CREATE` for `living-room` was dismissed 1 hour ago (cooldown 4h)
When `GET /v1/modules/buddy/suggestions?space_id=living-room` is called
Then the suggestion is not returned (still on cooldown)

## 6. Technical constraints

- Follow API conventions from `.ai-rules/API_CONVENTIONS.md`
- Suggestions are in-memory (not persisted to DB) — they are transient recommendations
- Cooldown uses the same in-memory `Map<string, number>` pattern as `SpaceSuggestionService`
- Pattern detection is rule-based only (no ML) — keep it simple and deterministic
- Do not modify the existing `SpaceSuggestionService` — this is complementary
- Do not modify generated code
- Do not introduce new npm dependencies

## 7. Implementation hints

- **Cooldown pattern**: Copy `isOnCooldown()`, `setCooldown()`, `clearCooldown()` utility functions from `modules/spaces/services/space-suggestion.service.ts`
- **Suggestion storage**: Use a `Map<string, BuddySuggestion>` with periodic cleanup of expired entries (60s interval)
- **Pattern detection algorithm**:
  1. Group actions by `(intentType, spaceId)`
  2. For each group, cluster by time-of-day (±60 min window)
  3. If cluster size ≥ 3 in last 7 days → pattern detected
  4. Confidence = `min(1, occurrences / 7)` (daily pattern = 1.0)
- **Event emission**: `this.eventEmitter.emit(EventType.SUGGESTION_CREATED, suggestionPayload)` — the WebSocket gateway will forward this automatically
- **Controller reference**: Follow `modules/spaces/controllers/spaces.controller.ts` for the suggestion and feedback endpoint pattern

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to backend only.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Depends on FEATURE-BUDDY-BACKEND-FOUNDATION — assume action observer and context service already exist.
