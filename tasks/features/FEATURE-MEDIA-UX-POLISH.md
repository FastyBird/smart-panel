# Task: Media Domain – UX Polish (Offline/WS Strict Mode + Error/Warning Surfacing + Consistent States)
ID: FEATURE-MEDIA-UX-POLISH
Type: feature
Scope: backend, admin, panel
Size: large
Parent: FEATURE-SPACE-MEDIA-DOMAIN-V2
Status: in-progress

## 1. Business goal

In order to provide a reliable and user-friendly media control experience
As a Smart Panel user (panel) or admin (admin app)
I want clear state feedback, warning/error surfacing, and predictable offline behavior for media activities

## 2. Context

- Media activity activation already supports critical vs non-critical steps (`space-media-activity.service.ts`)
- Active state entity persists `lastResult` JSON with step failure details
- Panel app has `MediaActivityService` with activation/deactivation support
- Admin app has `space-media-activities.vue` with active state panel and failure display
- WebSocket events already broadcast activation lifecycle events
- Panel socket service (`core/services/socket.dart`) tracks connection state

## 3. Scope

**In scope**

- Backend: Standardize failure payload with `warnings[]` and `errors[]` (structured failure items)
- Backend: Separate critical (errors) vs non-critical (warnings) in `lastResult` and activation response
- Backend: Add `requiresRealtime` flag to media activity response
- Backend: Ensure deactivation always succeeds (best-effort stop steps)
- Panel: Blocking overlay when WS disconnected for media controls
- Panel: Explicit visual states for activating/active/active-with-warnings/failed
- Panel: Failure details bottom sheet with retry/deactivate actions
- Admin: Display warnings vs errors split in status panel
- Admin: Copy debug JSON includes structured failure data
- Unit test for failure categorization logic

**Out of scope**

- No new Media functionality (queue/grouping/multiroom)
- No changes to bindings schema beyond failure payload fields
- No new device capability extraction rules

## 4. Acceptance criteria

- [x] Activation response and Active state include standardized `warnings[]` and `errors[]`
- [x] `failed` state only when critical steps fail
- [x] Deactivate always results in `deactivated` state
- [x] WS/offline policy is explicit (`requiresRealtime` flag)
- [ ] Panel: WS disconnected → blocking overlay appears reliably
- [x] Panel: Activating/active/failed states are clearly visible (step progress UI in feat/panel-media-activation-preview-steps)
- [ ] Panel: Warnings vs errors are distinguishable
- [ ] Panel: Failure details modal shows actionable info + retry/deactivate
- [x] Admin: Mirrors the same warning/error split
- [x] Admin: Provides copy-debug and clear lifecycle feedback
- [x] Unit test for failure categorization (warnings vs errors)

## 5. Example scenarios

### Scenario: Activation with non-critical volume failure

Given a Watch activity with display + audio endpoints
When activation powers on display (success) and sets volume (fails)
Then state = `active`, `warnings[]` contains volume step failure, `errors[]` is empty

### Scenario: Activation with critical power failure

Given a Watch activity with display endpoint
When activation fails to power on the display
Then state = `failed`, `errors[]` contains power step failure

### Scenario: WS disconnected on panel

Given the panel media domain view is open
When the WebSocket connection drops
Then a blocking overlay appears preventing media controls
And the user can retry connection or navigate away

## 6. Technical constraints

- Follow existing module/service structure in `apps/backend/src/modules/spaces/`
- Do not modify generated code (openapi.json, spec files)
- Maintain backward compatibility with existing `lastResult` shape (add fields, don't remove)
- Tests expected for new failure categorization logic

## 7. Implementation hints

- Extend `MediaActivityStepFailureModel` with `critical`, `kind`, `label`, `timestamp` fields
- Add `MediaActivityFailureItemModel` for structured warnings/errors
- Add `warnings[]` and `errors[]` to `MediaActivityLastResultModel`
- Panel overlay can wrap media domain view and listen to socket connection state
- Admin already has failure display; extend to show warning vs error badges

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
