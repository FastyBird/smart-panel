# Task: Media Domain – Admin UI MVP #2 (Test Activity: Activate/Deactivate + Live Status + Failure Details)
ID: FEATURE-MEDIA-ADMIN-UI-MVP-2
Type: feature
Scope: admin
Size: large
Parent: FEATURE-MEDIA-ADMIN-UI-MVP-1
Status: in-progress

## 1. Business goal

In order to verify media activity configuration end-to-end without leaving Admin
As an admin
I want to activate/deactivate media activities, see live status, and inspect failure details

## 2. Context

- Backend APIs exist: activate, deactivate, get active state
- Admin UI MVP #1 already provides endpoints diagnostics and activity bindings editor
- Media domain V2 uses routing-based architecture with derived endpoints
- Admin app uses Element Plus, Pinia-like composables, openapi-fetch, Vue 3 Composition API
- WS events may not be ready; polling fallback is acceptable for MVP

## 3. Scope

**In scope**

- Run (Activate) button per activity in the activities list
- Global Deactivate button
- Active State Panel showing current activity, state, resolved devices, timestamps
- Failure Details UI with step-level failure information
- Copy debug JSON to clipboard
- Polling fallback for status refresh
- Composable extensions for activate/deactivate/fetchActiveState
- Store and component tests

**Out of scope**

- WebSocket event subscription (follow-up)
- Custom activity creation
- YAML editing
- Dry-run plan preview

## 4. Acceptance criteria

- [ ] Admin can activate each activityKey via Run button
- [ ] Admin can deactivate via global Deactivate button
- [ ] UI shows current active activity and resolved device composition
- [ ] UI shows failures with actionable details (step index, device, reason)
- [ ] Polling fallback refreshes status after activate/deactivate
- [ ] Clear feedback during activation (loading state, disabled duplicate clicks)
- [ ] Failures never disappear silently
- [ ] "Copy debug JSON" available for support/reporting
- [ ] Store tests for activate/deactivate flows (mock API)
- [ ] Component test for rendering failed state and failures list

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Admin activates a media activity

Given a space has configured activity bindings
When the admin clicks "Run" on the "watch" activity
Then the UI shows "Activating..." state
And after completion shows "Active" with resolved device names

### Scenario: Admin sees failure details

Given an activation resulted in partial failures
When the admin views the active state panel
Then a Failures section shows each failed step with device, reason, and step index
And a "Copy debug JSON" button is available

### Scenario: Admin deactivates media

Given an activity is currently active
When the admin clicks "Deactivate"
Then the active state resets to "None" / "Deactivated"

## 6. Technical constraints

- Follow existing spaces module composable patterns
- Use openapi-fetch typed client for API calls
- Use Element Plus components consistently
- Do not modify generated OpenAPI files
- Polling: fetch active state immediately after action, then 2-3 polls with short delay

## 7. Implementation hints

- Extend `useSpaceMedia` composable with `activeState`, `fetchActiveState()`, `activate()`, `deactivate()`
- API paths: `GET .../media/activities/active`, `POST .../media/activities/:activityKey/activate`, `POST .../media/activities/deactivate`
- Active state response has `resolved` and `last_result` as JSON strings - parse them client-side
- Activation response model has `activity_key`, `state`, `resolved`, `summary`, `warnings`
- Resolve device IDs to names using existing endpoints data

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
