# Task: Add silent recommendations (Suggestions) to Space pages (one-tap, non-intrusive)
ID: FEATURE-SPACE-SUGGESTIONS-MVP
Type: feature
Scope: backend, panel, admin
Size: medium
Parent: EPIC-SPACES-FIRST-UX
Status: done

## 1. Business goal

In order to create a “smart” experience without being annoying,
As a wall panel user,
I want to see a non-intrusive, one-tap suggestion (e.g., “Evening lighting”) when I wake the panel or open a Space page.

## 2. Context

- SpacePage exists with lighting intents.
- Users dislike pushy assistants; suggestions should be “pull-based” and appear only on user interaction.
- We already have deterministic intents and the system knows current space context.

Constraints:
- Suggestions must never block interaction.
- Suggestions must be safe, deterministic, and easy to dismiss.
- Default behavior should be conservative (max 1 suggestion).

## 3. Scope

**In scope**

Backend:
- Implement a `SpaceSuggestionService` that generates up to 1 suggestion for a given space/context.
- Suggestions are rule-based (no LLM):
  - Example rules (MVP):
    - If time is after 17:00 and lights are in Work mode / high brightness -> suggest Relax mode
    - If time is after 22:00 in bedroom and any lights are on -> suggest Night mode or Lights Off
- Expose an endpoint to fetch suggestion for a space:
  - `GET /spaces/:id/suggestion` (or equivalent)
- Track suggestion feedback events (minimal):
  - dismissed
  - applied
  - (optional) “don’t suggest again” per space rule

Admin:
- Add toggles:
  - enable/disable suggestions per display or per space (choose one; document it)
  - optional quiet hours configuration (simple start/end time)

Panel:
- Show suggestion as a small banner/card in SpacePage header area:
  - title + optional short reason
  - [Apply] [Dismiss]
  - after Apply: show toast with [Undo] (optional but recommended)
- Fetch suggestions only when:
  - SpacePage becomes visible
  - or panel wakes (if that event exists)

**Out of scope**

- Personalization/learning beyond simple counters.
- Multiple simultaneous suggestions.
- Any “assistant speaks first” behavior.

## 4. Acceptance criteria

- [x] Panel shows at most one suggestion on SpacePage visibility/wake.
- [x] Suggestion can be applied with one tap and triggers an intent safely.
- [x] Suggestion can be dismissed and does not reappear immediately (cooldown).
- [x] Suggestions can be disabled via Admin setting.
- [x] Backend rules are deterministic and covered by unit tests.
- [x] System remains usable with suggestions disabled (no dependencies).

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Evening lighting suggestion

Given Space "Living room" is opened at 18:00  
And lights are currently in a bright/work-like state  
When the SpacePage loads  
Then a banner suggests "Relax lighting"  
And tapping Apply triggers the Relax lighting intent

## 6. Technical constraints

- Follow existing module / service structure in backend/admin/panel.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Keep rule evaluation side-effect free; track feedback via separate endpoint.
- Add a simple cooldown (e.g., 30–60 minutes) stored per space/rule to avoid annoyance.
- If you already store “last applied lighting mode”, reuse it; otherwise infer from device state as best effort.

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
