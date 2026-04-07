# Task: Persist buddy suggestions to database

ID: TECH-BUDDY-SUGGESTION-PERSISTENCE
Type: technical
Scope: backend
Size: medium
Parent: EPIC-BUDDY-HARDENING
Status: done

## 1. Business goal

In order to prevent suggestion data loss on server restarts and enable future analytics,
As a home operator,
I want buddy suggestions to be reliably stored and survive service restarts.

## 2. Context

- `SuggestionEngineService` currently stores all suggestions in-memory using a plain array (`this.suggestions: Suggestion[]`).
- Server restart or crash loses **all** active suggestions, cooldowns, and feedback history.
- The `generating` boolean flag used to prevent concurrent generation is not atomic — race conditions exist when heartbeat and manual triggers overlap.
- Cooldown state (`CooldownManager`) is also in-memory only, meaning dismissed suggestions can immediately reappear after restart.
- The existing `BuddyConversationEntity` and `BuddyMessageEntity` patterns provide a reference for the new entity.

### Current in-memory structures at risk

| Data | Current storage | Impact of restart |
|------|----------------|-------------------|
| Active suggestions | Array in memory | All lost |
| Cooldowns | CooldownManager map | All reset — dismissed suggestions reappear |
| Generation lock | Boolean flag | Race conditions possible |
| Feedback history | Not stored | Cannot track acceptance rates |

## 3. Scope

**In scope**

- New `BuddySuggestionEntity` with TypeORM migration
- Persist suggestions on creation, update status on feedback (accept/dismiss/expire)
- Persist cooldown state (last suggestion time per type+space)
- Replace boolean `generating` flag with Promise-based locking
- Load active suggestions from DB on module startup
- Cleanup expired suggestions via scheduled task or on-access

**Out of scope**

- Analytics dashboard for suggestion acceptance rates
- Suggestion history UI in admin
- Changes to the suggestion REST API response shape
- Changes to WebSocket event payloads

## 4. Acceptance criteria

- [x] New `BuddySuggestionEntity` created with fields: id, type, spaceId, title, reason, metadata (JSON), status (active/accepted/dismissed/expired), feedbackAt, createdAt, expiresAt
- [x] Initial migration updated with `buddy_module_suggestions` table and indexes
- [x] `SuggestionEngineService` reads/writes suggestions via TypeORM repository instead of in-memory Map
- [x] Cooldown state persisted — derived from feedbackAt timestamps in DB, survives restart
- [x] Generation lock uses Promise-based approach instead of boolean flag
- [x] Active suggestions loaded from database on module startup (onModuleInit)
- [x] Expired suggestions cleaned up automatically via scheduled cleanup (status → expired)
- [x] Existing REST API responses unchanged (backward compatible)
- [x] WebSocket events unchanged
- [x] Unit tests updated with mock TypeORM repository
- [x] Duplicate prevention via DB queries (hasDuplicateSuggestion, hasSuggestionForPattern)

## 5. Example scenarios

### Scenario: Suggestions survive restart

Given a suggestion "Excess solar energy (2kW)" is active
When the server restarts
Then the suggestion is still returned by `GET /v1/modules/buddy/suggestions`
And the suggestion retains its original creation timestamp

### Scenario: Cooldown respected after restart

Given the user dismissed a "heating + open window" suggestion at 14:00
And the cooldown is 4 hours
When the server restarts at 14:30
Then no new "heating + open window" suggestion is created until 18:00

### Scenario: Concurrent generation prevented

Given the heartbeat triggers suggestion generation
And a manual API call triggers generation simultaneously
Then only one generation cycle runs
And no duplicate suggestions are created

## 6. Technical constraints

- Follow existing entity patterns from `modules/buddy/entities/`
- Migration must be safe for SQLite (the primary database)
- Do not change `SuggestionResponseModel` or `SuggestionDataModel` shapes
- Keep the `SuggestionEngineService` API surface unchanged (methods like `getActiveSuggestions`, `submitFeedback`, `generateSuggestions`)
- Suggestion metadata field should use JSON column type (same as `BuddyMessageEntity.metadata`)

## 7. Implementation hints

- Create `BuddySuggestionEntity` in `modules/buddy/entities/buddy-suggestion.entity.ts`
- Use `@Column('simple-json')` for metadata (SQLite compatible)
- Add a `status` enum column: `active`, `accepted`, `dismissed`, `expired`
- For the generation lock, use a `Promise<void> | null` pattern:
  ```typescript
  private generationPromise: Promise<void> | null = null;

  async generateSuggestions(): Promise<void> {
    if (this.generationPromise) return this.generationPromise;
    this.generationPromise = this._doGenerate().finally(() => {
      this.generationPromise = null;
    });
    return this.generationPromise;
  }
  ```
- For cooldown persistence, store `lastSuggestionAt` per type+spaceId in a separate table or as part of suggestion records
- Load active (non-expired, non-dismissed) suggestions in `onModuleInit`
- Add `@Index` on `status` and `expiresAt` for efficient cleanup queries

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
