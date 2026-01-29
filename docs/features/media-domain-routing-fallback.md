# Task: Media Domain – Default Routings/Bindings Quality + Fallback Heuristics (Backend)

## Purpose

Improve the "out-of-the-box wow effect" by making default activity bindings and runtime targeting smarter,
without introducing roles or session-centric logic.

This PR focuses on:
- better default bindings generation
- smarter fallback selection for control targets (volume/input/remote/playback)
- safer conflict handling
- improved validation + diagnostics

No UI changes required (Admin/Panel will automatically benefit).

---

## Prerequisites

Existing features:
- [x] endpoints read model + API (MVP #1)
- [x] per-space bindings CRUD + apply-defaults (MVP #2)
- [x] activity activation + active state + WS events (MVP #3)

---

## Scope

### 1) Improve `apply-defaults` Binding Generator

#### Current problem
Simple "first endpoint wins" heuristics produce weak defaults, especially with:
- TV + AVR + Speaker + Streamer + Console
- TV with no volume
- Receiver with volume but no playback
- Multiple displays/audio outputs in one space

#### New heuristic goals
Create defaults that match typical home setups:

##### Activity: Watch
- Prefer `display` endpoints with:
  - inputSelect capability
  - remoteCommands capability
- Prefer `audio_output` endpoints with:
  - volume capability (AVR > TV speaker > speaker)
- Prefer `source` endpoints with:
  - "TV apps"/streamer-like capabilities if identifiable (optional)
- Remote:
  - prefer explicit `remote_target`, else fallback to display

##### Activity: Listen
- Prefer `audio_output` endpoints that also have:
  - playback capability OR track metadata capability
- If multiple audio outputs exist:
  - choose the one that appears "speaker-like" (capabilities: playback/track) over AVR-only
- Source:
  - pick a source endpoint with playback/track if audio_output lacks it
- Remote:
  - source remote_target if available, else audio_output/display

##### Activity: Gaming
- Display:
  - same as Watch
- Source:
  - prefer endpoints that can represent console/source (if present)
  - if not detectable, keep source slot empty but set `displayInputId` override if possible
- Audio:
  - AVR preferred if present
- Remote:
  - display remote_target preferred (TV)

##### Activity: Background
- Prefer audio_output that supports playback/track
- Lower default volume preset override (e.g. 20)

##### Activity: Off
- No binding required (keep empty)

#### Deliverable
- [x] Update generator logic
- [x] Add unit tests for a "media rig" space (TV+AVR+Speaker+Streamer+Console)
- [x] Ensure generator never overwrites existing bindings

---

### 2) Runtime Fallback Heuristics for Active Card Controls (Backend hints)

#### Problem
Even with bindings, some slots may be empty or endpoints missing capabilities, leading to weak UI controls.

#### Add derived "control targets" to Active state
Extend `MediaActivityResolvedModel` with a `controlTargets` object:
- `volumeTargetDeviceId`
- `inputTargetDeviceId`
- `playbackTargetDeviceId`
- `remoteTargetDeviceId`

Resolver computes these using fallback rules:
- volume target:
  1) binding.audio endpoint if volume
  2) binding.display endpoint if volume
  3) any audio_output endpoint in space with volume
- input target:
  1) binding.display endpoint if inputSelect
  2) any display endpoint with inputSelect
- playback target:
  1) binding.source if playback
  2) binding.audio if playback
  3) any endpoint with playback
- remote target:
  1) binding.remoteTarget if remote
  2) binding.display if remote
  3) any remote_target endpoint

These are *hints* for UI to reduce guesswork.

#### Deliverable
- [x] Compute and persist these targets in active state on activation
- [x] Include them in `GET active` response

---

### 3) Conflict Handling Improvements (Safer Defaults)

#### Current
Conflicts policy exists but is simplistic.

#### Add minimal safe behavior
When activating Watch/Gaming:
- if Background/Listen is currently active or any playback detected:
  - apply configured conflict policy:
    - pause other playback (best-effort)

Rules:
- never treat conflict steps as critical
- always record failures as warnings

#### Deliverable
- [x] Implement conflict scanning
- [x] Execute conflict steps after power/input steps

---

### 4) Diagnostics: Binding Validation Endpoint

Add:
- `GET /spaces/:spaceId/media/bindings/validate`

Returns a report per activityKey:
- missing slots
- endpointId not found
- slot type mismatch
- override invalid due to missing capability
- recommended fixes (optional)

#### Deliverable
- [x] Validation endpoint works and reports actionable issues

---

## Acceptance Criteria

### Functional
- [x] `apply-defaults` produces high-quality bindings for common media rigs
- [x] Active state includes computed control target hints (volume/input/playback/remote)
- [x] Conflict handling best-effort steps run and are reported as warnings
- [x] Bindings validate endpoint works and reports actionable issues

### Tests
- [x] Generator tests for: TV-only, Speaker-only, TV+AVR+Speaker+Streamer+Console (media rig)
- [x] Resolver tests for control target fallback selection
- [x] Conflict scanning tests (playing vs not playing)

---

## Non-Goals
- No multiroom/grouping
- No queue support
- No custom activities beyond MVP set
- No UI changes required in this PR
