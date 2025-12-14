# Task: AI Assistant Panel Voice Integration
ID: FEATURE-AI-ASSISTANT-PANEL-VOICE
Type: feature
Scope: panel
Size: medium
Parent: FEATURE-AI-ASSISTANT
Status: planned

## 1. Business goal

In order to enable hands-free voice interaction with the assistant
As a panel user
I want to speak commands and hear responses without touching the screen

## 2. Context

- Existing audio settings support in `lib/features/settings/presentation/pages/audio_settings.dart`
- Display config already tracks `audioInputSupported` and `audioOutputSupported`
- WebSocket infrastructure ready for streaming audio
- Target hardware: USB microphones, I2S audio HATs, USB speakers
- Wake word detection can run locally on panel or on backend

### Audio Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Panel App                               │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Mic    │───►│ Voice Service │───►│ WebSocket Send   │  │
│  │ Hardware │    │  (Recording)  │    │ (Audio Chunks)   │  │
│  └──────────┘    └──────────────┘    └────────┬─────────┘  │
│                                                │             │
│  ┌──────────┐    ┌──────────────┐    ┌────────▼─────────┐  │
│  │ Speaker  │◄───│ Voice Service │◄───│ WebSocket Recv   │  │
│  │ Hardware │    │  (Playback)   │    │ (Audio Response) │  │
│  └──────────┘    └──────────────┘    └──────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Wake Word Detector (Optional)            │   │
│  │         Runs locally for always-on listening          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 3. Scope

**In scope**

- `VoiceService` for audio recording and playback
- Integration with platform audio APIs (Linux ALSA via Flutter plugins)
- Audio streaming to backend via WebSocket
- Audio playback from backend responses
- Wake word detection integration (local)
- Push-to-talk alternative for wake word
- Audio level visualization
- Microphone permission handling
- Audio format conversion (if needed)

**Out of scope**

- STT/TTS processing (handled by backend)
- Emoji face animations (separate task)
- Backend audio processing (separate task)
- Audio settings UI (already exists)

## 4. Acceptance criteria

- [ ] `VoiceService` can record audio from microphone
- [ ] Audio streams to backend in real-time via WebSocket
- [ ] Backend audio responses play through speaker
- [ ] Wake word detection triggers listening mode
- [ ] Push-to-talk button available as alternative
- [ ] Audio levels displayed during recording
- [ ] Graceful handling when audio hardware unavailable
- [ ] Works with USB microphones on Raspberry Pi
- [ ] Audio quality sufficient for speech recognition (16kHz+)
- [ ] Recording stops automatically after silence detection

## 5. Example scenarios

### Scenario: Wake word activation

Given the panel is in idle state with wake word enabled
When the user says "Hey Panel"
Then the wake word detector triggers
And VoiceService starts recording
And the assistant face shows listening state
And audio streams to backend for processing

### Scenario: Push-to-talk

Given wake word is disabled
When the user presses and holds the microphone button
Then VoiceService starts recording
And audio streams to backend
When the user releases the button
Then recording stops and final audio is sent

### Scenario: Response playback

Given the assistant has processed a voice command
When the backend sends audio response via WebSocket
Then VoiceService plays the audio through speakers
And the assistant face shows speaking animation
And playback completion triggers return to idle state

## 6. Technical constraints

- Use `record` or `flutter_sound` package for audio recording
- Use `just_audio` or `audioplayers` for playback
- Audio format: PCM 16-bit, 16kHz mono (standard for speech)
- WebSocket binary messages for audio streaming
- Handle Linux ALSA audio system properly
- Minimize latency in audio pipeline
- Buffer audio appropriately for network jitter
- Follow existing service patterns in `lib/core/services/`

## 7. Implementation hints

### File Structure

```
lib/features/assistant/
├── services/
│   ├── voice_service.dart
│   ├── wake_word_service.dart
│   └── audio_level_analyzer.dart
├── presentation/
│   └── widgets/
│       ├── push_to_talk_button.dart
│       └── audio_level_indicator.dart
```

### VoiceService Interface

```dart
abstract class VoiceService {
  /// Start recording audio
  Future<void> startRecording();

  /// Stop recording and return final audio
  Future<Uint8List> stopRecording();

  /// Stream of audio chunks during recording
  Stream<Uint8List> get audioStream;

  /// Stream of audio levels (0.0 - 1.0)
  Stream<double> get audioLevelStream;

  /// Play audio from bytes
  Future<void> playAudio(Uint8List audio);

  /// Stop any current playback
  Future<void> stopPlayback();

  /// Check if audio input is available
  Future<bool> get isInputAvailable;

  /// Check if audio output is available
  Future<bool> get isOutputAvailable;
}
```

### WebSocket Audio Events

```dart
// Extend existing socket service

// Send audio chunk to backend
void sendAudioChunk(Uint8List chunk) {
  socket.emitWithBinary('assistant/audio-chunk', chunk);
}

// Send end of audio signal
void sendAudioEnd() {
  socket.emit('assistant/audio-end', {});
}

// Listen for audio response
socket.on('assistant/audio-response', (data) {
  final audio = data['audio'] as Uint8List;
  voiceService.playAudio(audio);
});
```

### Wake Word Integration

```dart
class WakeWordService {
  // Use porcupine_flutter or similar
  late Porcupine _porcupine;

  Stream<void> get onWakeWord => _wakeWordController.stream;

  Future<void> initialize(String keyword) async {
    _porcupine = await Porcupine.fromKeywordPaths(
      accessKey: config.accessKey,
      keywordPaths: [keyword],
    );
  }

  void processAudioFrame(List<int> frame) {
    final result = _porcupine.process(frame);
    if (result >= 0) {
      _wakeWordController.add(null);
    }
  }
}
```

### Audio Recording Configuration

```dart
// Optimal settings for speech recognition
const audioConfig = RecordConfig(
  encoder: AudioEncoder.pcm16bits,
  sampleRate: 16000,
  numChannels: 1,
  bitRate: 256000,
);
```

### Silence Detection

```dart
class SilenceDetector {
  final double threshold;
  final Duration silenceDuration;

  int _silentFrames = 0;

  bool checkFrame(double level) {
    if (level < threshold) {
      _silentFrames++;
      return _silentFrames > (silenceDuration.inMilliseconds / frameMs);
    }
    _silentFrames = 0;
    return false;
  }
}
```

## 8. AI instructions (for Junie / AI)

- Read FEATURE-AI-ASSISTANT.md and FEATURE-AI-ASSISTANT-PANEL-FACE.md first
- Start with basic recording/playback without streaming
- Add WebSocket streaming after basic audio works
- Test on actual hardware - emulators don't have audio
- Wake word is optional - push-to-talk is the fallback
- Consider battery/CPU usage for always-on wake word
- Handle all error cases (no mic, permission denied, etc.)
- Audio quality is critical - test with actual speech recognition

### Recommended Flutter Packages

```yaml
dependencies:
  record: ^5.0.0          # Audio recording
  just_audio: ^0.9.0      # Audio playback
  porcupine_flutter: ^3.0.0  # Wake word (optional)
  permission_handler: ^11.0.0  # Microphone permission
```
