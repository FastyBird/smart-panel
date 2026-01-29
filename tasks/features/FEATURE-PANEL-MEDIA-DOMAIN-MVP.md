# Task: Panel App – Media Domain MVP (Portrait UI: Activity Selector + Active Card + Devices + Detail)
ID: FEATURE-PANEL-MEDIA-DOMAIN-MVP
Type: feature
Scope: panel
Size: large
Parent: FEATURE-SPACE-MEDIA-DOMAIN-V2
Status: in-progress

## 1. Business goal

In order to deliver the end-user Media experience on the smart panel
As a panel user
I want to see and control media activities (Watch, Listen, Gaming, Background, Off) for a space, with live status, capability-driven controls, and device detail pages

## 2. Context

- Backend MVP #1–#3 already implemented: media endpoints, bindings, activity activation, active state, and WS events
- Backend APIs:
  - `GET /spaces/:spaceId/media/endpoints`
  - `GET /spaces/:spaceId/media/bindings`
  - `GET /spaces/:spaceId/media/activities/active`
  - `POST /spaces/:spaceId/media/activities/:activityKey/activate`
  - `POST /spaces/:spaceId/media/activities/deactivate`
- WS events: `media.activity.activating`, `media.activity.activated`, `media.activity.failed`, `media.activity.deactivated`
- Existing panel code: `modules/spaces/` has media targets, state, and intents; `modules/deck/presentation/domain_pages/media_domain_view.dart` has the old mode-based UI; `mocks/media_domain.dart` has UI component prototypes
- Pattern: Provider + ChangeNotifier + GetIt locator; repositories make API calls via Dio

## 3. Scope

**In scope**

- Activity selector (Watch/Listen/Gaming/Background/Off) with live state
- Active activity card with capability-driven controls (volume, input, playback, track, remote)
- Devices list derived from endpoints grouped by deviceId
- Device detail pages with capability-driven controls
- Media activity service/repository with Dio-based API calls
- WS event handling for live activity state updates
- Strict offline overlay when WS disconnected
- Failure/partial-success UX

**Out of scope**

- Queue UI
- Custom activity creation
- Landscape layout
- Advanced fallback heuristics beyond backend data
- Generated API client updates (uses Dio directly until next openapi regen)

## 4. Acceptance criteria

- [ ] Activity selector activates and deactivates activities
- [ ] Active card updates live based on WS events
- [ ] Controls appear only when capabilities exist
- [ ] Device list renders devices derived from endpoints
- [ ] Device detail works and sends commands to backend
- [ ] "Wow flow": one tap on activity changes the active card and immediately offers relevant controls
- [ ] No confusing "device switcher only" feeling
- [ ] Errors and partial failures are visible and actionable
- [ ] Unit tests for derived helpers (resolve control targets)

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Activate Watch activity

Given the user is on the media domain page for Living Room
When the user taps "Watch"
Then the activity selector highlights "Watch"
And the active card shows "Activating..." state
And when the backend confirms, the active card shows "Active" with display/audio/source controls

### Scenario: WebSocket disconnected

Given the WebSocket connection drops
When the user views the media domain page
Then a blocking overlay shows "Realtime connection required for Media controls"

## 6. Technical constraints

- Follow existing module/service structure in `modules/spaces/`
- Use Dio directly for new media activity endpoints (generated client not yet updated)
- Do not modify generated code
- Tests expected for new logic
- Use Provider + ChangeNotifier pattern consistent with rest of app

## 7. Implementation hints

- Extend `SpacesModuleService` and `SpacesService` to include media activity repository
- Add new models under `modules/spaces/models/media_activity/`
- Add new repository `modules/spaces/repositories/media_activity.dart`
- Replace the existing `media_domain_view.dart` with the new activity-first UI
- Add WS event constants to `modules/spaces/constants.dart`
- Register new providers in `app.dart` and locator in `startup_manager.dart`

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
