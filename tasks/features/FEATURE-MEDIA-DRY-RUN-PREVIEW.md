# Task: Media Domain – Dry-Run Execution Plan Preview
ID: FEATURE-MEDIA-DRY-RUN-PREVIEW
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: (none)
Status: in-progress

## 1. Business goal

In order to **debug and validate media activity bindings without changing device state**
As a **developer or admin**
I want to **preview the exact execution plan before activating a media activity**

## 2. Context

- Backend activation resolver + executor already exist in `SpaceMediaActivityService`
- Admin UI has a "Test Activity" screen with Run / Deactivate buttons
- Panel has media domain UI with activity buttons
- The existing `buildExecutionPlan()` method produces the plan deterministically
- This feature reuses the resolver without calling the executor

## 3. Scope

**In scope**

- Backend: `dryRun=true` query parameter on the activate endpoint
- Backend: Return execution plan with step labels, criticality, skip warnings
- Backend: No side effects (no state changes, no WS events, no executor)
- Admin: Preview button next to Run for each activity
- Admin: Preview modal showing resolved devices, ordered steps, warnings
- Panel: Preview via repository + service (optional UI)

**Out of scope**

- Plan editing in UI
- Simulation of device responses
- Queue/multiroom preview

## 4. Acceptance criteria

- [ ] `dryRun=true` never triggers executor
- [ ] No state changes or WS events occur during dry-run
- [ ] Returned plan matches real activation plan 1:1
- [ ] Plan includes readable labels and skip warnings
- [ ] Admin Preview button works for all activities
- [ ] Admin modal shows plan, resolved devices, warnings
- [ ] Preview does not affect active state
- [ ] Preview is fast (<200ms typical)
- [ ] No duplication of resolver logic

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Dry-run returns execution plan without side effects

Given a space with a "watch" binding configured
When I call `POST /spaces/:id/media/activities/watch/activate?dryRun=true`
Then I receive the execution plan with steps, resolved devices, and warnings
And no device state is changed
And no WebSocket events are emitted

### Scenario: Admin previews activity

Given a space with media bindings
When I click the Preview button on the "watch" activity
Then a modal shows the execution plan steps
And I see resolved devices (TV, AVR, Streamer)
And I see any warnings for missing capabilities

## 6. Technical constraints

- Reuse existing `buildExecutionPlan()` — no duplication of resolver logic
- Follow existing module/service structure in `apps/backend/src/modules/spaces/`
- Follow API conventions from `.ai-rules/API_CONVENTIONS.md`
- Do not modify generated code

## 7. Implementation hints (optional)

- Add `dryRun` boolean parameter to `activate()` in `SpaceMediaActivityService`
- When `dryRun=true`: resolve binding, build plan, compute warnings, return immediately
- Add `MediaActivityDryRunPreviewModel` response model with plan + warnings
- Admin: add `preview()` method to `useSpaceMedia` composable
- Panel: add `previewActivity()` to `MediaActivityRepository`

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
