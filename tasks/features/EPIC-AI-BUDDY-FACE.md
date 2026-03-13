# Epic: AI Buddy Animated Face
ID: EPIC-AI-BUDDY-FACE
Type: feature
Scope: panel
Size: large
Parent: (none)
Status: planned
Created: 2026-03-13

## 1. Business goal

In order to give the AI buddy a visual personality and make smart panel interactions feel alive and engaging
As a smart panel user
I want to see an animated emoji face on the panel display that reacts in real-time to the buddy's state - showing emotions like thinking, listening, happy, speaking, and idle - similar to the ESP32 EchoEar device

## 2. Context

### What Already Exists

The smart panel already has a **comprehensive AI Buddy module** on the `main` branch that provides all backend and communication infrastructure:

| Component | Status | Details |
|-----------|--------|---------|
| Backend Buddy Module | **Done** | Full LLM orchestration, conversations, context building, suggestion engine |
| LLM Providers | **Done** | Claude, OpenAI, Ollama, OpenAI Codex |
| STT Providers | **Done** | OpenAI Whisper, Local Whisper, ElevenLabs |
| TTS Providers | **Done** | OpenAI TTS, ElevenLabs, System TTS, VoiceAI |
| Messaging Adapters | **Done** | Discord, Telegram, WhatsApp |
| Admin Configuration UI | **Done** | Full provider config, personality, thresholds |
| Panel Chat UI | **Done** | Chat page, message bubbles, suggestion cards |
| Panel Voice Services | **Done** | Recording, playback, voice activation with VAD |

### What's Missing - The Face

The **only missing piece** is a visual face/avatar on the panel display that gives the buddy a personality. This epic covers building that face widget and integrating it with the existing buddy services.

### Design Inspiration

| Project | What to Take | Link |
|---------|-------------|------|
| ESP32 EchoEar | Overall concept - animated face on display reacting to AI state | [Espressif Docs](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/echoear/) |
| esp32-eyes | Programmatic eye rendering with 18 emotions, blink/look systems | [GitHub](https://github.com/playfultechnology/esp32-eyes) |
| XiaoZhi AI | Emoji emotion protocol, LLM-driven emotion selection | [Emotion Docs](https://xiaozhi.dev/en/docs/development/emotion/) |

### Architecture

```
┌───────────────────────────────────────────────────────────┐
│                  PANEL APP (Flutter)                       │
│                                                            │
│   Existing Buddy Module              New Face Feature      │
│  ┌────────────────────┐          ┌────────────────────┐   │
│  │  BuddyService      │──────┐  │  AssistantFaceWidget│   │
│  │  (conversations,    │      │  │  (CustomPaint)      │   │
│  │   messages, errors) │      │  │                     │   │
│  └────────────────────┘      │  │  ┌───────────────┐  │   │
│  ┌────────────────────┐      ├──│  │ FacePainter   │  │   │
│  │  VoiceActivation   │──────┤  │  │ (eyes, mouth) │  │   │
│  │  Service            │      │  │  └───────────────┘  │   │
│  │  (listening,        │      │  │  ┌───────────────┐  │   │
│  │   recording)        │      │  │  │ BlinkController│  │   │
│  └────────────────────┘      │  │  │ LookController │  │   │
│  ┌────────────────────┐      │  │  └───────────────┘  │   │
│  │  AudioPlayback     │──────┤  └────────────────────┘   │
│  │  Service            │      │                            │
│  │  (isPlaying)        │      │  ┌────────────────────┐   │
│  └────────────────────┘      └─►│ BuddyEmotionMapper │   │
│                                  │ (state → emotion)  │   │
│                                  └────────────────────┘   │
└───────────────────────────────────────────────────────────┘
                          │
                     No changes needed
                          │
┌───────────────────────────────────────────────────────────┐
│                   BACKEND (NestJS)                         │
│            Existing Buddy Module - untouched               │
└───────────────────────────────────────────────────────────┘
```

### Emotion Mapping Strategy

No backend changes needed. Emotion is inferred from observable buddy service state:

```
VoiceActivation.listening    → 👂 Listening
VoiceActivation.recording    → 👂 Listening (pulsing)
VoiceActivation.processing   → 🤔 Thinking
BuddyService.isSendingMessage → 🤔 Thinking
New assistant message          → 😊 Happy (brief)
AudioPlayback.isPlaying       → 💬 Speaking
BuddyService.errorType       → 😔 Sorry (brief)
New suggestions               → 🤩 Excited (brief)
Inactivity 30s                → 😴 Sleepy
Inactivity 60s                → 😑 Idle (closed eyes, minimal)
Default                       → 😐 Neutral (blink + look)
```

## 3. Scope

**In scope**

- Animated emoji face widget with 14 emotions (CustomPaint, 60fps)
- Eye system with configurable parameters (height, slope, pupil, look direction)
- Automatic blinking and random eye movement
- Smooth interpolated transitions between all emotions
- `BuddyEmotionMapper` bridging buddy services → face emotions
- Face page/overlay for production use
- Demo page for testing all emotions standalone
- Tap-to-activate voice input from face

**Out of scope**

- Backend changes (buddy module already handles everything)
- Admin UI changes
- New API endpoints
- Voice/audio services (already exist)
- Chat UI (already exists)
- LLM-driven emotion selection (future enhancement)

## 4. Acceptance criteria

- [ ] Panel displays animated face with at least 14 visually distinct emotions
- [ ] Face reacts to buddy state in real-time via BuddyEmotionMapper
- [ ] Eyes blink randomly (2-6s interval, ~150ms duration)
- [ ] Eyes wander subtly in idle state
- [ ] Smooth transitions between emotions (300-500ms)
- [ ] Speaking animation while TTS plays
- [ ] Sleepy/idle after inactivity
- [ ] 60fps on Raspberry Pi 4
- [ ] Tap face to activate voice input
- [ ] Demo page with manual emotion controls

## 5. Child Tasks

| ID | Task | Size | Priority | Status |
|----|------|------|----------|--------|
| FEATURE-AI-ASSISTANT-PANEL-FACE-MVP | Face widget + buddy integration | medium | **1 - Start here** | planned |
| FEATURE-AI-ASSISTANT-PANEL-FACE | Extended features & customization | small | 2 - After MVP | planned |

### Implementation Phases

```
Phase 1: MVP (FEATURE-AI-ASSISTANT-PANEL-FACE-MVP)
├── Step 1: Eye rendering with EyeConfig parameters
├── Step 2: Mouth rendering with MouthConfig parameters
├── Step 3: All 12 emotion presets (static)
├── Step 4: Smooth interpolated transitions
├── Step 5: BlinkController (random blinking)
├── Step 6: LookController (eye wandering)
├── Step 7: Demo page (test all emotions)
├── Step 8: BuddyEmotionMapper (connect to buddy services)
├── Step 9: Face page with buddy integration
└── Step 10: Performance testing on RPi

Phase 2: Extensions (FEATURE-AI-ASSISTANT-PANEL-FACE)
├── Additional emotion presets (18+ total)
├── Face as dashboard tile
├── Appearance customization
├── Text bubble overlay
└── Reduced motion accessibility
```

## 6. Technical constraints

- **Panel only** - zero backend or admin changes
- Use existing buddy module services via Provider/get_it
- Use `CustomPainter` for all face rendering (no images/SVGs)
- Follow existing buddy module patterns (see `voice_activation_indicator.dart`)
- No new Flutter dependencies required
- Target 60fps on Raspberry Pi 4

## 7. Implementation hints

- Study `apps/panel/lib/modules/buddy/services/voice_activation_service.dart` for state observation
- Study `apps/panel/lib/modules/buddy/presentation/widgets/voice_activation_indicator.dart` for widget integration
- Use `ChangeNotifier` + `ListenableBuilder` for reactive face updates
- Use `RepaintBoundary` around face widget for paint isolation
- Multiple `AnimationController`s for independent blink/look/transition animations

## 8. AI instructions (for Junie / AI)

- Read the existing buddy module on `main` branch before any code changes
- Do NOT create backend code or modify existing buddy module files
- The face widget is purely additive to the panel app
- Start with FEATURE-AI-ASSISTANT-PANEL-FACE-MVP
- Test animations on target hardware (RPi 4/5) if possible
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
