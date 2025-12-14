# Task: AI Assistant Emoji Face Widget
ID: FEATURE-AI-ASSISTANT-PANEL-FACE
Type: feature
Scope: panel
Size: medium
Parent: FEATURE-AI-ASSISTANT
Status: planned

## 1. Business goal

In order to provide friendly visual feedback during assistant interactions
As a panel user
I want to see an animated emoji face that expresses different emotions based on the assistant's state (listening, thinking, happy, sorry, etc.)

## 2. Context

- **Prerequisite**: Complete FEATURE-AI-ASSISTANT-PANEL-FACE-MVP first (standalone demo)
- Inspired by ESP32 EchoEar and XiaoZhi AI emotion display
- Use Flutter CustomPaint for smooth vector-based animations
- Follow existing widget patterns in `lib/core/widgets/`
- Look at `flip_clock.dart` for animation controller patterns
- Face should work on various screen sizes (responsive)

### Child Tasks

| Task ID | Description | Size |
|---------|-------------|------|
| FEATURE-AI-ASSISTANT-PANEL-FACE-MVP | Standalone face demo without backend | small |

### Emotion States

| State | Visual | Trigger |
|-------|--------|---------|
| Idle/Sleeping | Closed eyes, subtle breathing animation | No activity |
| Listening | Open eyes, sound wave visualization | Wake word detected |
| Thinking | Rotating/moving eyes, raised eyebrow | Processing request |
| Happy | Curved smile, bright eyes | Successful response |
| Surprised | Wide eyes, open mouth | Unexpected input |
| Sorry | Downturned mouth, sad eyes | Error or can't help |
| Speaking | Animated mouth sync | TTS playback |

## 3. Scope

**In scope**

- `AssistantFaceWidget` - Main face display widget
- `FacePainter` - CustomPaint implementation for face rendering
- `EmotionController` - Animation controller for emotion transitions
- Smooth transitions between emotion states
- Responsive sizing for different displays
- Integration with assistant state from repository
- Touch-to-activate gesture support
- Idle animation (subtle movement when inactive)

**Out of scope**

- Voice recording/playback (separate task: FEATURE-AI-ASSISTANT-PANEL-VOICE)
- Backend communication (handled by repository)
- Conversation text display (separate widget)
- Settings/configuration UI

## 4. Acceptance criteria

- [ ] `AssistantFaceWidget` renders eyes and mouth using CustomPaint
- [ ] At least 6 emotion states implemented with distinct visuals
- [ ] Smooth animated transitions between emotions (300-500ms)
- [ ] Idle animation plays when no activity (breathing/blinking)
- [ ] Face responds to touch (activates listening state)
- [ ] Widget is responsive to parent container size
- [ ] Colors configurable via theme
- [ ] Performance: 60fps animations on Raspberry Pi 4
- [ ] Widget can be used standalone or in assistant page

## 5. Example scenarios

### Scenario: Emotion transition

Given the face is showing idle (sleeping) state
When the emotion changes to "listening"
Then the eyes smoothly animate from closed to open
And sound wave visualization appears near the face
And the transition completes within 400ms

### Scenario: Touch activation

Given the face is in idle state
When the user taps the face widget
Then the face transitions to listening state
And an `onActivate` callback is triggered

### Scenario: Speaking animation

Given the assistant is speaking via TTS
When the speaking state is active
Then the mouth animates in sync with audio levels
And eyes remain in happy/neutral position

## 6. Technical constraints

- Use `CustomPainter` for all face rendering (no images/SVGs)
- Use `AnimationController` with `TickerProviderStateMixin`
- Follow existing theme patterns from `lib/core/utils/theme.dart`
- Keep widget stateless where possible, use controller for state
- Minimize widget rebuilds during animation (use `RepaintBoundary`)
- Test on actual Raspberry Pi hardware for performance
- Support both light and dark themes

## 7. Implementation hints

### File Structure

```
lib/features/assistant/
├── presentation/
│   ├── pages/
│   │   └── assistant_page.dart
│   └── widgets/
│       ├── assistant_face_widget.dart
│       ├── face_painter.dart
│       ├── emotion_controller.dart
│       └── emotion_state.dart
```

### Emotion State Enum

```dart
enum EmotionState {
  idle,      // 😴 Sleeping/resting
  listening, // 🎵 Actively listening
  thinking,  // 🤔 Processing
  happy,     // 😊 Success/positive
  surprised, // 😮 Unexpected
  sorry,     // 😔 Error/apology
  speaking,  // 💬 TTS active
}
```

### Face Painter Approach

```dart
class FacePainter extends CustomPainter {
  final EmotionState emotion;
  final double animationValue; // 0.0 - 1.0 for transitions
  final double idleAnimationValue; // For breathing/blinking
  final Color primaryColor;
  final Color backgroundColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final faceRadius = min(size.width, size.height) / 2 * 0.9;

    // Draw face background
    _drawFaceBackground(canvas, center, faceRadius);

    // Draw eyes based on emotion
    _drawEyes(canvas, center, faceRadius);

    // Draw mouth based on emotion
    _drawMouth(canvas, center, faceRadius);

    // Draw extras (sound waves, thinking dots, etc.)
    _drawExtras(canvas, center, faceRadius);
  }

  void _drawEyes(Canvas canvas, Offset center, double radius) {
    switch (emotion) {
      case EmotionState.idle:
        _drawClosedEyes(canvas, center, radius);
        break;
      case EmotionState.happy:
        _drawHappyEyes(canvas, center, radius);
        break;
      // ... other states
    }
  }
}
```

### Animation Controller

```dart
class EmotionController extends ChangeNotifier {
  EmotionState _currentEmotion = EmotionState.idle;
  EmotionState _targetEmotion = EmotionState.idle;
  double _transitionProgress = 1.0;

  late AnimationController _transitionController;
  late AnimationController _idleController;

  void setEmotion(EmotionState emotion) {
    if (emotion == _currentEmotion) return;

    _targetEmotion = emotion;
    _transitionController.forward(from: 0);
  }

  // Interpolate between emotions for smooth transitions
  FaceState get interpolatedState {
    return FaceState.lerp(
      FaceState.fromEmotion(_currentEmotion),
      FaceState.fromEmotion(_targetEmotion),
      _transitionProgress,
    );
  }
}
```

### Usage Example

```dart
class AssistantPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<AssistantRepository>(
      builder: (context, repo, _) {
        return Column(
          children: [
            Expanded(
              child: AssistantFaceWidget(
                emotion: repo.currentEmotion,
                onTap: () => repo.activate(),
              ),
            ),
            // Conversation display below face
            AssistantConversationWidget(),
          ],
        );
      },
    );
  }
}
```

## 8. AI instructions (for Junie / AI)

- Read FEATURE-AI-ASSISTANT.md first for full context
- Start with static face rendering (no animation)
- Add one emotion at a time, test each visually
- Add transitions after all static states work
- Test performance on target hardware if possible
- Use Flutter DevTools to monitor frame rate
- Keep painter logic simple and efficient
- Consider creating a demo mode for testing all emotions
