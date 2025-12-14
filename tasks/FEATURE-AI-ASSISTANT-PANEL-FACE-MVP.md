# Task: AI Assistant Face Widget MVP (Static Demo)
ID: FEATURE-AI-ASSISTANT-PANEL-FACE-MVP
Type: feature
Scope: panel
Size: medium
Parent: FEATURE-AI-ASSISTANT-PANEL-FACE
Status: planned

## 1. Business goal

In order to validate the visual design and animation quality of the assistant face
As a developer
I want to create a standalone face widget with polished animations matching EchoEar quality that can be demonstrated without backend integration

## 2. Context

- This is the MVP/first step before full assistant integration
- **Quality target: ESP32 EchoEar / XiaoZhi AI level animations**
- Focus on visual polish, smooth animations, and "alive" feeling
- Should work as a standalone demo page accessible from settings
- No WebSocket, no voice, no backend - just animated face
- Can be used to gather feedback on visual design

### Design References

| Project | Key Features | Link |
|---------|--------------|------|
| ESP32 EchoEar | Circular display, cat-style face, smooth emotions | [Espressif Docs](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/echoear/) |
| esp32-eyes | 18 emotions, programmatic rendering, eye presets | [GitHub](https://github.com/playfultechnology/esp32-eyes) |
| XiaoZhi AI | Emoji emotions, JSON protocol | [Emotion Docs](https://xiaozhi.dev/en/docs/development/emotion/) |

### Quality Requirements

The face must feel **alive and expressive**, not static:
- Eyes should occasionally blink randomly (like a real creature)
- Eyes should subtly move/look around when idle
- Transitions between emotions must be smooth (interpolated)
- Idle state should have continuous subtle animation
- Each emotion must be visually distinct and recognizable

## 3. Scope

**In scope**

- `AssistantFaceWidget` using CustomPaint with EchoEar-quality rendering
- `FacePainter` with advanced eye system (18 emotion presets)
- `BlinkController` - automatic random blinking
- `LookController` - random eye movement / look-at support
- `EmotionController` - smooth interpolated transitions
- Demo page with full controls
- Auto-cycle and random emotion modes
- Theme support (light/dark with proper contrast)

**Out of scope**

- Voice integration
- Backend communication
- Wake word detection
- Conversation display
- Sound/audio feedback

## 4. Acceptance criteria

### Visual Quality
- [ ] Face renders with smooth anti-aliased graphics
- [ ] Eyes have proper depth (outer eye, iris, pupil, highlight)
- [ ] Mouth has multiple shapes (line, arc, open oval, wide smile)
- [ ] Optional: subtle shadow/glow effects for depth
- [ ] Colors adapt properly to light/dark themes

### Emotions (minimum 12)
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

### Animation System
- [ ] Random blinking every 2-6 seconds (configurable)
- [ ] Blink animation duration ~150ms (quick and natural)
- [ ] Random eye movement/look-around in idle state
- [ ] Smooth interpolation between ALL emotion parameters (300-500ms)
- [ ] Speaking mouth animation syncs to simulated audio levels
- [ ] Idle breathing/floating animation
- [ ] 60fps on Raspberry Pi 4

### Demo Page Features
- [ ] Grid of emotion buttons with visual preview
- [ ] "Auto Demo" cycles through all emotions
- [ ] "Random" mode picks emotions randomly
- [ ] Blink toggle (on/off)
- [ ] Look-around toggle (on/off)
- [ ] Speed slider for transitions
- [ ] Manual look control (drag to move eyes)

## 5. Example scenarios

### Scenario: Lifelike idle behavior

Given the face is in neutral state with blink enabled
Then the eyes blink randomly every 2-6 seconds
And the blink animation takes ~150ms
And between blinks, eyes subtly drift in random directions
And there's a gentle floating/breathing animation

### Scenario: Emotion transition

Given the face is showing "neutral"
When emotion changes to "happy"
Then all parameters smoothly interpolate over 400ms:
  - Eye height transitions from normal to curved
  - Eye slope changes to create "^" shape
  - Mouth curves upward into smile
  - Overall face "lifts" slightly

### Scenario: Speaking animation

Given the face is in "speaking" state
Then the mouth oscillates between slightly open and more open
And the oscillation follows a pseudo-random pattern (not mechanical)
And eyes remain engaged (not dead stare)

## 6. Technical constraints

- Use `CustomPainter` for all rendering (no images/SVGs)
- Use multiple `AnimationController`s for independent animations
- Keep widget tree simple - minimize rebuilds
- Use `RepaintBoundary` around face widget
- Follow existing theme patterns from `lib/core/utils/theme.dart`
- No new dependencies required (use Flutter built-ins)
- Target 60fps - profile and optimize if needed

## 7. Implementation hints

### File Structure

```
lib/features/assistant/
├── assistant.dart                    # Feature exports
├── presentation/
│   ├── pages/
│   │   └── assistant_demo_page.dart  # Demo page with full controls
│   └── widgets/
│       ├── assistant_face_widget.dart
│       ├── painters/
│       │   ├── face_painter.dart
│       │   ├── eye_painter.dart
│       │   └── mouth_painter.dart
│       ├── controllers/
│       │   ├── emotion_controller.dart
│       │   ├── blink_controller.dart
│       │   └── look_controller.dart
│       └── models/
│           ├── emotion_preset.dart
│           ├── eye_config.dart
│           └── mouth_config.dart
```

### Eye Configuration Model (like esp32-eyes)

```dart
/// Configuration for a single eye's appearance
class EyeConfig {
  final double height;      // 0.0 = flat line, 1.0 = full circle
  final double width;       // Horizontal stretch factor
  final double slope;       // Rotation angle (-45° to +45°) for angry/skeptical
  final double offsetY;     // Vertical offset (for raised eyebrow effect)
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

  /// Interpolate between two eye configs
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

### Mouth Configuration Model

```dart
/// Configuration for mouth appearance
class MouthConfig {
  final double width;       // Mouth width as fraction of face
  final double height;      // Mouth height (0 = line, 1 = tall oval)
  final double curvature;   // -1.0 = frown, 0 = neutral, 1.0 = smile
  final double openness;    // 0 = closed, 1 = fully open
  final MouthShape shape;   // line, arc, oval, wide

  const MouthConfig({
    this.width = 0.4,
    this.height = 0.0,
    this.curvature = 0.0,
    this.openness = 0.0,
    this.shape = MouthShape.arc,
  });

  MouthConfig lerp(MouthConfig other, double t) { /* ... */ }
}

enum MouthShape { line, arc, oval, wide, wavy }
```

### Emotion Presets (12+ emotions)

```dart
/// Complete emotion preset with all face parameters
class EmotionPreset {
  final String name;
  final String emoji;
  final EyeConfig leftEye;
  final EyeConfig rightEye;  // Can differ for asymmetric expressions
  final MouthConfig mouth;
  final double faceOffsetY;  // Subtle vertical shift
  final Color? tint;         // Optional color tint

  const EmotionPreset({
    required this.name,
    required this.emoji,
    required this.leftEye,
    required this.rightEye,
    required this.mouth,
    this.faceOffsetY = 0.0,
    this.tint,
  });

  /// Symmetric preset (same config for both eyes)
  const EmotionPreset.symmetric({
    required this.name,
    required this.emoji,
    required EyeConfig eyes,
    required this.mouth,
    this.faceOffsetY = 0.0,
    this.tint,
  }) : leftEye = eyes, rightEye = eyes;
}

/// All emotion presets
class EmotionPresets {
  static const neutral = EmotionPreset.symmetric(
    name: 'Neutral',
    emoji: '😐',
    eyes: EyeConfig(height: 0.8, pupilSize: 0.5),
    mouth: MouthConfig(curvature: 0.0),
  );

  static const happy = EmotionPreset.symmetric(
    name: 'Happy',
    emoji: '😊',
    eyes: EyeConfig(height: 0.5, slope: 15, pupilSize: 0.4), // "^" shaped
    mouth: MouthConfig(curvature: 0.8, width: 0.5),
    faceOffsetY: -0.02,  // Slight lift
  );

  static const sad = EmotionPreset.symmetric(
    name: 'Sad',
    emoji: '😢',
    eyes: EyeConfig(height: 0.6, slope: -10, offsetY: 0.05, pupilY: 0.3),
    mouth: MouthConfig(curvature: -0.6, width: 0.3),
    faceOffsetY: 0.02,  // Slight droop
  );

  static const angry = EmotionPreset.symmetric(
    name: 'Angry',
    emoji: '😠',
    eyes: EyeConfig(height: 0.7, slope: -20, pupilSize: 0.3),
    mouth: MouthConfig(curvature: -0.3, width: 0.35, shape: MouthShape.line),
  );

  static const surprised = EmotionPreset.symmetric(
    name: 'Surprised',
    emoji: '😮',
    eyes: EyeConfig(height: 1.2, width: 1.1, pupilSize: 0.4),
    mouth: MouthConfig(openness: 0.7, shape: MouthShape.oval),
  );

  static const thinking = EmotionPreset(
    name: 'Thinking',
    emoji: '🤔',
    leftEye: EyeConfig(height: 0.7, pupilX: 0.5, pupilY: -0.4),
    rightEye: EyeConfig(height: 0.9, pupilX: 0.5, pupilY: -0.4),
    mouth: MouthConfig(curvature: -0.1, width: 0.25),
  );

  static const listening = EmotionPreset.symmetric(
    name: 'Listening',
    emoji: '👂',
    eyes: EyeConfig(height: 1.0, pupilSize: 0.55),
    mouth: MouthConfig(curvature: 0.1),
  );

  static const speaking = EmotionPreset.symmetric(
    name: 'Speaking',
    emoji: '💬',
    eyes: EyeConfig(height: 0.85, pupilSize: 0.5),
    mouth: MouthConfig(openness: 0.3, shape: MouthShape.oval),
  );

  static const sleepy = EmotionPreset.symmetric(
    name: 'Sleepy',
    emoji: '😴',
    eyes: EyeConfig(height: 0.2, slope: 5),
    mouth: MouthConfig(curvature: 0.0, openness: 0.1),
    faceOffsetY: 0.03,
  );

  static const excited = EmotionPreset.symmetric(
    name: 'Excited',
    emoji: '🤩',
    eyes: EyeConfig(height: 1.1, width: 1.1, pupilSize: 0.3, highlight: true),
    mouth: MouthConfig(curvature: 1.0, width: 0.55, openness: 0.2),
    faceOffsetY: -0.03,
  );

  static const confused = EmotionPreset(
    name: 'Confused',
    emoji: '😕',
    leftEye: EyeConfig(height: 0.9, slope: 10),
    rightEye: EyeConfig(height: 0.7, slope: -5),
    mouth: MouthConfig(shape: MouthShape.wavy, curvature: -0.2),
  );

  static const love = EmotionPreset.symmetric(
    name: 'Love',
    emoji: '😍',
    eyes: EyeConfig(height: 0.6, slope: 10, pupilSize: 0.7),  // Heart-like
    mouth: MouthConfig(curvature: 0.9, width: 0.45),
    tint: Color(0x20FF69B4),  // Subtle pink tint
  );

  static const all = [
    neutral, happy, sad, angry, surprised, thinking,
    listening, speaking, sleepy, excited, confused, love,
  ];
}
```

### Blink Controller

```dart
/// Controls automatic blinking behavior
class BlinkController extends ChangeNotifier {
  bool enabled = true;
  Timer? _blinkTimer;
  double _blinkProgress = 0.0;  // 0 = open, 1 = closed

  double get blinkProgress => _blinkProgress;

  void start() {
    _scheduleNextBlink();
  }

  void _scheduleNextBlink() {
    if (!enabled) return;
    // Random interval between 2-6 seconds
    final interval = Duration(milliseconds: 2000 + Random().nextInt(4000));
    _blinkTimer = Timer(interval, _doBlink);
  }

  Future<void> _doBlink() async {
    // Quick blink animation (~150ms total)
    for (var i = 0; i <= 10; i++) {
      _blinkProgress = i <= 5 ? i / 5.0 : (10 - i) / 5.0;
      notifyListeners();
      await Future.delayed(const Duration(milliseconds: 15));
    }
    _blinkProgress = 0.0;
    notifyListeners();
    _scheduleNextBlink();
  }

  void dispose() {
    _blinkTimer?.cancel();
    super.dispose();
  }
}
```

### Look Controller

```dart
/// Controls eye look direction with random wandering
class LookController extends ChangeNotifier {
  bool randomLookEnabled = true;
  double _lookX = 0.0;
  double _lookY = 0.0;
  Timer? _wanderTimer;

  double get lookX => _lookX;
  double get lookY => _lookY;

  void start() {
    _scheduleNextWander();
  }

  void _scheduleNextWander() {
    if (!randomLookEnabled) return;
    final interval = Duration(milliseconds: 1000 + Random().nextInt(3000));
    _wanderTimer = Timer(interval, _doWander);
  }

  Future<void> _doWander() async {
    // Pick random target within comfortable range
    final targetX = (Random().nextDouble() - 0.5) * 0.6;
    final targetY = (Random().nextDouble() - 0.5) * 0.4;

    // Smooth animation to target
    const steps = 20;
    final startX = _lookX;
    final startY = _lookY;

    for (var i = 0; i <= steps; i++) {
      final t = Curves.easeInOut.transform(i / steps);
      _lookX = lerpDouble(startX, targetX, t)!;
      _lookY = lerpDouble(startY, targetY, t)!;
      notifyListeners();
      await Future.delayed(const Duration(milliseconds: 25));
    }

    _scheduleNextWander();
  }

  /// Manually set look direction (for user interaction)
  void lookAt(double x, double y) {
    _lookX = x.clamp(-1.0, 1.0);
    _lookY = y.clamp(-1.0, 1.0);
    notifyListeners();
  }

  void dispose() {
    _wanderTimer?.cancel();
    super.dispose();
  }
}
```

### Eye Painter (detailed rendering)

```dart
class EyePainter {
  static void paint(
    Canvas canvas,
    Offset center,
    double baseRadius,
    EyeConfig config,
    double blinkProgress,
    Color primaryColor,
    Color backgroundColor,
  ) {
    // Apply blink (reduces height)
    final effectiveHeight = config.height * (1 - blinkProgress * 0.9);

    // Save canvas state for rotation (slope)
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(config.slope * pi / 180);

    // Calculate dimensions
    final eyeWidth = baseRadius * config.width;
    final eyeHeight = baseRadius * effectiveHeight;

    // Draw outer eye (white/light part)
    final eyeRect = Rect.fromCenter(
      center: Offset(0, config.offsetY * baseRadius),
      width: eyeWidth * 2,
      height: eyeHeight * 2,
    );

    final eyePaint = Paint()
      ..color = backgroundColor
      ..style = PaintingStyle.fill;

    canvas.drawOval(eyeRect, eyePaint);

    // Draw eye border
    final borderPaint = Paint()
      ..color = primaryColor.withOpacity(0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    canvas.drawOval(eyeRect, borderPaint);

    // Draw iris/pupil if eye is open enough
    if (effectiveHeight > 0.2) {
      final pupilRadius = baseRadius * config.pupilSize * effectiveHeight;
      final pupilOffset = Offset(
        config.pupilX * eyeWidth * 0.3,
        config.pupilY * eyeHeight * 0.3 + config.offsetY * baseRadius,
      );

      // Iris
      final irisPaint = Paint()
        ..color = primaryColor
        ..style = PaintingStyle.fill;

      canvas.drawCircle(pupilOffset, pupilRadius, irisPaint);

      // Pupil (darker center)
      final pupilPaint = Paint()
        ..color = primaryColor.withOpacity(0.8)
        ..style = PaintingStyle.fill;

      canvas.drawCircle(pupilOffset, pupilRadius * 0.5, pupilPaint);

      // Highlight (specular reflection)
      if (config.highlight && effectiveHeight > 0.5) {
        final highlightPaint = Paint()
          ..color = Colors.white.withOpacity(0.8)
          ..style = PaintingStyle.fill;

        canvas.drawCircle(
          pupilOffset + Offset(-pupilRadius * 0.3, -pupilRadius * 0.3),
          pupilRadius * 0.25,
          highlightPaint,
        );
      }
    }

    canvas.restore();
  }
}
```

### Demo Page with Full Controls

```dart
class AssistantDemoPage extends StatefulWidget {
  @override
  State<AssistantDemoPage> createState() => _AssistantDemoPageState();
}

class _AssistantDemoPageState extends State<AssistantDemoPage> {
  EmotionPreset _currentEmotion = EmotionPresets.neutral;
  bool _blinkEnabled = true;
  bool _lookEnabled = true;
  bool _autoDemo = false;
  double _transitionSpeed = 1.0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Assistant Face Demo')),
      body: Column(
        children: [
          // Face widget (large, centered)
          Expanded(
            flex: 3,
            child: GestureDetector(
              onPanUpdate: (details) {
                // Manual look control by dragging on face
                // Convert drag position to -1..1 range
              },
              child: AssistantFaceWidget(
                emotion: _currentEmotion,
                blinkEnabled: _blinkEnabled,
                lookEnabled: _lookEnabled,
                transitionDuration: Duration(
                  milliseconds: (400 / _transitionSpeed).round(),
                ),
              ),
            ),
          ),

          // Current emotion display
          Text(
            '${_currentEmotion.emoji} ${_currentEmotion.name}',
            style: Theme.of(context).textTheme.headlineSmall,
          ),

          // Controls
          Padding(
            padding: const EdgeInsets.all(8),
            child: Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: const Text('Blink'),
                  selected: _blinkEnabled,
                  onSelected: (v) => setState(() => _blinkEnabled = v),
                ),
                FilterChip(
                  label: const Text('Look Around'),
                  selected: _lookEnabled,
                  onSelected: (v) => setState(() => _lookEnabled = v),
                ),
                ActionChip(
                  label: Text(_autoDemo ? 'Stop' : 'Auto Demo'),
                  onPressed: () => setState(() => _autoDemo = !_autoDemo),
                ),
              ],
            ),
          ),

          // Speed slider
          Slider(
            value: _transitionSpeed,
            min: 0.5,
            max: 2.0,
            label: 'Speed: ${_transitionSpeed.toStringAsFixed(1)}x',
            onChanged: (v) => setState(() => _transitionSpeed = v),
          ),

          // Emotion grid
          Expanded(
            flex: 2,
            child: GridView.count(
              crossAxisCount: 4,
              padding: const EdgeInsets.all(8),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              children: EmotionPresets.all.map((preset) {
                final isSelected = preset == _currentEmotion;
                return InkWell(
                  onTap: () => setState(() => _currentEmotion = preset),
                  child: Container(
                    decoration: BoxDecoration(
                      color: isSelected
                          ? Theme.of(context).colorScheme.primaryContainer
                          : null,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isSelected
                            ? Theme.of(context).colorScheme.primary
                            : Colors.grey.withOpacity(0.3),
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(preset.emoji, style: const TextStyle(fontSize: 24)),
                        Text(preset.name, style: const TextStyle(fontSize: 10)),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
```

## 8. AI instructions (for Junie / AI)

- **Quality is paramount** - match EchoEar animation quality
- Study esp32-eyes repository for animation inspiration
- Start with eye rendering - get one eye perfect before duplicating
- Test blinking animation extensively - it's the most noticeable detail
- Smooth transitions are critical - use proper interpolation
- Profile on real hardware - 60fps is mandatory
- The face should feel "alive" - never static or mechanical
- Iterate visually with hot reload
- Get feedback on emotion distinctiveness

### Implementation Order

1. Basic eye rendering with EyeConfig
2. Mouth rendering with MouthConfig
3. Static emotion presets
4. Emotion interpolation/transitions
5. Blink controller
6. Look controller
7. Demo page
8. Polish and optimize

### Key Metrics

- Blink should feel natural (2-6s random interval, ~150ms duration)
- Eye wander should be subtle (not distracting)
- Transitions should be smooth (no stuttering)
- Each emotion must be instantly recognizable

### Visual Reference

```
NEUTRAL     HAPPY       SAD         ANGRY
  ◉   ◉       ◠   ◠      ◡   ◡       ╲◉ ◉╱
    ─           ⌣          ︵           ─

SURPRISED   THINKING    SLEEPY      EXCITED
  ⊙   ⊙       ◉   ◑      ─   ─       ✧   ✧
    ○           ~          ~           ◡
```
