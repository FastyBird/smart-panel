# Task: Scene creation suggestions from repeated patterns

ID: FEATURE-BUDDY-PROACTIVE-SCENE-SUGGEST
Type: feature
Scope: backend
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: planned

## 1. Business goal

In order to automate frequently repeated actions,
As a home operator,
I want the buddy to suggest creating scenes when it detects I perform the same sequence of actions regularly.

## 2. Context

- Depends on FEATURE-BUDDY-PROACTIVE-HEARTBEAT and Phase 1 pattern detection.
- Extends `PatternDetectorService` to detect multi-action sequences (not just single actions).
- When accepted, creates an actual scene via the Scenes module API.

## 3. Scope

**In scope**

- Enhanced pattern detection: multi-action sequences (e.g., "turn off living room lights + set thermostat to 18°C" as a group)
- `SceneSuggestionEvaluator` implementing `HeartbeatEvaluator`:
  - Detects repeated multi-action sequences
  - Generates scene creation suggestions with proposed name and actions
- When suggestion is accepted:
  - Creates a scene via `ScenesService` with the detected actions
  - Returns the created scene ID in the feedback response

**Out of scope**

- Scene scheduling (time triggers)
- Complex scene editing
- Scene testing/preview

## 4. Acceptance criteria

- [ ] Detects multi-action sequences: 2+ intents within 60 seconds targeting the same space, repeated 3+ times
- [ ] Generates suggestion with proposed scene name (based on space + time, e.g., "Living Room Evening")
- [ ] Suggestion metadata includes the list of proposed scene actions
- [ ] When feedback is `applied`: creates scene via Scenes module with the proposed actions
- [ ] Handles scene creation errors gracefully (suggest retry, don't lose the pattern)
- [ ] Unit tests for multi-action sequence detection and scene suggestion generation

## 5. Example scenarios

### Scenario: Evening routine

Given the operator turns off living room lights and sets thermostat to 18°C within 60s
And this happens at ~23:00 for 4 consecutive days
When the scene suggestion evaluator runs
Then a suggestion: "You have an evening routine in the Living Room (lights off + thermostat 18°C). Create a 'Living Room Goodnight' scene?"

## 6. Technical constraints

- Use existing Scenes module services for scene creation — import `ScenesModule`
- Multi-action sequence detection: group intents by `(spaceId, 60-second window)` then check for repeated groups
- Scene name generation: `{SpaceName} {TimeLabel}` (Morning/Afternoon/Evening/Night based on hour)

## 7. Implementation hints

- Group intents into "sessions" by space + 60-second windows
- Compare sessions by their intent types + target sets (order-independent)
- Use a hash of `(intentType, targetDeviceId)` tuples for session comparison
- Scene creation: build `CreateSceneDto` with actions from the detected pattern

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to backend only.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
