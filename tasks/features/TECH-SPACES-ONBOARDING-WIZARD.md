# Task: Spaces onboarding and assignment wizard (minimize configuration)
ID: TECH-SPACES-ONBOARDING-WIZARD
Type: technical
Scope: admin, backend
Size: medium
Parent: FEATURE-SPACES-MODULE
Status: done

## 1. Business goal

In order to minimize configuration effort for new installations,
As an administrator,
I want a guided wizard that creates Spaces and assigns Devices/Displays with strong defaults and heuristics.

## 2. Context

- Spaces module exists and Devices/Displays can be linked to a Space.
- Integrations/plugins can discover devices and provide metadata (e.g., Home Assistant areas, Shelly naming conventions).
- Users dislike manual dashboard design and device-by-device assignment.

Constraints:
- Must work without Home Assistant (no reliance on HA-only data).
- Should use heuristics but always allow manual override.

## 3. Scope

**In scope**

Admin UI:
- Add an onboarding wizard accessible from:
  - initial setup flow (if exists) or a “Tools” section
- Steps:
  1) Create/confirm Spaces (import if available, otherwise propose based on device names)
  2) Assign Displays to Spaces
  3) Assign Devices to Spaces (bulk)
  4) Summary + next recommended actions (e.g., “Create Space pages”)

Backend:
- Add endpoints to support wizard operations:
  - propose spaces from known device names (optional)
  - bulk assign devices/displays to spaces
  - optionally import areas from integrations if available (e.g., HA plugin)

**Out of scope**

- Creating Space pages automatically (handled by separate dashboard task).
- Fine-grained device role assignment (main/ambient/task) beyond basic space assignment.

## 4. Acceptance criteria

- [x] Wizard can create Spaces and persist them via backend.
- [x] Wizard supports bulk assignment of devices to spaces.
- [x] Wizard supports assignment of each display to exactly one space.
- [x] Wizard includes a "review" step showing:
  - [x] spaces
  - [x] #devices per space
  - [x] #displays per space
- [x] Wizard can be completed without any external integrations (works on a clean install).
- [x] Backend has tests for bulk assignment endpoints and proposal logic (if implemented).

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Wizard proposes spaces based on device names

Given the system has devices named "Living Room Ceiling Light" and "Bedroom Thermostat"  
When the admin opens the Spaces wizard  
Then the wizard proposes Spaces "Living Room" and "Bedroom"  
And the admin can accept or edit the proposals before saving

## 6. Technical constraints

- Follow existing module / service structure in the Admin app.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.

## 7. Implementation hints (optional)

- Keep heuristics simple:
  - match common room tokens from device names
  - allow locale-specific tokens later
- Make proposals optional; always allow manual creation.
- Prefer idempotent bulk assignment endpoints (safe to retry).

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
