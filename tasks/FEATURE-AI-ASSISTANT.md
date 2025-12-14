# Task: AI Assistant with Emoji Face Display
ID: FEATURE-AI-ASSISTANT
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to provide a friendly, interactive voice-controlled assistant for smart home management
As a smart panel user
I want to have an AI assistant with an animated emoji face that can respond to voice commands, control devices, provide information (weather, time, etc.), and give visual feedback through expressive animations

## 2. Context

- Inspired by ESP32 EchoEar (https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/echoear/)
- XiaoZhi AI emotion system for emoji animations (https://xiaozhi.dev/en/docs/development/emotion/)
- Existing audio hardware support in panel app (`audio_settings.dart`)
- Existing WebSocket real-time communication infrastructure
- Existing device control services and weather module
- Target devices: Raspberry Pi 4/5, Radxa, and similar SBCs with displays

### Key Design Decisions

1. **Multi-Hybrid Architecture**: Users can independently configure each service (LLM, STT, TTS, Wake Word) to use either local or cloud providers
2. **Local-First Option**: Support fully offline operation with Ollama, Whisper.cpp, Piper TTS
3. **Cloud Options**: Support OpenAI, Anthropic, Google, ElevenLabs for users who prefer quality/convenience
4. **Backend-Centric Processing**: Main "brain" runs on backend, panel handles UI/audio I/O

## 3. Scope

**In scope**

- Animated emoji face widget (eyes, mouth) with emotional states
- Voice input/output (STT/TTS) with configurable providers
- Wake word detection for hands-free activation
- LLM integration for natural language understanding
- Device control through natural language commands
- Weather, time, date queries
- Conversation context management
- Admin UI for service configuration
- Multi-provider support (local and cloud options)

**Out of scope**

- Music/media playback integration (future enhancement)
- Calendar/reminder integration (future enhancement)
- Multi-room/multi-panel synchronization (future enhancement)
- Custom wake word training (use pre-built options)
- Video/camera integration

## 4. Acceptance criteria

- [ ] Panel displays animated emoji face with at least 6 emotional states
- [ ] Users can activate assistant via wake word or touch
- [ ] Voice commands are transcribed and processed by backend
- [ ] Assistant can control connected devices via natural language
- [ ] Assistant can provide weather information
- [ ] Assistant can tell time and date
- [ ] Responses are spoken via TTS and shown visually
- [ ] Admin UI allows configuration of all service providers
- [ ] Each service (LLM, STT, TTS, Wake Word) can be independently configured
- [ ] System works with fully local providers (offline capable)
- [ ] System works with cloud providers (OpenAI, etc.)

## 5. Example scenarios

### Scenario: Voice-activated device control

Given the assistant is in idle state (sleeping face)
When the user says "Hey Panel, turn off the kitchen lights"
Then the face shows listening animation
And the speech is transcribed to text
And the backend processes the intent
And the kitchen lights device is turned off
And the face shows happy emotion
And the assistant says "I've turned off the kitchen lights"

### Scenario: Weather query

Given the assistant is active
When the user asks "What's the weather like today?"
Then the face shows thinking animation
And the backend queries the weather service
And the face shows happy emotion
And the assistant speaks the current weather conditions

### Scenario: Hybrid provider usage

Given LLM is configured to use Ollama (local)
And STT is configured to use OpenAI Whisper (cloud)
And TTS is configured to use Piper (local)
When the user speaks a command
Then STT processes audio via OpenAI API
And LLM processes text via local Ollama
And TTS generates speech via local Piper

## 6. Technical constraints

- Follow existing NestJS module patterns for backend (see `weather.service.ts`, plugin structure)
- Follow existing Flutter patterns for panel (Provider, Repository pattern)
- Follow existing Vue 3 patterns for admin (Pinia stores, Element Plus components)
- Use existing WebSocket infrastructure for real-time communication
- Use existing configuration module patterns for settings persistence
- Minimize new dependencies - prefer established, maintained packages
- Tests expected for backend services and critical panel logic
- Support i18n for all user-facing strings

## 7. Implementation hints

- **Backend**: Look at `src/modules/weather/` for service pattern, `src/plugins/` for provider pattern
- **Panel**: Look at `lib/core/widgets/flip_clock.dart` for animation patterns, `lib/features/settings/` for new pages
- **Admin**: Look at `src/modules/weather/` for settings UI pattern
- **WebSocket**: Extend existing event types in `websocket.constants.ts`
- Use Strategy pattern for swappable providers
- Use Factory pattern for provider instantiation based on config

## 8. AI instructions (for Junie / AI)

- Read this file and all child task files before implementation
- Start with backend module skeleton (FEATURE-AI-ASSISTANT-BACKEND)
- Then implement panel face widget (FEATURE-AI-ASSISTANT-PANEL-FACE)
- Implement incrementally: text-only first, then add voice
- Keep provider implementations separate and pluggable
- Test each component independently before integration
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`

## 9. Child Tasks

| Task ID | Description | Size |
|---------|-------------|------|
| FEATURE-AI-ASSISTANT-BACKEND | Backend assistant module and service infrastructure | medium |
| FEATURE-AI-ASSISTANT-PANEL-FACE | Flutter emoji face widget with animations | medium |
| FEATURE-AI-ASSISTANT-PANEL-VOICE | Flutter voice recording and playback | medium |
| FEATURE-AI-ASSISTANT-ADMIN | Admin configuration UI for assistant settings | small |
| FEATURE-AI-ASSISTANT-LLM-PROVIDERS | LLM provider implementations (Ollama, OpenAI, etc.) | medium |
| FEATURE-AI-ASSISTANT-VOICE-PROVIDERS | STT and TTS provider implementations | medium |

## 10. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADMIN APP                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Assistant Configuration UI                  │    │
│  │  - LLM Provider Selection & Config                      │    │
│  │  - STT Provider Selection & Config                      │    │
│  │  - TTS Provider Selection & Config                      │    │
│  │  - Wake Word Settings                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Assistant Module                         │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐             │    │
│  │  │ Assistant │ │  Intent   │ │  Context  │             │    │
│  │  │  Service  │ │  Service  │ │  Service  │             │    │
│  │  └─────┬─────┘ └───────────┘ └───────────┘             │    │
│  │        │                                                │    │
│  │  ┌─────▼─────────────────────────────────────────────┐ │    │
│  │  │              Provider Registry                     │ │    │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │ │    │
│  │  │  │   LLM   │ │   STT   │ │   TTS   │ │  Wake   │  │ │    │
│  │  │  │ Factory │ │ Factory │ │ Factory │ │ Factory │  │ │    │
│  │  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │ │    │
│  │  └───────┼──────────┼──────────┼──────────┼──────────┘ │    │
│  └──────────┼──────────┼──────────┼──────────┼────────────┘    │
│             │          │          │          │                  │
│      ┌──────┴───┐ ┌────┴────┐ ┌───┴───┐ ┌────┴────┐            │
│      │ Ollama   │ │ Whisper │ │ Piper │ │OpenWake │            │
│      │ OpenAI   │ │ OpenAI  │ │OpenAI │ │Porcupine│            │
│      │ Anthropic│ │Deepgram │ │Eleven │ │         │            │
│      │ Google   │ │ Google  │ │Google │ │         │            │
│      └──────────┘ └─────────┘ └───────┘ └─────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PANEL APP                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Assistant Feature                       │    │
│  │  ┌───────────────────────────────────────────────────┐  │    │
│  │  │              Emoji Face Widget                     │  │    │
│  │  │   😊 😔 🤔 😮 😴 🎵 💬                            │  │    │
│  │  │   CustomPaint + AnimationController               │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  │  ┌───────────────────────────────────────────────────┐  │    │
│  │  │              Voice Service                         │  │    │
│  │  │   - Microphone Recording                          │  │    │
│  │  │   - Audio Playback                                │  │    │
│  │  │   - Wake Word Detection (optional local)          │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  │  ┌───────────────────────────────────────────────────┐  │    │
│  │  │            Assistant Repository                    │  │    │
│  │  │   - Conversation State                            │  │    │
│  │  │   - Emotion State                                 │  │    │
│  │  │   - WebSocket Communication                       │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```
