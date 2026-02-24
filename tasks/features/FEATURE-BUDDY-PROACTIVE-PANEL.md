# Task: Panel UI for proactive suggestion notifications

ID: FEATURE-BUDDY-PROACTIVE-PANEL
Type: feature
Scope: panel
Size: small
Parent: EPIC-BUDDY-MODULE
Status: planned

## 1. Business goal

In order to see proactive suggestions without opening the buddy chat,
As a home operator,
I want suggestion notifications to appear as toast/banner overlays on the panel when the buddy has a recommendation.

## 2. Context

- Depends on Phase 2 backend tasks and FEATURE-BUDDY-PANEL-MODULE.
- Extends the existing buddy panel module with notification overlay support.
- Suggestion cards in Phase 1 are inside the buddy drawer. Phase 2 adds external notifications that appear over the deck UI.

## 3. Scope

**In scope**

- Toast/banner notification overlay for new suggestions
- Auto-dismiss after configurable timeout (default 15s)
- Tap notification to open buddy drawer with the suggestion focused
- Notification priority: conflicts and anomalies appear with more prominence than general tips
- Maximum 1 notification visible at a time (queue additional ones)

**Out of scope**

- Sound notifications (→ Phase 3 voice)
- Persistent notification badge on deck pages

## 4. Acceptance criteria

- [ ] When `BuddyModule.Suggestion.Created` WebSocket event arrives, a toast notification appears on the panel
- [ ] Toast shows suggestion title and a brief reason
- [ ] Toast auto-dismisses after 15 seconds (configurable)
- [ ] Tapping the toast opens the buddy drawer
- [ ] Swiping the toast dismisses it and sends `dismissed` feedback
- [ ] Only 1 toast visible at a time; additional suggestions queue
- [ ] Conflict/anomaly suggestions have a warning-colored border; general tips have neutral styling

## 5. Example scenarios

### Scenario: Proactive notification

Given the buddy detects heating + open window conflict
When a `BuddyModule.Suggestion.Created` event arrives
Then a warning-styled toast appears: "Living room window is open but heating is active"
When the user taps it
Then the buddy drawer opens showing the full suggestion with accept/dismiss buttons

## 6. Technical constraints

- Overlay must not interfere with touch targets of the underlying deck UI
- Use existing panel overlay/toast patterns if available
- Keep notification lightweight (no complex animations)

## 7. Implementation hints

- Use Flutter `OverlayEntry` or `ScaffoldMessenger` for toast display
- Queue management: simple `List<Suggestion>` with first-in-first-out processing
- Timer for auto-dismiss: `Future.delayed(Duration(seconds: 15))`

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to panel only.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
