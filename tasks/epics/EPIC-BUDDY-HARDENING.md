# Epic: Buddy module — Hardening & reliability improvements

ID: EPIC-BUDDY-HARDENING
Type: technical
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to make the buddy module production-ready and resilient under real-world usage,
As the development team maintaining the Smart Panel,
I want to fix data persistence gaps, memory leaks, race conditions, and robustness issues identified during the code review audit.

## 2. Context

The buddy module (EPIC-BUDDY-MODULE) is feature-complete across all 4 phases (MVP, Proactive Intelligence, Voice, Multi-Channel). A comprehensive code review identified several reliability and correctness issues that should be resolved before wider deployment:

### Key findings by severity

| Severity | Count | Summary |
|----------|-------|---------|
| Critical | 3 | Suggestions in-memory only (lost on restart); pattern detector ignores timezones; STT/TTS have no timeout enforcement |
| Medium | 5 | Memory leaks in evaluator trackers; unbounded LLM system prompt; fragile error detection via string matching; SDK silent failures; race conditions |
| Low | 5 | Panel JSON validation gaps; timer precision; admin type casts; OAuth edge cases; rule reload |

### Architecture decisions

- **Suggestions must be persisted** to the database — the current in-memory-only approach is the single biggest reliability gap.
- **Provider timeout enforcement** should happen at the service layer, not rely on individual providers.
- **Memory cleanup** for evaluator trackers should be proactive (timer-based) rather than reactive (only during evaluation).
- All fixes should maintain backward compatibility with existing API contracts and WebSocket events.

## 3. Scope

### In scope

- Persist suggestions to database with migration
- Fix timezone handling in pattern detector
- Add timeout enforcement for STT/TTS/LLM provider calls
- Fix memory leaks in evaluator tracker maps
- Harden conversation service (prompt truncation, race conditions)
- Fix SDK error handling (OpenAI silent tool drops, Anthropic type safety)
- Improve panel model validation and timer precision
- Polish admin type safety and UX gaps

### Out of scope

- New buddy features (wake-word improvements, new channels, etc.)
- Performance benchmarking / load testing
- Refactoring module structure or API contracts
- Changes to generated code (OpenAPI, panel API client)

## 4. Acceptance criteria

- [ ] Suggestions survive server restarts (persisted to database)
- [ ] Pattern detector produces correct time-of-day clusters regardless of timezone/DST
- [ ] STT/TTS/LLM calls have service-level timeout enforcement (no indefinite hangs)
- [ ] Evaluator tracker maps are bounded and cleaned up for removed devices/spaces
- [ ] Large home contexts are truncated to fit LLM token limits
- [ ] OpenAI SDK returns error responses to LLM for malformed tool calls (no silent drops)
- [ ] Panel model factories handle missing/null JSON fields gracefully
- [ ] Admin composables use proper types (no `as never` casts)
- [ ] All fixes covered by unit tests
- [ ] No breaking changes to existing API endpoints or WebSocket events

## 5. Child tasks

### Priority 1 — Critical fixes

| ID | Title | Scope | Size |
|----|-------|-------|------|
| [TECH-BUDDY-SUGGESTION-PERSISTENCE](../technical/TECH-BUDDY-SUGGESTION-PERSISTENCE.md) | Persist suggestions to database with proper locking | backend | medium |
| [TECH-BUDDY-TIMEZONE-SAFETY](../technical/TECH-BUDDY-TIMEZONE-SAFETY.md) | Fix pattern detector timezone and DST handling | backend | small |
| [TECH-BUDDY-PROVIDER-TIMEOUT-ENFORCEMENT](../technical/TECH-BUDDY-PROVIDER-TIMEOUT-ENFORCEMENT.md) | Add service-level timeout enforcement for STT/TTS/LLM | backend | small |

### Priority 2 — Medium fixes

| ID | Title | Scope | Size |
|----|-------|-------|------|
| [TECH-BUDDY-MEMORY-LEAK-CLEANUP](../technical/TECH-BUDDY-MEMORY-LEAK-CLEANUP.md) | Fix unbounded tracker maps in evaluators | backend | small |
| [TECH-BUDDY-CONVERSATION-HARDENING](../technical/TECH-BUDDY-CONVERSATION-HARDENING.md) | Harden conversation service (prompt truncation, races) | backend | medium |
| [TECH-BUDDY-SDK-ERROR-HANDLING](../technical/TECH-BUDDY-SDK-ERROR-HANDLING.md) | Fix SDK error handling and type safety | backend | small |

### Priority 3 — Low fixes / polish

| ID | Title | Scope | Size |
|----|-------|-------|------|
| [TECH-BUDDY-PANEL-ROBUSTNESS](../technical/TECH-BUDDY-PANEL-ROBUSTNESS.md) | Panel model validation, timer precision, voice state | panel | small |
| [TECH-BUDDY-ADMIN-POLISH](../technical/TECH-BUDDY-ADMIN-POLISH.md) | Admin type safety, auto-scroll, setup wizard | admin | small |

## 6. Technical constraints

- Follow the existing module / service structure in `apps/backend/src/modules/buddy/`
- Do not introduce new dependencies unless really needed
- Do not modify generated code (OpenAPI spec, panel API client, etc.)
- Tests are expected for all fixes
- Database changes require a TypeORM migration
- Maintain backward compatibility with existing API contracts and WebSocket events

## 7. Implementation hints

- Suggestion persistence: add a `BuddySuggestionEntity` similar to existing `BuddyConversationEntity` pattern
- Timezone fix: use `Intl.DateTimeFormat` or store timestamps in UTC; test with DST transitions
- Timeout enforcement: wrap provider calls with `AbortController` or `Promise.race` with a timeout
- Memory cleanup: add periodic sweep timers (e.g., every 10 heartbeat cycles) for stale tracker entries
- Prompt truncation: estimate token count and trim device/scene lists when approaching limit
- SDK fixes: return tool error responses instead of silently dropping; create proper TypeScript interfaces

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this epic and its child tasks.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- **Start with Priority 1 tasks.** Priority 2 and 3 should follow in order.
- Do not change API response shapes or WebSocket event names — these are public contracts.
