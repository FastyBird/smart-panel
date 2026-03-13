# Task: AI Assistant with Emoji Face Display
ID: FEATURE-AI-ASSISTANT
Type: feature
Scope: panel
Size: medium
Parent: (none)
Status: planned

## 1. Business goal

In order to provide a friendly, interactive visual personality for the AI buddy
As a smart panel user
I want to see an animated emoji face that reacts to buddy state - thinking when processing, happy when responding, listening when voice is active, and idle when waiting

## 2. Context

### Existing Infrastructure (Already Implemented on `main`)

The smart panel project already has a comprehensive **AI Buddy module** on the `main` branch:

| Component | Status | Details |
|-----------|--------|---------|
| Backend Buddy Module | **Done** | Full LLM orchestration, conversations, context building |
| LLM Providers | **Done** | Claude, OpenAI, Ollama, OpenAI Codex |
| STT Providers | **Done** | OpenAI Whisper, Local Whisper, ElevenLabs |
| TTS Providers | **Done** | OpenAI TTS, ElevenLabs, System TTS, VoiceAI |
| Messaging Adapters | **Done** | Discord, Telegram, WhatsApp |
| Admin Configuration UI | **Done** | Full provider config, personality, thresholds |
| Panel Chat UI | **Done** | Chat page, message bubbles, suggestions |
| Panel Voice Services | **Done** | Recording, playback, voice activation |
| Suggestion Engine | **Done** | Anomaly detection, energy, conflicts, patterns |
| **Panel Face Widget** | **Not Done** | **This is what we're building** |

### What's Missing

The only gap is a **visual face/avatar** that gives the buddy a personality on the panel display. The face widget is a purely frontend addition that observes existing buddy services.

### Design Inspiration

- ESP32 EchoEar (https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/echoear/)
- esp32-eyes (https://github.com/playfultechnology/esp32-eyes) - 18 emotions, programmatic rendering
- XiaoZhi AI Emotion Display (https://xiaozhi.dev/en/docs/development/emotion/)

## 3. Scope

**In scope**

- Animated emoji face widget (eyes, mouth) with 12+ emotional states
- Smooth transitions, random blinking, eye wandering
- Reactive to buddy state (listening, thinking, speaking, error, idle)
- Integration with existing `BuddyService`, `VoiceActivationService`, `AudioPlaybackService`
- Demo page for testing all emotions standalone
- Face page/overlay for production use

**Out of scope**

- Backend changes (buddy module already handles everything)
- New API endpoints
- Admin UI changes
- Voice recording/playback (already exists)
- Chat UI (already exists)

## 4. Acceptance criteria

- [ ] Panel displays animated emoji face with at least 12 emotional states
- [ ] Face reacts to buddy module state in real-time
- [ ] Face shows listening state during voice activation
- [ ] Face shows thinking state while processing messages
- [ ] Face shows speaking state during TTS playback
- [ ] Face shows error expression on failures
- [ ] Face transitions to sleepy/idle after inactivity
- [ ] Smooth 60fps animations on Raspberry Pi 4
- [ ] Tapping face activates voice input
- [ ] Demo mode for testing all emotions

## 5. Example scenarios

### Scenario: Complete voice interaction

Given the face is in idle state
When the user activates voice input
Then face shows listening → thinking → happy → speaking → neutral
And each transition is smooth and natural

### Scenario: Inactivity

Given no buddy interaction for 30+ seconds
Then face gradually becomes sleepy → idle
When user interacts again, face immediately wakes

## 6. Technical constraints

- **Panel only** - no backend or admin changes
- Use existing buddy module services via Provider/get_it
- Use `CustomPainter` for all face rendering (no images)
- Follow existing widget patterns from buddy module
- No new Flutter dependencies required

## 7. Implementation hints

- Study `voice_activation_indicator.dart` for how to observe buddy services
- Use `BuddyEmotionMapper` pattern to map buddy state → face emotion
- Emotion is inferred from observable state, not from backend
- Follow `ChangeNotifier` pattern used throughout panel app

## 8. AI instructions (for Junie / AI)

- Read existing buddy module files before writing code
- Do NOT create backend code or modify existing buddy module
- The face widget is additive - no changes to existing files except route registration
- Start with standalone face widget, then add buddy integration

## 9. Child Tasks

| Task ID | Description | Size | Priority |
|---------|-------------|------|----------|
| **FEATURE-AI-ASSISTANT-PANEL-FACE-MVP** | **Face widget with buddy integration** | **medium** | **1 - Start here** |
| FEATURE-AI-ASSISTANT-PANEL-FACE | Extended face features, customization | small | 2 - After MVP |

### Implementation Order

```
1. FEATURE-AI-ASSISTANT-PANEL-FACE-MVP  ← Start and focus here
   │  - Standalone face rendering
   │  - 12 emotion presets
   │  - Blink + look controllers
   │  - BuddyEmotionMapper integration
   │  - Demo page
   │
2. FEATURE-AI-ASSISTANT-PANEL-FACE      ← Future enhancements
   │  - Face customization (style, colors)
   │  - Additional emotion presets
   │  - Face as dashboard tile
   │  - Configurable behavior in admin
```
