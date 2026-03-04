# Task: Text-to-speech integration

ID: FEATURE-BUDDY-VOICE-TTS
Type: feature
Scope: backend, panel
Size: medium
Parent: EPIC-BUDDY-MODULE
Status: done

## 1. Business goal

In order to hear the buddy's responses,
As a home operator,
I want the buddy to speak its answers aloud through the panel's speaker.

## 2. Context

- Depends on FEATURE-BUDDY-VOICE-STT (voice input should work first).
- TTS provider must be swappable: system TTS, ElevenLabs, OpenAI TTS, or none.
- The backend generates audio from the response text and streams/returns it to the panel.
- The panel plays the audio through the device speaker.

## 3. Scope

**In scope**

- Backend:
  - `TtsProviderService` — abstraction for TTS providers (OpenAI TTS, ElevenLabs, system `espeak`/`piper`)
  - `GET /v1/modules/buddy/conversations/:id/messages/:messageId/audio` — returns audio for a message
  - TTS configuration in buddy config (provider, voice, speed)
- Panel:
  - Auto-play audio response when voice mode is active
  - Speaker icon on assistant messages to replay audio
  - Volume control integration

**Out of scope**

- Emotional tone adjustment
- Multi-language voice switching
- Custom voice training

## 4. Acceptance criteria

- [ ] Backend `TtsProviderService` supports: `openai-tts`, `elevenlabs`, `system` (espeak/piper), `none`
- [ ] `GET .../messages/:messageId/audio` returns audio data (MP3 or WAV)
- [ ] Audio is generated on-demand and cached for the session
- [ ] Panel: auto-plays audio when voice input mode is active
- [ ] Panel: speaker icon on assistant messages for manual playback
- [ ] TTS provider configurable in admin settings
- [ ] Handles TTS errors gracefully (text response still shown even if audio fails)
- [ ] Unit tests for TTS service (mock audio generation)

## 5. Example scenarios

### Scenario: Voice response

Given the operator asked a question via voice (STT)
When the buddy responds with "The bedroom is 21.5°C"
Then the backend generates audio via the configured TTS provider
And the panel auto-plays the audio response
And the text response is also shown in the chat

## 6. Technical constraints

- Audio format: MP3 preferred (smaller), WAV fallback
- OpenAI TTS: `POST https://api.openai.com/v1/audio/speech`
- ElevenLabs: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- System TTS: spawn `espeak` or `piper` process
- Audio caching: in-memory with TTL (5 min), keyed by message ID
- Panel: use `just_audio` or `audioplayers` package for playback

## 7. Implementation hints

- **TTS caching**: Use NestJS `CacheModule` (already configured globally) to cache audio buffers
- **Streaming**: For long responses, consider chunking text at sentence boundaries
- **Panel playback**: Play audio while keeping chat UI responsive — use separate isolate/thread if needed

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to backend and panel.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
