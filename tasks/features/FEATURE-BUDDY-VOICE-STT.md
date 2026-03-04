# Task: Speech-to-text integration

ID: FEATURE-BUDDY-VOICE-STT
Type: feature
Scope: backend, panel
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to interact with the buddy hands-free,
As a home operator,
I want to speak to the panel and have my voice transcribed to text for the buddy to process.

## 2. Context

- Depends on Phase 1 being complete (conversation API).
- STT provider must be swappable: local Whisper, cloud Whisper API, Google Cloud STT, or system default.
- The panel device has a microphone. Audio is recorded on the panel and sent to the backend for transcription.
- Transcribed text is routed through the existing `BuddyConversationService.sendMessage()` flow.

## 3. Scope

**In scope**

- Backend:
  - `SttProviderService` — abstraction for STT providers (Whisper API, local Whisper, system)
  - `POST /v1/modules/buddy/conversations/:id/audio` — accepts audio upload, transcribes, processes as chat message
  - STT configuration in buddy config (provider, model, language)
- Panel:
  - Microphone button in buddy chat drawer
  - Audio recording (press-and-hold or tap-to-toggle)
  - Audio upload to backend endpoint
  - Visual recording indicator (pulsing icon)
  - Transcription shown as user message in chat

**Out of scope**

- Wake word detection (→ FEATURE-BUDDY-VOICE-WAKE-WORD)
- Text-to-speech responses (→ FEATURE-BUDDY-VOICE-TTS)
- Real-time streaming transcription (batch only for MVP)
- Noise cancellation

## 4. Acceptance criteria

- [x] Backend `SttProviderService` supports: `whisper-api` (OpenAI Whisper API), `whisper-local` (local binary), `none`
- [x] `POST /v1/modules/buddy/conversations/:id/audio` accepts WAV/WebM audio, transcribes, and returns the full conversation response (same as text message endpoint)
- [x] Audio endpoint validates file size (max 25MB) and format
- [x] Panel: microphone button in chat drawer input area
- [x] Panel: press-and-hold recording with visual indicator
- [x] Panel: recorded audio uploaded to backend, transcribed text shown as user message
- [x] Panel: handles recording permissions gracefully (prompt for mic access)
- [x] STT provider configurable in admin settings (extends buddy config)
- [x] Unit tests for STT service (mock audio transcription)

## 5. Example scenarios

### Scenario: Voice message

Given the buddy chat drawer is open
When the operator presses and holds the microphone button
And says "What's the temperature in the bedroom?"
And releases the button
Then the audio is uploaded to the backend
And transcribed to text: "What's the temperature in the bedroom?"
And the text appears as a user message
And the buddy responds with the temperature

## 6. Technical constraints

- Audio format: WAV or WebM (panel records in available format)
- Backend audio processing: use `multer` or similar for file upload handling
- Whisper API: requires OpenAI API key (can share with chat provider if both use OpenAI)
- Local Whisper: requires `whisper` binary installed on the system (optional, fail gracefully)
- Max audio duration: 30 seconds per message
- Panel: use `flutter_sound` or `record` package for audio recording

## 7. Implementation hints

- **Backend audio endpoint**: Use NestJS `@UseInterceptors(FileInterceptor('audio'))` for file upload
- **Whisper API**: `POST https://api.openai.com/v1/audio/transcriptions` with multipart form data
- **Local Whisper**: Spawn process `whisper --model base --language auto --output_format txt`
- **Panel recording**: Use `record` package for cross-platform audio recording
- **Audio pipeline**: Record → Upload → Transcribe → Send as text message → Return response

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to backend and panel.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
