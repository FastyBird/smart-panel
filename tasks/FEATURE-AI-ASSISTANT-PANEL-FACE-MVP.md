# Task: AI Assistant Face Widget MVP (Static Demo)
ID: FEATURE-AI-ASSISTANT-PANEL-FACE-MVP
Type: feature
Scope: panel
Size: small
Parent: FEATURE-AI-ASSISTANT-PANEL-FACE
Status: planned

## 1. Business goal

In order to validate the visual design and animation quality of the assistant face
As a developer
I want to create a standalone face widget with all emotions that can be demonstrated without backend integration

## 2. Context

- This is the MVP/first step before full assistant integration
- Focus on visual polish and animation smoothness
- Should work as a standalone demo page accessible from settings
- No WebSocket, no voice, no backend - just animated face
- Can be used to gather feedback on visual design
- Reference: ESP32 EchoEar, XiaoZhi AI emotion display

### Design Reference

The face should be simple but expressive:
- Large circular or rounded face area
- Two eyes (circles/ovals that can animate)
- Simple mouth (arc/line that can curve)
- Minimal but effective - think emoji style 😊😔🤔😮😴

## 3. Scope

**In scope**

- `AssistantFaceWidget` using CustomPaint
- `FacePainter` with all emotion states
- `EmotionController` for smooth transitions
- Demo page with emotion selector buttons
- Auto-cycle mode to showcase all emotions
- Idle animation (subtle breathing/blinking)
- Theme support (light/dark colors)
- Touch gesture to cycle emotions (for demo)

**Out of scope**

- Voice integration
- Backend communication
- Wake word detection
- Conversation display
- Sound/audio feedback
- Settings persistence

## 4. Acceptance criteria

- [ ] Face renders with eyes and mouth using CustomPaint
- [ ] 7 emotion states implemented: idle, listening, thinking, happy, surprised, sorry, speaking
- [ ] Smooth transitions between emotions (300-500ms ease)
- [ ] Idle state has subtle animation (breathing effect or slow blink)
- [ ] Demo page accessible from panel settings menu
- [ ] Demo page has buttons to trigger each emotion
- [ ] "Auto Demo" button cycles through all emotions
- [ ] Face scales properly to container size
- [ ] Works with both light and dark themes
- [ ] Animations run at 60fps on Raspberry Pi 4
- [ ] Tap on face cycles to next emotion

## 5. Example scenarios

### Scenario: View demo page

Given the panel app is running
When the user navigates to Settings > Assistant Demo
Then the face widget is displayed centered on screen
And emotion selector buttons appear below the face
And the face shows idle animation

### Scenario: Trigger emotion

Given the demo page is displayed
When the user taps the "Happy" button
Then the face smoothly transitions from current state to happy
And the happy expression shows curved smile and bright eyes

### Scenario: Auto demo mode

Given the demo page is displayed
When the user taps "Auto Demo" button
Then the face cycles through all emotions
And each emotion displays for 2 seconds
And transitions are smooth between each

## 6. Technical constraints

- Use `CustomPainter` for all rendering (no images)
- Use `AnimationController` with `TickerProviderStateMixin`
- Keep widget tree simple - minimize rebuilds
- Use `RepaintBoundary` around face widget
- Follow existing theme patterns from `lib/core/utils/theme.dart`
- Add route to existing settings navigation
- No new dependencies required (use Flutter built-ins)

## 7. Implementation hints

### File Structure

```
lib/features/assistant/
├── assistant.dart                    # Feature exports
├── presentation/
│   ├── pages/
│   │   └── assistant_demo_page.dart  # Demo page with controls
│   └── widgets/
│       ├── assistant_face_widget.dart
│       ├── face_painter.dart
│       └── emotion_state.dart
```

### Emotion State

```dart
// emotion_state.dart
enum EmotionState {
  idle,      // 😴 Relaxed, occasional blink
  listening, // 🎵 Alert, possibly sound waves
  thinking,  // 🤔 Eyes looking up/around
  happy,     // 😊 Smile, curved eyes
  surprised, // 😮 Wide eyes, open mouth
  sorry,     // 😔 Sad eyes, down mouth
  speaking,  // 💬 Animated mouth
}

extension EmotionStateExtension on EmotionState {
  String get label => switch (this) {
    EmotionState.idle => 'Idle',
    EmotionState.listening => 'Listening',
    EmotionState.thinking => 'Thinking',
    EmotionState.happy => 'Happy',
    EmotionState.surprised => 'Surprised',
    EmotionState.sorry => 'Sorry',
    EmotionState.speaking => 'Speaking',
  };

  String get emoji => switch (this) {
    EmotionState.idle => '😴',
    EmotionState.listening => '🎵',
    EmotionState.thinking => '🤔',
    EmotionState.happy => '😊',
    EmotionState.surprised => '😮',
    EmotionState.sorry => '😔',
    EmotionState.speaking => '💬',
  };
}
```

### Face Widget

```dart
// assistant_face_widget.dart
class AssistantFaceWidget extends StatefulWidget {
  final EmotionState emotion;
  final VoidCallback? onTap;
  final Color? primaryColor;
  final Color? backgroundColor;

  const AssistantFaceWidget({
    super.key,
    this.emotion = EmotionState.idle,
    this.onTap,
    this.primaryColor,
    this.backgroundColor,
  });

  @override
  State<AssistantFaceWidget> createState() => _AssistantFaceWidgetState();
}

class _AssistantFaceWidgetState extends State<AssistantFaceWidget>
    with TickerProviderStateMixin {
  late AnimationController _transitionController;
  late AnimationController _idleController;
  late Animation<double> _transitionAnimation;

  EmotionState _previousEmotion = EmotionState.idle;
  EmotionState _currentEmotion = EmotionState.idle;

  @override
  void initState() {
    super.initState();
    _currentEmotion = widget.emotion;

    _transitionController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );

    _transitionAnimation = CurvedAnimation(
      parent: _transitionController,
      curve: Curves.easeInOut,
    );

    _idleController = AnimationController(
      duration: const Duration(milliseconds: 3000),
      vsync: this,
    )..repeat(reverse: true);
  }

  @override
  void didUpdateWidget(AssistantFaceWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.emotion != widget.emotion) {
      _previousEmotion = _currentEmotion;
      _currentEmotion = widget.emotion;
      _transitionController.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _transitionController.dispose();
    _idleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: widget.onTap,
      child: RepaintBoundary(
        child: AnimatedBuilder(
          animation: Listenable.merge([_transitionAnimation, _idleController]),
          builder: (context, child) {
            return CustomPaint(
              painter: FacePainter(
                previousEmotion: _previousEmotion,
                currentEmotion: _currentEmotion,
                transitionProgress: _transitionAnimation.value,
                idleProgress: _idleController.value,
                primaryColor: widget.primaryColor ?? theme.colorScheme.primary,
                backgroundColor: widget.backgroundColor ?? theme.colorScheme.surface,
              ),
              child: const SizedBox.expand(),
            );
          },
        ),
      ),
    );
  }
}
```

### Face Painter

```dart
// face_painter.dart
class FacePainter extends CustomPainter {
  final EmotionState previousEmotion;
  final EmotionState currentEmotion;
  final double transitionProgress;
  final double idleProgress;
  final Color primaryColor;
  final Color backgroundColor;

  FacePainter({
    required this.previousEmotion,
    required this.currentEmotion,
    required this.transitionProgress,
    required this.idleProgress,
    required this.primaryColor,
    required this.backgroundColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = min(size.width, size.height) / 2 * 0.85;

    // Draw face background
    _drawFaceBackground(canvas, center, radius);

    // Interpolate between previous and current emotion
    final eyeParams = _interpolateEyes(transitionProgress);
    final mouthParams = _interpolateMouth(transitionProgress);

    // Apply idle animation
    final idleOffset = sin(idleProgress * pi * 2) * 2;

    // Draw eyes
    _drawEyes(canvas, center, radius, eyeParams, idleOffset);

    // Draw mouth
    _drawMouth(canvas, center, radius, mouthParams);

    // Draw extras (sound waves for listening, dots for thinking)
    _drawExtras(canvas, center, radius);
  }

  void _drawFaceBackground(Canvas canvas, Offset center, double radius) {
    final paint = Paint()
      ..color = backgroundColor
      ..style = PaintingStyle.fill;

    canvas.drawCircle(center, radius, paint);

    // Optional: subtle border
    final borderPaint = Paint()
      ..color = primaryColor.withOpacity(0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    canvas.drawCircle(center, radius, borderPaint);
  }

  void _drawEyes(Canvas canvas, Offset center, double radius,
      EyeParams params, double idleOffset) {
    final eyePaint = Paint()
      ..color = primaryColor
      ..style = PaintingStyle.fill;

    final eyeRadius = radius * 0.12;
    final eyeSpacing = radius * 0.35;
    final eyeY = center.dy - radius * 0.15 + idleOffset;

    // Left eye
    final leftEyeCenter = Offset(center.dx - eyeSpacing, eyeY);
    _drawEye(canvas, leftEyeCenter, eyeRadius, params, eyePaint);

    // Right eye
    final rightEyeCenter = Offset(center.dx + eyeSpacing, eyeY);
    _drawEye(canvas, rightEyeCenter, eyeRadius, params, eyePaint);
  }

  void _drawEye(Canvas canvas, Offset center, double radius,
      EyeParams params, Paint paint) {
    // openness: 0 = closed (line), 1 = fully open (circle)
    if (params.openness < 0.1) {
      // Closed eye - draw arc/line
      final path = Path();
      path.moveTo(center.dx - radius, center.dy);
      path.quadraticBezierTo(
        center.dx,
        center.dy + radius * 0.5,
        center.dx + radius,
        center.dy,
      );
      canvas.drawPath(
        path,
        paint..style = PaintingStyle.stroke..strokeWidth = 3,
      );
    } else {
      // Open eye - draw oval based on openness
      final rect = Rect.fromCenter(
        center: center,
        width: radius * 2,
        height: radius * 2 * params.openness,
      );
      canvas.drawOval(rect, paint..style = PaintingStyle.fill);

      // Pupil
      if (params.openness > 0.5) {
        final pupilPaint = Paint()..color = backgroundColor;
        canvas.drawCircle(
          center.translate(params.lookX * radius * 0.3, params.lookY * radius * 0.3),
          radius * 0.4 * params.openness,
          pupilPaint,
        );
      }
    }
  }

  void _drawMouth(Canvas canvas, Offset center, double radius, MouthParams params) {
    final mouthPaint = Paint()
      ..color = primaryColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    final mouthY = center.dy + radius * 0.35;
    final mouthWidth = radius * 0.5;

    final path = Path();

    // curvature: -1 = sad, 0 = neutral, 1 = happy
    // openness: 0 = closed, 1 = open (surprised)

    if (params.openness > 0.5) {
      // Open mouth (surprised/speaking)
      final rect = Rect.fromCenter(
        center: Offset(center.dx, mouthY),
        width: mouthWidth * params.openness,
        height: mouthWidth * params.openness * 0.8,
      );
      canvas.drawOval(rect, mouthPaint..style = PaintingStyle.fill);
    } else {
      // Curved mouth line
      path.moveTo(center.dx - mouthWidth, mouthY);
      path.quadraticBezierTo(
        center.dx,
        mouthY + mouthWidth * params.curvature,
        center.dx + mouthWidth,
        mouthY,
      );
      canvas.drawPath(path, mouthPaint);
    }
  }

  EyeParams _interpolateEyes(double t) {
    final from = _getEyeParams(previousEmotion);
    final to = _getEyeParams(currentEmotion);
    return EyeParams(
      openness: lerpDouble(from.openness, to.openness, t)!,
      lookX: lerpDouble(from.lookX, to.lookX, t)!,
      lookY: lerpDouble(from.lookY, to.lookY, t)!,
    );
  }

  EyeParams _getEyeParams(EmotionState emotion) => switch (emotion) {
    EmotionState.idle => EyeParams(openness: 0.3, lookX: 0, lookY: 0),
    EmotionState.listening => EyeParams(openness: 1.0, lookX: 0, lookY: 0),
    EmotionState.thinking => EyeParams(openness: 0.8, lookX: 0.5, lookY: -0.5),
    EmotionState.happy => EyeParams(openness: 0.6, lookX: 0, lookY: 0),
    EmotionState.surprised => EyeParams(openness: 1.2, lookX: 0, lookY: 0),
    EmotionState.sorry => EyeParams(openness: 0.7, lookX: 0, lookY: 0.3),
    EmotionState.speaking => EyeParams(openness: 0.9, lookX: 0, lookY: 0),
  };

  MouthParams _interpolateMouth(double t) {
    final from = _getMouthParams(previousEmotion);
    final to = _getMouthParams(currentEmotion);
    return MouthParams(
      curvature: lerpDouble(from.curvature, to.curvature, t)!,
      openness: lerpDouble(from.openness, to.openness, t)!,
    );
  }

  MouthParams _getMouthParams(EmotionState emotion) => switch (emotion) {
    EmotionState.idle => MouthParams(curvature: 0.1, openness: 0),
    EmotionState.listening => MouthParams(curvature: 0.2, openness: 0),
    EmotionState.thinking => MouthParams(curvature: 0, openness: 0.1),
    EmotionState.happy => MouthParams(curvature: 0.8, openness: 0),
    EmotionState.surprised => MouthParams(curvature: 0, openness: 0.8),
    EmotionState.sorry => MouthParams(curvature: -0.6, openness: 0),
    EmotionState.speaking => MouthParams(curvature: 0.2, openness: 0.4),
  };

  @override
  bool shouldRepaint(FacePainter oldDelegate) =>
      oldDelegate.transitionProgress != transitionProgress ||
      oldDelegate.idleProgress != idleProgress ||
      oldDelegate.currentEmotion != currentEmotion;
}

class EyeParams {
  final double openness;  // 0 = closed, 1 = normal, >1 = wide
  final double lookX;     // -1 = left, 1 = right
  final double lookY;     // -1 = up, 1 = down

  EyeParams({required this.openness, required this.lookX, required this.lookY});
}

class MouthParams {
  final double curvature;  // -1 = sad, 0 = neutral, 1 = happy
  final double openness;   // 0 = closed, 1 = open

  MouthParams({required this.curvature, required this.openness});
}
```

### Demo Page

```dart
// assistant_demo_page.dart
class AssistantDemoPage extends StatefulWidget {
  const AssistantDemoPage({super.key});

  @override
  State<AssistantDemoPage> createState() => _AssistantDemoPageState();
}

class _AssistantDemoPageState extends State<AssistantDemoPage> {
  EmotionState _currentEmotion = EmotionState.idle;
  bool _autoDemo = false;
  Timer? _autoDemoTimer;

  void _setEmotion(EmotionState emotion) {
    setState(() {
      _currentEmotion = emotion;
      _autoDemo = false;
      _autoDemoTimer?.cancel();
    });
  }

  void _toggleAutoDemo() {
    setState(() {
      _autoDemo = !_autoDemo;
      if (_autoDemo) {
        _startAutoDemo();
      } else {
        _autoDemoTimer?.cancel();
      }
    });
  }

  void _startAutoDemo() {
    int index = 0;
    _autoDemoTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
      setState(() {
        _currentEmotion = EmotionState.values[index];
        index = (index + 1) % EmotionState.values.length;
      });
    });
  }

  void _nextEmotion() {
    final nextIndex = (EmotionState.values.indexOf(_currentEmotion) + 1)
        % EmotionState.values.length;
    _setEmotion(EmotionState.values[nextIndex]);
  }

  @override
  void dispose() {
    _autoDemoTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Assistant Face Demo'),
      ),
      body: Column(
        children: [
          // Face display area
          Expanded(
            flex: 2,
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: AssistantFaceWidget(
                emotion: _currentEmotion,
                onTap: _nextEmotion,
              ),
            ),
          ),

          // Current emotion indicator
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              '${_currentEmotion.emoji} ${_currentEmotion.label}',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ),

          // Emotion buttons
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: [
                  for (final emotion in EmotionState.values)
                    ElevatedButton(
                      onPressed: () => _setEmotion(emotion),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _currentEmotion == emotion
                            ? Theme.of(context).colorScheme.primary
                            : null,
                      ),
                      child: Text('${emotion.emoji} ${emotion.label}'),
                    ),
                ],
              ),
            ),
          ),

          // Auto demo button
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton.icon(
              onPressed: _toggleAutoDemo,
              icon: Icon(_autoDemo ? Icons.stop : Icons.play_arrow),
              label: Text(_autoDemo ? 'Stop Demo' : 'Auto Demo'),
            ),
          ),
        ],
      ),
    );
  }
}
```

### Route Registration

```dart
// Add to app/routes.dart
static const String assistantDemo = '/settings/assistant-demo';

// Add route
GoRoute(
  path: 'assistant-demo',
  builder: (context, state) => const AssistantDemoPage(),
),
```

### Settings Menu Entry

```dart
// Add to settings page list
ListTile(
  leading: const Icon(Icons.face),
  title: const Text('Assistant Face Demo'),
  subtitle: const Text('Preview face animations'),
  trailing: const Icon(Icons.chevron_right),
  onTap: () => context.push(AppRoutes.assistantDemo),
),
```

## 8. AI instructions (for Junie / AI)

- This is the MVP - keep it simple and focused
- Start with static face rendering (no animation)
- Add idle animation first (easiest to verify)
- Add emotion transitions one at a time
- Test each emotion visually before moving on
- Use hot reload extensively for visual iteration
- Performance is important - profile on real hardware if possible
- The face should feel "alive" even in idle state
- Keep the code clean - this will be extended later
- No backend integration - everything is local state
