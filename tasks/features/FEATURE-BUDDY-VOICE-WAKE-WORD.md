# Task: Wake word detection on panel device

ID: FEATURE-BUDDY-VOICE-WAKE-WORD
Type: feature
Scope: panel
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to interact with the buddy without touching the panel,
As a home operator,
I want to say a wake word (e.g., "Hey panel") and have the buddy start listening for my command.

## 2. Context

- Depends on FEATURE-BUDDY-VOICE-STT (recording and transcription must work).
- Wake word detection runs continuously on the panel device using a lightweight local model.
- Options: Porcupine (Picovoice), Snowboy, or custom keyword spotting.
- Wake word detection must be battery/CPU efficient since the panel runs 24/7.

## 3. Scope

**In scope**

- Wake word detection engine integration in panel app
- Configurable wake word (default: "Hey panel")
- Detection → start recording → STT → buddy conversation flow
- Visual indicator when wake word is detected (screen wake + animation)
- Enable/disable wake word in panel settings
- Sensitivity configuration

**Out of scope**

- Custom wake word training
- Multi-wake-word support
- Server-side wake word detection

## 4. Acceptance criteria

- [x] Wake word engine runs in background on panel device
- [x] Detection triggers: screen wake (if dimmed) + recording start + visual indicator
- [x] After wake word: records audio until silence detected (VAD) or timeout (10s)
- [x] Recorded audio sent through existing STT → conversation pipeline
- [x] Wake word detection is toggleable in panel settings
- [x] CPU usage of wake word engine < 5% average
- [x] False positive rate < 1 per hour in quiet room

## 5. Example scenarios

### Scenario: Wake word conversation

Given the panel screen is dimmed (idle mode)
When the operator says "Hey panel, turn off the kitchen lights"
Then the wake word engine detects "Hey panel"
And the screen wakes up with a listening animation
And the audio "turn off the kitchen lights" is recorded
And sent through STT → buddy → intent execution

## 6. Technical constraints

- Wake word engine must run on ARM (panel hardware is typically ARM-based Linux)
- Use Picovoice Porcupine (has Flutter plugin) or similar lightweight engine
- Voice Activity Detection (VAD) for end-of-speech detection
- Must coexist with panel UI — don't block the main thread

## 7. Implementation hints

- **Porcupine Flutter**: `porcupine_flutter` package with built-in "Hey Pico" or custom keyword
- **VAD**: `silero_vad` or simple energy-based VAD for end-of-speech
- **Background listening**: Use Flutter platform channels if needed for background audio
- **Screen wake**: Use `wakelock` package + brightness control

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to panel only.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
