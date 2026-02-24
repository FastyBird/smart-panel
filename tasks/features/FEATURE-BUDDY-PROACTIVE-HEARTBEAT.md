# Task: Heartbeat service for periodic state evaluation

ID: FEATURE-BUDDY-PROACTIVE-HEARTBEAT
Type: feature
Scope: backend
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: planned

## 1. Business goal

In order to receive proactive suggestions without having to ask,
As a home operator,
I want the buddy to periodically evaluate the home state and generate suggestions when it detects opportunities for improvement.

## 2. Context

- Depends on all Phase 1 backend tasks being complete.
- The heartbeat runs as a `@nestjs/schedule` cron job (configurable interval, default every 5 minutes).
- Each heartbeat cycle: build context → run rule evaluators → create suggestions for any triggered rules.
- This is the foundation for Phase 2 — anomaly detection, energy, and conflict rules register as "evaluators" with the heartbeat service.

## 3. Scope

**In scope**

- `HeartbeatService`:
  - Configurable interval via buddy config (default 5 min)
  - Runs `BuddyContextService.buildContext()` for each active space
  - Passes context through a chain of registered evaluators
  - Creates suggestions from evaluator results
  - Only runs when buddy is enabled
- `HeartbeatEvaluator` interface:
  - `evaluate(context: BuddyContext): Promise<EvaluatorResult[]>`
  - Each evaluator returns 0 or more suggestion candidates
- Registration pattern: evaluators register with `HeartbeatService` during `onModuleInit`
- Migrate existing pattern detection to be an evaluator (run periodically instead of on-demand only)

**Out of scope**

- Specific evaluators (anomaly, energy, conflicts) — those are separate tasks
- Panel UI changes for Phase 2

## 4. Acceptance criteria

- [ ] `HeartbeatService` runs periodically using `@nestjs/schedule` `@Interval` decorator
- [ ] Interval is configurable via buddy config (default 300000ms = 5 min)
- [ ] Heartbeat evaluates all spaces with `suggestionsEnabled = true`
- [ ] `HeartbeatEvaluator` interface defined with `evaluate(context: BuddyContext): Promise<EvaluatorResult[]>`
- [ ] Evaluators register with `HeartbeatService.registerEvaluator(evaluator: HeartbeatEvaluator)`
- [ ] `PatternDetectorService` refactored to implement `HeartbeatEvaluator` (runs as part of heartbeat)
- [ ] Heartbeat skips execution when buddy module is disabled
- [ ] Heartbeat handles evaluator errors gracefully (log + skip, don't crash the cycle)
- [ ] Unit tests for heartbeat cycle logic

## 5. Example scenarios

### Scenario: Heartbeat cycle

Given the buddy is enabled and heartbeat interval is 5 minutes
And there are 3 spaces with suggestions enabled
When the heartbeat fires
Then it builds context for each space
And runs all registered evaluators
And creates suggestions for any triggered rules
And emits `BuddyModule.Suggestion.Created` events

## 6. Technical constraints

- Use `@nestjs/schedule` for periodic execution (already imported in `AppModule`)
- Do not use `setInterval` directly — use the framework's scheduling
- Evaluators run sequentially per space to avoid overwhelming the system
- Total heartbeat cycle should complete within 30 seconds (log warning if exceeded)
- Do not modify existing Phase 1 services — extend them

## 7. Implementation hints

- **Scheduling**: Use `@Interval(this.getIntervalMs())` or `SchedulerRegistry` for dynamic interval
- **Evaluator pattern**: Simple array of evaluator instances — no complex registry needed
- **Context per space**: `BuddyContextService.buildContext(spaceId)` for space-specific context
- Follow `@nestjs/schedule` documentation for cron/interval patterns

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to backend only.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
