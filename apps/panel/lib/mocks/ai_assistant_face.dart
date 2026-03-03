import 'package:flutter/material.dart';
import 'dart:math' as math;

// ============================================================================
// THEME
// ============================================================================

class AssistantTheme {
  static const Color bgDark = Color(0xFF1A1A1A);
  static const Color cardDark = Color(0xFF2A2A2A);
  static const Color borderDark = Color(0xFF3A3A3A);
  static const Color textLight = Color(0xFFFFFFFF);
  static const Color textMuted = Color(0xFF9E9E9E);

  // AI accent colors - warm coral/orange
  static const Color primary = Color(0xFFE85A4F);
  static const Color primaryLight = Color(0x26E85A4F);
  static const Color secondary = Color(0xFFFF8A65);

  static const Color success = Color(0xFF66BB6A);
  static const Color error = Color(0xFFEF5350);
  static const Color warning = Color(0xFFFFCA28);

  static const Gradient primaryGradient = LinearGradient(
    colors: [primary, secondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

// ============================================================================
// FACE EXPRESSION STATES
// ============================================================================

enum EyeState {
  sleepy,    // Half-closed, idle
  blink,     // Natural blinking
  listening, // Pulsing, attentive
  thinking,  // Looking around
  happy,     // Curved, smiling
  surprised, // Wide open
  sad,       // Tilted down
}

enum MouthState {
  neutral,   // Small line
  listening, // Wavy animation
  thinking,  // Small 'o', shifting
  speaking,  // Animated oval
  happy,     // Curved smile
  surprised, // Big 'O'
  sad,       // Inverted curve
}

class FaceExpression {
  final EyeState eyes;
  final MouthState mouth;
  final bool glowing;

  const FaceExpression({
    required this.eyes,
    required this.mouth,
    this.glowing = false,
  });

  static const idle = FaceExpression(
    eyes: EyeState.sleepy,
    mouth: MouthState.neutral,
  );

  static const awake = FaceExpression(
    eyes: EyeState.blink,
    mouth: MouthState.neutral,
  );

  static const listening = FaceExpression(
    eyes: EyeState.listening,
    mouth: MouthState.listening,
    glowing: true,
  );

  static const thinking = FaceExpression(
    eyes: EyeState.thinking,
    mouth: MouthState.thinking,
  );

  static const speaking = FaceExpression(
    eyes: EyeState.blink,
    mouth: MouthState.speaking,
  );

  static const happy = FaceExpression(
    eyes: EyeState.happy,
    mouth: MouthState.happy,
  );

  static const surprised = FaceExpression(
    eyes: EyeState.surprised,
    mouth: MouthState.surprised,
  );

  static const confused = FaceExpression(
    eyes: EyeState.sad,
    mouth: MouthState.sad,
  );
}

// ============================================================================
// ANIMATED FACE WIDGET
// ============================================================================

class AnimatedFace extends StatefulWidget {
  final FaceExpression expression;
  final double size;

  const AnimatedFace({
    super.key,
    required this.expression,
    this.size = 200,
  });

  @override
  State<AnimatedFace> createState() => _AnimatedFaceState();
}

class _AnimatedFaceState extends State<AnimatedFace> with TickerProviderStateMixin {
  late AnimationController _blinkController;
  late AnimationController _pulseController;
  late AnimationController _lookController;
  late AnimationController _speakController;
  late AnimationController _glowController;

  @override
  void initState() {
    super.initState();
    
    _blinkController = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    )..repeat(reverse: true);
    
    _lookController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat(reverse: true);
    
    _speakController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    )..repeat(reverse: true);
    
    _glowController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
    
    // Start random blinking
    _startBlinking();
  }

  void _startBlinking() async {
    while (mounted) {
      await Future.delayed(Duration(milliseconds: 2000 + (math.Random().nextInt(2000))));
      if (mounted && widget.expression.eyes == EyeState.blink) {
        await _blinkController.forward();
        await _blinkController.reverse();
      }
    }
  }

  @override
  void dispose() {
    _blinkController.dispose();
    _pulseController.dispose();
    _lookController.dispose();
    _speakController.dispose();
    _glowController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_glowController, _pulseController]),
      builder: (context, child) {
        return Stack(
          alignment: Alignment.center,
          children: [
            // Glow ring (when listening)
            if (widget.expression.glowing)
              Container(
                width: widget.size + 24,
                height: widget.size + 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AssistantTheme.primary.withOpacity(0.3 + _glowController.value * 0.3),
                    width: 2,
                  ),
                ),
              ),
            
            // Face circle
            Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                color: AssistantTheme.cardDark,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AssistantTheme.primary.withOpacity(
                      widget.expression.glowing ? 0.3 + _glowController.value * 0.2 : 0.2
                    ),
                    blurRadius: 40,
                    spreadRadius: 5,
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Eyes
                  Positioned(
                    top: widget.size * 0.3,
                    child: _buildEyes(),
                  ),
                  // Mouth
                  Positioned(
                    bottom: widget.size * 0.25,
                    child: _buildMouth(),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildEyes() {
    final eyeSize = widget.size * 0.16;
    final eyeGap = widget.size * 0.2;
    
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildEye(eyeSize, isLeft: true),
        SizedBox(width: eyeGap),
        _buildEye(eyeSize, isLeft: false),
      ],
    );
  }

  Widget _buildEye(double size, {required bool isLeft}) {
    final state = widget.expression.eyes;
    
    return AnimatedBuilder(
      animation: Listenable.merge([_blinkController, _pulseController, _lookController]),
      builder: (context, child) {
        double scaleY = 1.0;
        double scaleX = 1.0;
        double offsetX = 0.0;
        double offsetY = 0.0;
        double rotation = 0.0;
        BorderRadius borderRadius = BorderRadius.circular(size);
        
        switch (state) {
          case EyeState.sleepy:
            scaleY = 0.25;
            break;
          case EyeState.blink:
            scaleY = 1.0 - (_blinkController.value * 0.9);
            break;
          case EyeState.listening:
            scaleX = 1.0 + (_pulseController.value * 0.1);
            scaleY = 1.0 + (_pulseController.value * 0.1);
            break;
          case EyeState.thinking:
            offsetX = (_lookController.value - 0.5) * 8;
            offsetY = (math.sin(_lookController.value * math.pi) - 0.5) * 4;
            break;
          case EyeState.happy:
            scaleY = 0.5;
            borderRadius = BorderRadius.only(
              topLeft: Radius.circular(size),
              topRight: Radius.circular(size),
              bottomLeft: Radius.circular(size * 0.5),
              bottomRight: Radius.circular(size * 0.5),
            );
            break;
          case EyeState.surprised:
            scaleX = 1.25;
            scaleY = 1.25;
            break;
          case EyeState.sad:
            rotation = isLeft ? -0.2 : 0.2;
            break;
        }
        
        return Transform.translate(
          offset: Offset(offsetX, offsetY),
          child: Transform.rotate(
            angle: rotation,
            child: Transform.scale(
              scaleX: scaleX,
              scaleY: scaleY,
              child: Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: AssistantTheme.primary,
                  borderRadius: borderRadius,
                  boxShadow: [
                    BoxShadow(
                      color: AssistantTheme.primary.withOpacity(0.5),
                      blurRadius: 15,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Align(
                  alignment: const Alignment(0.4, -0.4),
                  child: Container(
                    width: size * 0.3,
                    height: size * 0.3,
                    decoration: BoxDecoration(
                      color: AssistantTheme.secondary.withOpacity(0.8),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildMouth() {
    final state = widget.expression.mouth;
    final baseWidth = widget.size * 0.2;
    final baseHeight = widget.size * 0.1;
    
    return AnimatedBuilder(
      animation: Listenable.merge([_speakController, _lookController]),
      builder: (context, child) {
        switch (state) {
          case MouthState.neutral:
            return Container(
              width: baseWidth,
              height: 4,
              decoration: BoxDecoration(
                color: AssistantTheme.primary,
                borderRadius: BorderRadius.circular(2),
                boxShadow: [
                  BoxShadow(
                    color: AssistantTheme.primary.withOpacity(0.3),
                    blurRadius: 8,
                  ),
                ],
              ),
            );
            
          case MouthState.listening:
            return Transform.scaleX(
              scaleX: 0.8 + (_speakController.value * 0.4),
              child: Container(
                width: baseWidth * 1.5,
                height: 5,
                decoration: BoxDecoration(
                  color: AssistantTheme.primary,
                  borderRadius: BorderRadius.circular(2),
                  boxShadow: [
                    BoxShadow(
                      color: AssistantTheme.primary.withOpacity(0.3),
                      blurRadius: 8,
                    ),
                  ],
                ),
              ),
            );
            
          case MouthState.thinking:
            return Transform.translate(
              offset: Offset((_lookController.value - 0.5) * 8, 0),
              child: Transform.scale(
                scale: 0.8 + (_lookController.value * 0.2),
                child: Container(
                  width: baseWidth * 0.6,
                  height: baseWidth * 0.6,
                  decoration: BoxDecoration(
                    color: AssistantTheme.primary,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AssistantTheme.primary.withOpacity(0.3),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                ),
              ),
            );
            
          case MouthState.speaking:
            return Transform.scaleY(
              scaleY: 0.6 + (_speakController.value * 0.4),
              child: Container(
                width: baseWidth * 0.8,
                height: baseHeight * 1.2,
                decoration: BoxDecoration(
                  color: AssistantTheme.primary,
                  borderRadius: BorderRadius.circular(baseWidth),
                  boxShadow: [
                    BoxShadow(
                      color: AssistantTheme.primary.withOpacity(0.3),
                      blurRadius: 8,
                    ),
                  ],
                ),
              ),
            );
            
          case MouthState.happy:
            return CustomPaint(
              size: Size(baseWidth * 1.4, baseHeight),
              painter: _SmilePainter(color: AssistantTheme.primary),
            );
            
          case MouthState.surprised:
            return Container(
              width: baseWidth * 0.8,
              height: baseWidth * 0.8,
              decoration: BoxDecoration(
                color: AssistantTheme.primary,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AssistantTheme.primary.withOpacity(0.3),
                    blurRadius: 8,
                  ),
                ],
              ),
            );
            
          case MouthState.sad:
            return CustomPaint(
              size: Size(baseWidth * 1.2, baseHeight * 0.8),
              painter: _FrownPainter(color: AssistantTheme.primary),
            );
        }
      },
    );
  }
}

class _SmilePainter extends CustomPainter {
  final Color color;
  
  _SmilePainter({required this.color});
  
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    
    final path = Path();
    path.moveTo(0, size.height * 0.3);
    path.quadraticBezierTo(
      size.width / 2, size.height * 1.2,
      size.width, size.height * 0.3,
    );
    
    canvas.drawPath(path, paint);
  }
  
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _FrownPainter extends CustomPainter {
  final Color color;
  
  _FrownPainter({required this.color});
  
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    
    final path = Path();
    path.moveTo(0, size.height * 0.7);
    path.quadraticBezierTo(
      size.width / 2, -size.height * 0.2,
      size.width, size.height * 0.7,
    );
    
    canvas.drawPath(path, paint);
  }
  
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ============================================================================
// VOICE WAVEFORM
// ============================================================================

class VoiceWaveform extends StatefulWidget {
  final bool isActive;
  final Color color;

  const VoiceWaveform({
    super.key,
    this.isActive = true,
    this.color = AssistantTheme.primary,
  });

  @override
  State<VoiceWaveform> createState() => _VoiceWaveformState();
}

class _VoiceWaveformState extends State<VoiceWaveform> with TickerProviderStateMixin {
  late List<AnimationController> _controllers;
  final int _barCount = 7;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(_barCount, (index) {
      final controller = AnimationController(
        duration: Duration(milliseconds: 600 + (index * 100)),
        vsync: this,
      );
      if (widget.isActive) {
        controller.repeat(reverse: true);
      }
      return controller;
    });
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 32,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(_barCount, (index) {
          return AnimatedBuilder(
            animation: _controllers[index],
            builder: (context, child) {
              final heights = [16.0, 28.0, 20.0, 32.0, 24.0, 28.0, 16.0];
              return Container(
                width: 4,
                height: heights[index] * (0.5 + _controllers[index].value * 0.5),
                margin: const EdgeInsets.symmetric(horizontal: 2),
                decoration: BoxDecoration(
                  color: widget.color,
                  borderRadius: BorderRadius.circular(2),
                ),
              );
            },
          );
        }),
      ),
    );
  }
}

// ============================================================================
// IDLE DISPLAY WITH FACE
// ============================================================================

class IdleDisplayWithFace extends StatelessWidget {
  final VoidCallback? onTap;

  const IdleDisplayWithFace({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final timeStr = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final dateStr = '${days[now.weekday % 7]}, ${months[now.month - 1]} ${now.day}';

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        color: AssistantTheme.bgDark,
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const AnimatedFace(
                    expression: FaceExpression.idle,
                    size: 200,
                  ),
                  const SizedBox(height: 32),
                  Text(
                    timeStr,
                    style: const TextStyle(
                      fontSize: 64,
                      fontWeight: FontWeight.w200,
                      color: AssistantTheme.textLight,
                      letterSpacing: -2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$dateStr • Partly Cloudy 22°C',
                    style: const TextStyle(
                      fontSize: 16,
                      color: AssistantTheme.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            // Wake hint
            Positioned(
              left: 0,
              right: 0,
              bottom: 32,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withOpacity(0.1)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.mic, color: AssistantTheme.primary, size: 16),
                      SizedBox(width: 8),
                      Text(
                        'Say ',
                        style: TextStyle(color: AssistantTheme.textMuted, fontSize: 13),
                      ),
                      Text(
                        '"Hey Panel"',
                        style: TextStyle(
                          color: AssistantTheme.primary,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      Text(
                        ' or tap to wake',
                        style: TextStyle(color: AssistantTheme.textMuted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// LISTENING DISPLAY WITH FACE
// ============================================================================

class ListeningDisplayWithFace extends StatelessWidget {
  final String? transcribedText;
  final VoidCallback? onCancel;

  const ListeningDisplayWithFace({
    super.key,
    this.transcribedText,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AssistantTheme.bgDark,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const AnimatedFace(
            expression: FaceExpression.listening,
            size: 200,
          ),
          const SizedBox(height: 24),
          if (transcribedText != null && transcribedText!.isNotEmpty) ...[
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 40),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              decoration: BoxDecoration(
                color: AssistantTheme.primary,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '"$transcribedText"',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ] else ...[
            const Text(
              'Listening...',
              style: TextStyle(
                color: AssistantTheme.textLight,
                fontSize: 20,
                fontWeight: FontWeight.w300,
              ),
            ),
          ],
          const SizedBox(height: 20),
          const VoiceWaveform(),
          const SizedBox(height: 32),
          GestureDetector(
            onTap: onCancel,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                border: Border.all(color: AssistantTheme.borderDark),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Text(
                'Cancel',
                style: TextStyle(color: AssistantTheme.textMuted, fontSize: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// THINKING DISPLAY WITH FACE
// ============================================================================

class ThinkingDisplayWithFace extends StatelessWidget {
  final String query;

  const ThinkingDisplayWithFace({
    super.key,
    required this.query,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AssistantTheme.bgDark,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const AnimatedFace(
            expression: FaceExpression.thinking,
            size: 200,
          ),
          const SizedBox(height: 24),
          const Text(
            'Thinking...',
            style: TextStyle(
              color: AssistantTheme.textLight,
              fontSize: 20,
              fontWeight: FontWeight.w300,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 40),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: AssistantTheme.cardDark,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AssistantTheme.borderDark),
            ),
            child: Text(
              '"$query"',
              style: const TextStyle(
                color: AssistantTheme.textMuted,
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// RESPONSE DISPLAY WITH FACE (Landscape)
// ============================================================================

class ResponseDisplayWithFace extends StatelessWidget {
  final FaceExpression expression;
  final String statusText;
  final List<Widget> messages;
  final VoidCallback? onMicTap;

  const ResponseDisplayWithFace({
    super.key,
    required this.expression,
    required this.statusText,
    required this.messages,
    this.onMicTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AssistantTheme.bgDark,
      child: Row(
        children: [
          // Face panel
          Container(
            width: 280,
            decoration: const BoxDecoration(
              border: Border(right: BorderSide(color: AssistantTheme.borderDark)),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedFace(expression: expression, size: 160),
                const SizedBox(height: 20),
                Text(
                  statusText,
                  style: const TextStyle(
                    color: AssistantTheme.textLight,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),
          // Chat panel
          Expanded(
            child: Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(24),
                    children: messages,
                  ),
                ),
                _buildInputBar(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputBar() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: AssistantTheme.cardDark,
        border: Border(top: BorderSide(color: AssistantTheme.borderDark)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AssistantTheme.borderDark),
              ),
              child: const TextField(
                style: TextStyle(color: AssistantTheme.textLight, fontSize: 15),
                decoration: InputDecoration(
                  hintText: 'Ask me anything...',
                  hintStyle: TextStyle(color: AssistantTheme.textMuted),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: onMicTap,
            child: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: AssistantTheme.primaryGradient,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AssistantTheme.primary.withOpacity(0.4),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(Icons.mic, color: Colors.white, size: 24),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// ERROR DISPLAY WITH FACE
// ============================================================================

class ErrorDisplayWithFace extends StatelessWidget {
  final String message;
  final String hint;
  final VoidCallback? onRetry;

  const ErrorDisplayWithFace({
    super.key,
    this.message = "I didn't catch that",
    this.hint = 'Could you please try again?',
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AssistantTheme.bgDark,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const AnimatedFace(
            expression: FaceExpression.confused,
            size: 200,
          ),
          const SizedBox(height: 24),
          Text(
            message,
            style: const TextStyle(
              color: AssistantTheme.textLight,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            hint,
            style: const TextStyle(
              color: AssistantTheme.textMuted,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: onRetry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
              decoration: BoxDecoration(
                color: AssistantTheme.primary,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Text(
                'Try Again',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// MESSAGE WIDGETS
// ============================================================================

class UserMessageBubble extends StatelessWidget {
  final String text;

  const UserMessageBubble({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.6),
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: const BoxDecoration(
          color: AssistantTheme.cardDark,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
            bottomLeft: Radius.circular(20),
            bottomRight: Radius.circular(4),
          ),
        ),
        child: Text(
          text,
          style: const TextStyle(
            color: AssistantTheme.textLight,
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}

class AssistantMessageBubble extends StatelessWidget {
  final String text;
  final Widget? actionCard;
  final List<String>? suggestions;
  final ValueChanged<String>? onSuggestionTap;

  const AssistantMessageBubble({
    super.key,
    required this.text,
    this.actionCard,
    this.suggestions,
    this.onSuggestionTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.7),
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            color: AssistantTheme.primaryLight,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
              bottomLeft: Radius.circular(4),
              bottomRight: Radius.circular(20),
            ),
            border: const Border(
              left: BorderSide(color: AssistantTheme.primary, width: 3),
            ),
          ),
          child: Text(
            text,
            style: const TextStyle(
              color: AssistantTheme.textLight,
              fontSize: 15,
              height: 1.4,
            ),
          ),
        ),
        if (actionCard != null) actionCard!,
        if (suggestions != null && suggestions!.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: suggestions!.map((s) {
              return GestureDetector(
                onTap: () => onSuggestionTap?.call(s),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AssistantTheme.cardDark,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AssistantTheme.borderDark),
                  ),
                  child: Text(
                    s,
                    style: const TextStyle(
                      color: AssistantTheme.textLight,
                      fontSize: 12,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
        const SizedBox(height: 16),
      ],
    );
  }
}

class ActionCardWidget extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final String statusText;

  const ActionCardWidget({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.statusText,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AssistantTheme.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AssistantTheme.borderDark),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(
                      color: AssistantTheme.textLight,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    )),
                    Text(subtitle, style: const TextStyle(
                      color: AssistantTheme.textMuted,
                      fontSize: 12,
                    )),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                width: 20,
                height: 20,
                decoration: const BoxDecoration(
                  color: AssistantTheme.success,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, color: Colors.white, size: 12),
              ),
              const SizedBox(width: 8),
              Text(statusText, style: const TextStyle(
                color: AssistantTheme.success,
                fontSize: 13,
              )),
            ],
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// DEMO APP
// ============================================================================

void main() {
  runApp(const AIAssistantFaceDemo());
}

class AIAssistantFaceDemo extends StatefulWidget {
  const AIAssistantFaceDemo({super.key});

  @override
  State<AIAssistantFaceDemo> createState() => _AIAssistantFaceDemoState();
}

class _AIAssistantFaceDemoState extends State<AIAssistantFaceDemo> {
  int _currentState = 0;
  String _transcribedText = '';

  final _states = ['idle', 'listening', 'transcribing', 'thinking', 'responding', 'happy', 'error'];

  void _nextState() {
    setState(() {
      _currentState = (_currentState + 1) % _states.length;
      if (_states[_currentState] == 'transcribing') {
        _transcribedText = 'Turn on the living room lights';
      } else {
        _transcribedText = '';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: GestureDetector(
        onTap: _nextState,
        child: Scaffold(
          body: SafeArea(child: _buildCurrentState()),
        ),
      ),
    );
  }

  Widget _buildCurrentState() {
    switch (_states[_currentState]) {
      case 'idle':
        return IdleDisplayWithFace(onTap: _nextState);
      case 'listening':
        return const ListeningDisplayWithFace();
      case 'transcribing':
        return ListeningDisplayWithFace(transcribedText: _transcribedText);
      case 'thinking':
        return ThinkingDisplayWithFace(query: _transcribedText);
      case 'responding':
        return ResponseDisplayWithFace(
          expression: FaceExpression.speaking,
          statusText: 'Speaking...',
          messages: [
            const UserMessageBubble(text: 'Turn on the living room lights'),
            AssistantMessageBubble(
              text: "Done! I've turned on the living room lights for you.",
              actionCard: const ActionCardWidget(
                icon: Icons.lightbulb_outline,
                color: AssistantTheme.warning,
                title: 'Living Room Lights',
                subtitle: '3 lights',
                statusText: 'Turned on',
              ),
              suggestions: const ['Set brightness to 50%', 'Change color', 'Turn off in 30 min'],
            ),
          ],
        );
      case 'happy':
        return ResponseDisplayWithFace(
          expression: FaceExpression.happy,
          statusText: 'Task completed!',
          messages: [
            const UserMessageBubble(text: 'Turn on the living room lights'),
            AssistantMessageBubble(
              text: "Done! I've turned on the living room lights for you.",
              actionCard: const ActionCardWidget(
                icon: Icons.lightbulb_outline,
                color: AssistantTheme.warning,
                title: 'Living Room Lights',
                subtitle: '3 lights',
                statusText: 'Turned on',
              ),
              suggestions: const ['Set brightness to 50%', 'Change color', 'Turn off in 30 min'],
            ),
          ],
        );
      case 'error':
        return ErrorDisplayWithFace(onRetry: _nextState);
      default:
        return IdleDisplayWithFace(onTap: _nextState);
    }
  }
}
