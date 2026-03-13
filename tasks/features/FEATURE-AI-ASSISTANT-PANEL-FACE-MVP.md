# Task: AI Assistant Face Widget MVP (Buddy Module Integration)
ID: FEATURE-AI-ASSISTANT-PANEL-FACE-MVP
Type: feature
Scope: panel
Size: medium
Parent: EPIC-AI-BUDDY-FACE
Created: 2026-03-13
Status: planned

## 1. Business goal

In order to give the AI buddy a visual personality and make interactions feel alive
As a panel user
I want to see an animated emoji face that reacts to the buddy's state - thinking when processing, happy when responding, listening when voice is active, idle when waiting

## 2. Context

- **The backend buddy module already exists** with full LLM, STT, TTS, and voice activation support
- The face widget integrates with the existing `BuddyService`, `VoiceActivationService`, and `AudioPlaybackService`
- **No backend changes needed** - emotion is inferred from observable buddy state on the panel
- Quality target: ESP32 EchoEar / XiaoZhi AI level animations

### Existing Buddy Module (on `main` branch)

The buddy module provides all the infrastructure. The face widget is a **reactive observer** of these services:

| Service | Location | Observable State |
|---------|----------|-----------------|
| `BuddyService` | `lib/modules/buddy/service.dart` | `isSendingMessage`, `messages`, `hasActiveConversation`, `errorType`, `suggestions` |
| `VoiceActivationService` | `lib/modules/buddy/services/voice_activation_service.dart` | `state` (stopped/listening/recording/processing) |
| `AudioPlaybackService` | `lib/modules/buddy/services/audio_playback_service.dart` | `isPlaying`, `isLoading` |

### Emotion Inference (No Backend Changes)

Since the message model has no emotion field, the face widget **infers emotion from buddy state**:

```
Voice state = listening    → Face: LISTENING (alert eyes)
Voice state = recording    → Face: LISTENING (active pulse)
Voice state = processing   → Face: THINKING (processing dots)
isSendingMessage = true    → Face: THINKING (eyes looking around)
New assistant message       → Face: HAPPY (brief, then SPEAKING)
AudioPlayback.isPlaying    → Face: SPEAKING (mouth animation)
errorType != null          → Face: SORRY (sad expression)
suggestions.isNotEmpty     → Face: EXCITED (brief notification)
No activity for 30s+       → Face: SLEEPY → IDLE (gradual)
Default idle               → Face: NEUTRAL (blink + look around)
```

### Design References

| Project | Key Features | Link |
|---------|--------------|------|
| ESP32 EchoEar | Circular display, cat-style face, smooth emotions | [Espressif Docs](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/echoear/) |
| esp32-eyes | 18 emotions, programmatic rendering, eye presets | [GitHub](https://github.com/playfultechnology/esp32-eyes) |
| XiaoZhi AI | Emoji emotions, JSON protocol | [Emotion Docs](https://xiaozhi.dev/en/docs/development/emotion/) |

## 3. Scope

**In scope**

- `AssistantFaceWidget` using CustomPaint with EchoEar-quality rendering
- `FacePainter` with advanced eye system (12+ emotion presets)
- `BlinkController` - automatic random blinking
- `LookController` - random eye movement / look-at support
- `EmotionController` - smooth interpolated transitions
- `BuddyEmotionMapper` - maps buddy state to face emotions
- Integration with existing `BuddyService` via Provider
- Integration with existing `VoiceActivationService`
- Integration with existing `AudioPlaybackService`
- Face overlay/page accessible from buddy chat or as standalone view
- Demo mode for testing all emotions without buddy

**Out of scope**

- Backend changes (buddy module already handles LLM, STT, TTS)
- Admin configuration changes
- New API endpoints
- Voice recording (already exists in buddy module)
- Chat UI (already exists as `BuddyChatPage`)

## 4. Acceptance criteria

### Visual Quality
- [ ] Face renders with smooth anti-aliased graphics
- [ ] Eyes have proper depth (outer eye, iris, pupil, highlight)
- [ ] Mouth has multiple shapes (line, arc, open oval, wide smile)
- [ ] Colors adapt properly to light/dark themes

### Emotions (minimum 14)
- [ ] `neutral` - Default relaxed state
- [ ] `happy` - Curved "^" eyes, big smile
- [ ] `sad` - Droopy eyes, downturned mouth
- [ ] `angry` - Slanted eyebrows, tight mouth
- [ ] `surprised` - Wide round eyes, "O" mouth
- [ ] `thinking` - Eyes looking up/side, slight frown
- [ ] `listening` - Alert wide eyes, neutral mouth
- [ ] `speaking` - Normal eyes, animated mouth
- [ ] `sleepy` - Half-closed droopy eyes
- [ ] `excited` - Sparkly wide eyes, big smile
- [ ] `confused` - Asymmetric eyes, wavy mouth
- [ ] `love` - Heart eyes or very happy curved eyes
- [ ] `sorry` - Sad apologetic eyes, downturned mouth (for error states)
- [ ] `idle` - Fully closed eyes, no mouth, minimal animation (distinct from sleepy)

### Animation System
- [ ] Random blinking every 2-6 seconds (configurable)
- [ ] Blink animation duration ~150ms (quick and natural)
- [ ] Random eye movement/look-around in idle state
- [ ] Smooth interpolation between ALL emotion parameters (300-500ms)
- [ ] Speaking mouth animation while `AudioPlaybackService.isPlaying`
- [ ] Idle breathing/floating animation
- [ ] 60fps on Raspberry Pi 4

### Buddy Integration
- [ ] Face reacts to `VoiceActivationService.state` changes
- [ ] Face shows thinking while `BuddyService.isSendingMessage`
- [ ] Face shows speaking while `AudioPlaybackService.isPlaying`
- [ ] Face shows sorry on `BuddyService.errorType` changes
- [ ] Face shows excited briefly when new suggestions arrive
- [ ] Face transitions to sleepy after inactivity timeout
- [ ] Tapping face activates voice input (triggers voice activation)

### Demo Mode
- [ ] Demo page accessible from settings menu
- [ ] Grid of emotion buttons to trigger manually
- [ ] "Auto Demo" cycles through all emotions
- [ ] Blink and look-around toggles

## 5. Example scenarios

### Scenario: Voice command flow with face reactions

Given the face is in neutral/idle state
When the user says "Hey Panel" (voice activation triggers)
Then `VoiceActivationService.state` changes to `listening`
And the face transitions to LISTENING (alert eyes)
When the user speaks their command
Then `VoiceActivationService.state` changes to `recording`
And the face shows active LISTENING (pulsing)
When recording ends and audio is sent
Then `BuddyService.isSendingMessage` becomes true
And the face transitions to THINKING (eyes moving, dots)
When the buddy responds
Then a new assistant message appears in `BuddyService.messages`
And the face transitions to HAPPY (brief)
When TTS audio plays
Then `AudioPlaybackService.isPlaying` becomes true
And the face transitions to SPEAKING (mouth animation)
When audio finishes
Then the face returns to NEUTRAL with idle animations

### Scenario: Error handling

Given the face is in thinking state (processing a request)
When `BuddyService.errorType` is set (e.g., provider not configured)
Then the face transitions to SORRY (sad eyes, downturned mouth)
And after 3 seconds returns to NEUTRAL

### Scenario: Inactivity transition

Given the face is in neutral state
When no buddy interaction occurs for 30 seconds
Then the face gradually transitions to SLEEPY
And after 60 seconds transitions to idle (minimal animation, closed eyes)
When any interaction occurs
Then the face immediately wakes to NEUTRAL or appropriate emotion

## 6. Technical constraints

- Use `CustomPainter` for all rendering (no images/SVGs)
- Use multiple `AnimationController`s for independent animations
- Access buddy services via existing Provider/get_it patterns
- Follow existing widget patterns from buddy module (`voice_activation_indicator.dart`)
- Use `RepaintBoundary` around face widget for performance
- No new Flutter dependencies required (use built-ins)
- Target 60fps on Raspberry Pi 4

## 7. Implementation hints

### File Structure

```
lib/features/assistant/
├── assistant.dart                          # Feature barrel exports
├── presentation/
│   ├── pages/
│   │   ├── assistant_face_page.dart        # Full-screen face view
│   │   └── assistant_demo_page.dart        # Demo page (settings)
│   └── widgets/
│       ├── assistant_face_widget.dart      # Main widget
│       ├── painters/
│       │   ├── face_painter.dart           # Main face painter
│       │   ├── eye_painter.dart            # Eye rendering
│       │   └── mouth_painter.dart          # Mouth rendering
│       ├── controllers/
│       │   ├── emotion_controller.dart     # Emotion transitions
│       │   ├── blink_controller.dart       # Random blinking
│       │   └── look_controller.dart        # Eye wandering
│       └── models/
│           ├── emotion_preset.dart         # Emotion definitions
│           ├── eye_config.dart             # Eye parameters
│           └── mouth_config.dart           # Mouth parameters
├── services/
│   └── buddy_emotion_mapper.dart           # Maps buddy state → emotion
```

### BuddyEmotionMapper - Core Integration Logic

```dart
/// Maps observable buddy module state to face emotion presets.
/// This is the bridge between the existing buddy module and the face widget.
class BuddyEmotionMapper extends ChangeNotifier {
  final BuddyService _buddyService;
  final VoiceActivationService _voiceActivationService;
  final AudioPlaybackService _audioPlaybackService;

  EmotionPreset _currentEmotion = EmotionPresets.neutral;
  Timer? _inactivityTimer;
  Timer? _temporaryEmotionTimer;
  DateTime? _lastInteractionTime;
  int _lastSeenMessageCount = 0;
  int _lastSeenSuggestionCount = 0;

  static const _sleepyTimeout = Duration(seconds: 30);
  static const _idleTimeout = Duration(seconds: 60);
  static const _happyDuration = Duration(seconds: 2);
  static const _sorryDuration = Duration(seconds: 3);
  static const _excitedDuration = Duration(seconds: 2);

  EmotionPreset get emotion => _currentEmotion;

  BuddyEmotionMapper({
    required BuddyService buddyService,
    required VoiceActivationService voiceActivationService,
    required AudioPlaybackService audioPlaybackService,
  })  : _buddyService = buddyService,
        _voiceActivationService = voiceActivationService,
        _audioPlaybackService = audioPlaybackService {
    // Initialize tracking to current state so we only react to NEW messages/suggestions
    _lastSeenMessageCount = _buddyService.messages.length;
    _lastSeenSuggestionCount = _buddyService.suggestions.length;
    _buddyService.addListener(_onBuddyChanged);
    _voiceActivationService.addListener(_onVoiceChanged);
    _audioPlaybackService.addListener(_onPlaybackChanged);
    _startInactivityTimer();
  }

  void _onVoiceChanged() {
    _markActivity();
    switch (_voiceActivationService.state) {
      case VoiceActivationState.listening:
        _setEmotion(EmotionPresets.listening);
        break;
      case VoiceActivationState.recording:
        _setEmotion(EmotionPresets.listening);  // Same but pulsing
        break;
      case VoiceActivationState.processing:
        _setEmotion(EmotionPresets.thinking);
        break;
      case VoiceActivationState.stopped:
        // Don't override - let other handlers decide
        break;
    }
  }

  void _onBuddyChanged() {
    _markActivity();

    // Error state takes priority
    if (_buddyService.errorType != null) {
      _setEmotionTemporary(EmotionPresets.sorry, _sorryDuration);
      return;
    }

    // Sending/processing message
    if (_buddyService.isSendingMessage) {
      _setEmotion(EmotionPresets.thinking);
      return;
    }

    // Check for NEW assistant message (track count to avoid re-triggering)
    final messages = _buddyService.messages;
    if (messages.length > _lastSeenMessageCount) {
      _lastSeenMessageCount = messages.length;
      if (messages.last.role == BuddyMessageRole.assistant) {
        if (!_audioPlaybackService.isPlaying) {
          _setEmotionTemporary(EmotionPresets.happy, _happyDuration);
        }
      }
    }

    // NEW suggestions → brief excited (track count to avoid re-triggering)
    final suggestions = _buddyService.suggestions;
    if (suggestions.length > _lastSeenSuggestionCount) {
      _lastSeenSuggestionCount = suggestions.length;
      _setEmotionTemporary(EmotionPresets.excited, _excitedDuration);
    }
  }

  void _onPlaybackChanged() {
    _markActivity();
    if (_audioPlaybackService.isPlaying) {
      _setEmotion(EmotionPresets.speaking);
    } else if (!_buddyService.isSendingMessage) {
      _setEmotion(EmotionPresets.neutral);
    }
  }

  void _markActivity() {
    _lastInteractionTime = DateTime.now();
    _startInactivityTimer();

    // Wake from sleepy/idle if needed
    if (_currentEmotion == EmotionPresets.sleepy ||
        _currentEmotion == EmotionPresets.idle) {
      _setEmotion(EmotionPresets.neutral);
    }
  }

  void _startInactivityTimer() {
    _inactivityTimer?.cancel();
    _inactivityTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      final elapsed = DateTime.now().difference(_lastInteractionTime ?? DateTime.now());
      if (elapsed > _idleTimeout) {
        _setEmotion(EmotionPresets.idle);  // Deep idle, minimal animation
      } else if (elapsed > _sleepyTimeout) {
        _setEmotion(EmotionPresets.sleepy);
      }
    });
  }

  void _setEmotion(EmotionPreset emotion) {
    if (_currentEmotion == emotion) return;
    _currentEmotion = emotion;
    notifyListeners();
  }

  void _setEmotionTemporary(EmotionPreset emotion, Duration duration) {
    _temporaryEmotionTimer?.cancel();
    _setEmotion(emotion);
    _temporaryEmotionTimer = Timer(duration, () {
      if (_currentEmotion == emotion) {
        _setEmotion(EmotionPresets.neutral);
      }
    });
  }

  @override
  void dispose() {
    _inactivityTimer?.cancel();
    _temporaryEmotionTimer?.cancel();
    _buddyService.removeListener(_onBuddyChanged);
    _voiceActivationService.removeListener(_onVoiceChanged);
    _audioPlaybackService.removeListener(_onPlaybackChanged);
    super.dispose();
  }
}
```

### Face Page (Buddy-Integrated View)

```dart
/// Full-screen face view that reacts to buddy state.
/// Can be used as a standalone page or overlaid on the chat.
class AssistantFacePage extends StatefulWidget {
  const AssistantFacePage({super.key});

  @override
  State<AssistantFacePage> createState() => _AssistantFacePageState();
}

class _AssistantFacePageState extends State<AssistantFacePage> {
  late BuddyEmotionMapper _emotionMapper;

  @override
  void initState() {
    super.initState();
    final buddyService = context.read<BuddyService>();
    final voiceService = GetIt.instance<VoiceActivationService>();
    final audioService = GetIt.instance<AudioPlaybackService>();

    _emotionMapper = BuddyEmotionMapper(
      buddyService: buddyService,
      voiceActivationService: voiceService,
      audioPlaybackService: audioService,
    );
  }

  @override
  void dispose() {
    _emotionMapper.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: GestureDetector(
        onTap: _onFaceTapped,
        child: ListenableBuilder(
          listenable: _emotionMapper,
          builder: (context, _) {
            return AssistantFaceWidget(
              emotion: _emotionMapper.emotion,
              blinkEnabled: true,
              lookEnabled: true,
            );
          },
        ),
      ),
    );
  }

  void _onFaceTapped() {
    // Activate voice input when face is tapped
    final voiceService = GetIt.instance<VoiceActivationService>();
    if (voiceService.state == VoiceActivationState.stopped) {
      voiceService.startListening();
    }
  }
}
```

### Eye Configuration Model (like esp32-eyes)

```dart
/// Configuration for a single eye's appearance.
/// All parameters are interpolatable for smooth transitions.
class EyeConfig {
  final double height;      // 0.0 = flat line, 1.0 = full circle
  final double width;       // Horizontal stretch factor
  final double slope;       // Rotation angle (-45 to +45) for angry/skeptical
  final double offsetY;     // Vertical offset (raised/lowered eyebrow)
  final double pupilSize;   // 0.0 = no pupil, 1.0 = large pupil
  final double pupilX;      // -1.0 to 1.0, horizontal look direction
  final double pupilY;      // -1.0 to 1.0, vertical look direction
  final bool highlight;     // Show specular highlight

  const EyeConfig({
    this.height = 1.0,
    this.width = 1.0,
    this.slope = 0.0,
    this.offsetY = 0.0,
    this.pupilSize = 0.6,
    this.pupilX = 0.0,
    this.pupilY = 0.0,
    this.highlight = true,
  });

  EyeConfig lerp(EyeConfig other, double t) {
    return EyeConfig(
      height: lerpDouble(height, other.height, t)!,
      width: lerpDouble(width, other.width, t)!,
      slope: lerpDouble(slope, other.slope, t)!,
      offsetY: lerpDouble(offsetY, other.offsetY, t)!,
      pupilSize: lerpDouble(pupilSize, other.pupilSize, t)!,
      pupilX: lerpDouble(pupilX, other.pupilX, t)!,
      pupilY: lerpDouble(pupilY, other.pupilY, t)!,
      highlight: t < 0.5 ? highlight : other.highlight,
    );
  }
}
```

### Emotion Presets

```dart
class EmotionPresets {
  static const neutral = EmotionPreset.symmetric(
    name: 'Neutral', emoji: '😐',
    eyes: EyeConfig(height: 0.8, pupilSize: 0.5),
    mouth: MouthConfig(curvature: 0.0),
  );
  static const happy = EmotionPreset.symmetric(
    name: 'Happy', emoji: '😊',
    eyes: EyeConfig(height: 0.5, slope: 15, pupilSize: 0.4),
    mouth: MouthConfig(curvature: 0.8, width: 0.5),
    faceOffsetY: -0.02,
  );
  static const sad = EmotionPreset.symmetric(
    name: 'Sad', emoji: '😢',
    eyes: EyeConfig(height: 0.6, slope: -10, offsetY: 0.05, pupilY: 0.3),
    mouth: MouthConfig(curvature: -0.6, width: 0.3),
    faceOffsetY: 0.02,
  );
  static const angry = EmotionPreset.symmetric(
    name: 'Angry', emoji: '😠',
    eyes: EyeConfig(height: 0.7, slope: -20, pupilSize: 0.3),
    mouth: MouthConfig(curvature: -0.3, width: 0.35, shape: MouthShape.line),
  );
  static const surprised = EmotionPreset.symmetric(
    name: 'Surprised', emoji: '😮',
    eyes: EyeConfig(height: 1.2, width: 1.1, pupilSize: 0.4),
    mouth: MouthConfig(openness: 0.7, shape: MouthShape.oval),
  );
  static const thinking = EmotionPreset(
    name: 'Thinking', emoji: '🤔',
    leftEye: EyeConfig(height: 0.7, pupilX: 0.5, pupilY: -0.4),
    rightEye: EyeConfig(height: 0.9, pupilX: 0.5, pupilY: -0.4),
    mouth: MouthConfig(curvature: -0.1, width: 0.25),
  );
  static const listening = EmotionPreset.symmetric(
    name: 'Listening', emoji: '👂',
    eyes: EyeConfig(height: 1.0, pupilSize: 0.55),
    mouth: MouthConfig(curvature: 0.1),
  );
  static const speaking = EmotionPreset.symmetric(
    name: 'Speaking', emoji: '💬',
    eyes: EyeConfig(height: 0.85, pupilSize: 0.5),
    mouth: MouthConfig(openness: 0.3, shape: MouthShape.oval),
  );
  static const sleepy = EmotionPreset.symmetric(
    name: 'Sleepy', emoji: '😴',
    eyes: EyeConfig(height: 0.2, slope: 5),
    mouth: MouthConfig(curvature: 0.0, openness: 0.1),
    faceOffsetY: 0.03,
  );
  static const excited = EmotionPreset.symmetric(
    name: 'Excited', emoji: '🤩',
    eyes: EyeConfig(height: 1.1, width: 1.1, pupilSize: 0.3, highlight: true),
    mouth: MouthConfig(curvature: 1.0, width: 0.55, openness: 0.2),
    faceOffsetY: -0.03,
  );
  static const confused = EmotionPreset(
    name: 'Confused', emoji: '😕',
    leftEye: EyeConfig(height: 0.9, slope: 10),
    rightEye: EyeConfig(height: 0.7, slope: -5),
    mouth: MouthConfig(shape: MouthShape.wavy, curvature: -0.2),
  );
  static const love = EmotionPreset.symmetric(
    name: 'Love', emoji: '😍',
    eyes: EyeConfig(height: 0.6, slope: 10, pupilSize: 0.7),
    mouth: MouthConfig(curvature: 0.9, width: 0.45),
  );
  static const sorry = EmotionPreset.symmetric(
    name: 'Sorry', emoji: '😔',
    eyes: EyeConfig(height: 0.5, slope: -8, offsetY: 0.04, pupilY: 0.3),
    mouth: MouthConfig(curvature: -0.5, width: 0.3),
    faceOffsetY: 0.02,
  );
  // Deep idle: distinct from sleepy — fully closed eyes, minimal animation
  static const idle = EmotionPreset.symmetric(
    name: 'Idle', emoji: '😑',
    eyes: EyeConfig(height: 0.05, slope: 0),
    mouth: MouthConfig(curvature: 0.0, openness: 0.0),
    faceOffsetY: 0.04,
  );

  static const all = [
    neutral, happy, sad, angry, surprised, thinking,
    listening, speaking, sleepy, excited, confused, love,
    sorry, idle,
  ];
}
```

### Emotion State Flow Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │          BuddyEmotionMapper                 │
                    │     (observes all buddy services)           │
                    └──────────────┬──────────────────────────────┘
                                   │
              ┌────────────────────┼─────────────────────┐
              │                    │                       │
   ┌──────────▼────────┐ ┌───────▼──────────┐ ┌─────────▼──────────┐
   │ VoiceActivation   │ │  BuddyService    │ │ AudioPlayback      │
   │    Service         │ │                  │ │    Service          │
   └──────────┬────────┘ └───────┬──────────┘ └─────────┬──────────┘
              │                    │                       │
   ┌──────────▼────────┐ ┌───────▼──────────┐ ┌─────────▼──────────┐
   │ listening → 👂     │ │ sending → 🤔     │ │ playing → 💬       │
   │ recording → 👂     │ │ error   → 😔     │ │ stopped → 😐       │
   │ processing → 🤔    │ │ response→ 😊     │ │                    │
   │ stopped   → (none) │ │ suggest → 🤩     │ │                    │
   └───────────────────┘ └──────────────────┘ └────────────────────┘
              │                    │                       │
              └────────────────────┼───────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────────┐
                    │     Inactivity Timer                        │
                    │  30s → 😴 sleepy   60s → idle              │
                    └─────────────────────────────────────────────┘
```

## 8. AI instructions (for Junie / AI)

- **Read the existing buddy module first** before writing any code:
  - `apps/panel/lib/modules/buddy/service.dart`
  - `apps/panel/lib/modules/buddy/services/voice_activation_service.dart`
  - `apps/panel/lib/modules/buddy/services/audio_playback_service.dart`
  - `apps/panel/lib/modules/buddy/module.dart`
- **Do NOT create backend code** - the buddy module handles everything
- **Do NOT modify existing buddy module files** - the face is additive only
- Start with the standalone face widget (no buddy integration)
- Add `BuddyEmotionMapper` after face animations work
- Study `voice_activation_indicator.dart` for how to observe buddy services
- Quality is paramount - match EchoEar animation level
- Test each emotion visually before adding state mapping

### Implementation Order

1. Eye rendering with `EyeConfig` (get one eye perfect)
2. Mouth rendering with `MouthConfig`
3. All 14 emotion presets (static)
4. Smooth transitions between presets
5. `BlinkController` (random blinking)
6. `LookController` (eye wandering)
7. Demo page (test all emotions manually)
8. `BuddyEmotionMapper` (connect to buddy services)
9. Face page with buddy integration
10. Polish, optimize, test on RPi

### Visual Reference

```
NEUTRAL     HAPPY       SAD         ANGRY
  ◉   ◉       ◠   ◠      ◡   ◡       ╲◉ ◉╱
    ─           ⌣          ︵           ─

SURPRISED   THINKING    SLEEPY      EXCITED
  ⊙   ⊙       ◉   ◑      ─   ─       ✧   ✧
    ○           ~          ~           ◡

LISTENING   SPEAKING    CONFUSED    LOVE
  ⊙   ⊙       ◉   ◉      ◑   ◉      ♡   ♡
    ·           ○          ∼           ⌣

SORRY       IDLE
  ◡   ◡       ─   ─
    ︵
```
