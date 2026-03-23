# Task: Fix unbounded tracker maps in evaluators

ID: TECH-BUDDY-MEMORY-LEAK-CLEANUP
Type: technical
Scope: backend
Size: small
Parent: EPIC-BUDDY-HARDENING
Status: done

## 1. Business goal

In order to prevent gradual memory growth in long-running Smart Panel deployments,
As a system administrator,
I want evaluator tracker maps to be bounded and automatically cleaned up when devices or spaces are removed.

## 2. Context

- `AnomalyDetectorEvaluator` maintains a `stuckSensorTracker` Map that records last-seen values and timestamps for every sensor property.
- `ConflictDetectorEvaluator` maintains an `occupancyTracker` Map that records per-space occupancy state.
- Both trackers only clean up entries for spaces/devices present in the **current evaluation context**. If a space or device is removed from the system, its tracker entries persist indefinitely.
- The `BuddyContextService` cache uses a TTL + eviction strategy but the eviction sort is O(n log n) on every eviction, causing potential jitter.

### Memory growth scenario

1. User adds 10 sensors → tracker has 10 entries
2. User removes 5 sensors, adds 5 new ones → tracker has 15 entries (5 stale)
3. Over months of adding/removing devices, tracker grows unbounded

## 3. Scope

**In scope**

- Add periodic sweep for stale entries in `AnomalyDetectorEvaluator.stuckSensorTracker`
- Add periodic sweep for stale entries in `ConflictDetectorEvaluator.occupancyTracker`
- Optimize `BuddyContextService` cache eviction from O(n log n) to O(n) or O(1)
- Add maximum size bounds to all tracker maps
- Add unit tests for cleanup behavior

**Out of scope**

- Evaluator logic changes (detection algorithms stay the same)
- Database-backed tracker persistence
- Context cache replacement with external cache (Redis, etc.)

## 4. Acceptance criteria

- [ ] `stuckSensorTracker` removes entries for device properties not seen in the last N evaluation cycles (configurable, default: 10 cycles)
- [ ] `occupancyTracker` removes entries for spaces not seen in the last N evaluation cycles (configurable, default: 10 cycles)
- [ ] Both trackers have a hard maximum size (e.g., 1000 entries) with LRU eviction
- [ ] `BuddyContextService` cache eviction is O(n) or better (replace sort with FIFO or insertion-order iteration)
- [ ] Unit tests verify: stale entries cleaned up, hard limit respected, cache eviction performance
- [ ] No changes to evaluator detection logic or suggestion output

## 5. Example scenarios

### Scenario: Removed device cleaned from tracker

Given sensor "bedroom_temp" was tracked for stuck detection
When the bedroom temperature sensor is removed from the system
And 10 heartbeat cycles pass without the sensor appearing in context
Then the "bedroom_temp" entry is removed from `stuckSensorTracker`

### Scenario: Hard limit prevents unbounded growth

Given the `stuckSensorTracker` has 1000 entries (at the hard limit)
When a new sensor property is detected
Then the oldest entry is evicted to make room
And the tracker stays at 1000 entries

## 6. Technical constraints

- Follow existing service patterns in `modules/buddy/services/`
- Do not change evaluator constructor signatures (avoid breaking DI)
- Tracker cleanup should happen during evaluation cycles, not on separate timers (to avoid adding complexity)
- Use `Map` iteration order (insertion order) for efficient oldest-entry eviction

## 7. Implementation hints

- Add a `lastSeenCycle` counter to tracker entries:
  ```typescript
  interface TrackerEntry {
    value: number;
    timestamp: Date;
    lastSeenCycle: number;
  }
  ```
- In each evaluation cycle, increment a cycle counter and update `lastSeenCycle` for active entries
- After evaluation, sweep entries where `currentCycle - lastSeenCycle > MAX_STALE_CYCLES`
- For hard limit, check size before insertion and delete the first key if over limit (Map maintains insertion order)
- For context cache, replace the sort-based eviction with iteration over `Map.keys()` and delete the first N entries needed

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
