# Task: Media Domain – Simulator "Media Rig" Scenarios + Regression Test Suite
ID: FEATURE-MEDIA-SIMULATOR-REGRESSION
Type: feature
Scope: backend
Size: large
Parent: FEATURE-SPACE-MEDIA-DOMAIN-V2
Status: in-progress

## 1. Business goal

In order to **confidently iterate on the Media domain** without regressions
As a **developer**
I want to have **deterministic simulator scenarios and a comprehensive regression test suite** covering endpoints, bindings, activation, failure model, and WS events.

## 2. Context

- Existing media domain code lives in `apps/backend/src/modules/spaces/` (services, entities, models, constants).
- Existing unit tests: `derived-media-endpoint.service.spec.ts`, `space-media-activity.service.spec.ts`, `space-media-activity-binding.service.spec.ts`.
- Simulator plugin at `apps/backend/src/plugins/devices-simulator/` defines YAML scenarios but has no media-specific templates.
- Prerequisites: Media endpoints API (MVP #1), Bindings CRUD + apply-defaults (MVP #2), Activation + executor + active state + WS events (MVP #3).

## 3. Scope

**In scope**
- Simulator media scenario templates as TypeScript test fixtures (not YAML, since these are unit-test-only)
- Test harness helpers for setting up space device topologies
- Regression tests covering: endpoint derivation, default bindings quality, activation behavior, failure model, WS events
- Short in-repo documentation page

**Out of scope**
- No new Media features
- No UI changes
- No queue support
- No multiroom/grouping
- No changes to the YAML simulator plugin itself

## 4. Acceptance criteria

- [ ] Templates generate deterministic device sets for 4 topologies: tv_only, speaker_only, tv_avr_console_streamer, multi_output
- [ ] Regression tests cover endpoints derivation (count, types, capabilities)
- [ ] Regression tests cover default bindings quality (slot assignments, preference heuristics)
- [ ] Regression tests cover activation behavior (plan execution, state transitions)
- [ ] Regression tests cover failure model (critical vs non-critical failures)
- [ ] Regression tests cover WS events (lifecycle event types and payload structure)
- [ ] Tests run in CI and are stable (no timing flakiness; use mocks)
- [ ] Adding a new scenario is straightforward (documented)

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: TV-only endpoint derivation
Given a space with a single TV device (power, inputSelect, remote, volume)
When endpoints are derived
Then there are 3 endpoints: DISPLAY, AUDIO_OUTPUT, REMOTE_TARGET

### Scenario: Full rig default bindings
Given a space with TV + AVR + Speaker + Streamer + Console
When apply-defaults is called
Then Watch.audio prefers AVR over TV speaker
And Listen.audio prefers speaker with playback capability
And Gaming.source prefers console

### Scenario: Non-critical failure keeps active state
Given a Watch activation where volume preset fails
When the plan executes
Then the state is ACTIVE with warnings

## 6. Technical constraints

- Follow existing test patterns from the 3 existing spec files
- Use Jest mocks (no real DB, no HTTP calls)
- Keep test fixtures co-located with tests
- Do not modify generated code

## 7. Implementation hints

- Reuse `buildSummary`, `buildEndpoint`, `buildBinding`, `capMapping` patterns from existing tests
- Create a shared fixtures file that all regression tests import
- Use `EventEmitter2` mock to assert WS events
- Use `PlatformRegistryService` mock to simulate critical/non-critical failures

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by replying with a short implementation plan (max 10 steps)
- Keep changes scoped to this task and its `Scope`
- For each acceptance criterion, either implement it or explain why it's skipped
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
