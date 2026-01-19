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

  // Friendly face colors
  static const Color faceBackground = Color(0xFF3D3D3D);
  static const Color faceHighlight = Color(0xFF4A4A4A);
  static const Color eyeWhite = Color(0xFFFFFFFF);
  static const Color eyePupil = Color(0xFF2D2D2D);
  static const Color cheekColor = Color(0x40E85A4F);
  static const Color mouthColor = Color(0xFFE85A4F);
  static const Color mouthInside = Color(0xFFCC4444);

  static const Color success = Color(0xFF66BB6A);
  static const Color error = Color(0xFFEF5350);

  static const Gradient primaryGradient = LinearGradient(
    colors: [primary, secondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

// ============================================================================
// FACE EXPRESSION STATES
// ============================================================================

enum FaceState {
  idle,       // Sleepy, ambient mode
  awake,      // Ready, blinking
  listening,  // Excited, attentive
  thinking,   // Eyes looking around
  speaking,   // Animated mouth
  happy,      // Big smile, cheeks visible
  surprised,  // Wide eyes, big O mouth
  confused,   // Sad eyes, frown
}

// ============================================================================
// FRIENDLY ANIMATED FACE
// ============================================================================

class FriendlyFace extends StatefulWidget {
  final FaceState state;
  final double width;
  final double height;

  const FriendlyFace({
    super.key,
    required this.state,
    this.width = 220,
    this.height = 180,
  });

  @override
  State<FriendlyFace> createState() => _FriendlyFaceState();
}

class _FriendlyFaceState extends State<FriendlyFace> with TickerProviderStateMixin {
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
      duration: const Duration(milliseconds: 600),
      vsync: this,
    )..repeat(reverse: true);
    
    _lookController = AnimationController(
      duration: const Duration(milliseconds: 2500),
      vsync: this,
    )..repeat();
    
    _speakController = AnimationController(
      duration: const Duration(milliseconds: 250),
      vsync: this,
    )..repeat(reverse: true);
    
    _glowController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat(reverse: true);
    
    _startBlinking();
  }

  void _startBlinking() async {
    while (mounted) {
      await Future.delayed(Duration(milliseconds: 2500 + math.Random().nextInt(2000)));
      if (mounted && (widget.state == FaceState.awake || widget.state == FaceState.speaking)) {
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

  bool get _showCheeks => widget.state == FaceState.happy || widget.state == FaceState.listening;
  bool get _showGlow => widget.state == FaceState.listening;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _glowController,
      builder: (context, child) {
        return Stack(
          alignment: Alignment.center,
          children: [
            // Glow effect when listening
            if (_showGlow)
              Container(
                width: widget.width + 10,
                height: widget.height + 10,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(widget.height * 0.25 + 5),
                  gradient: LinearGradient(
                    colors: [
                      AssistantTheme.primary.withOpacity(0.3 + _glowController.value * 0.2),
                      AssistantTheme.secondary.withOpacity(0.3 + _glowController.value * 0.2),
                    ],
                  ),
                ),
              ),
            
            // Face container - rounded rectangle
            Container(
              width: widget.width,
              height: widget.height,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [AssistantTheme.faceHighlight, AssistantTheme.faceBackground],
                ),
                borderRadius: BorderRadius.circular(widget.height * 0.22),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.4),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Eyes
                  Positioned(
                    top: widget.height * 0.28,
                    child: _buildEyes(),
                  ),
                  // Cheeks
                  if (_showCheeks) ...[
                    Positioned(
                      left: widget.width * 0.08,
                      top: widget.height * 0.45,
                      child: _buildCheek(),
                    ),
                    Positioned(
                      right: widget.width * 0.08,
                      top: widget.height * 0.45,
                      child: _buildCheek(),
                    ),
                  ],
                  // Mouth
                  Positioned(
                    bottom: widget.height * 0.22,
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
    final eyeSize = widget.width * 0.22;
    final eyeGap = widget.width * 0.14;
    
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
    return AnimatedBuilder(
      animation: Listenable.merge([_blinkController, _pulseController, _lookController]),
      builder: (context, child) {
        double eyeHeight = size;
        double pupilOffsetX = 0;
        double pupilOffsetY = 0;
        double scale = 1.0;
        double rotation = 0;
        BorderRadius borderRadius = BorderRadius.circular(size);
        bool showPupil = true;
        
        switch (widget.state) {
          case FaceState.idle:
            // Sleepy - half closed
            eyeHeight = size * 0.4;
            borderRadius = BorderRadius.only(
              topLeft: Radius.circular(size),
              topRight: Radius.circular(size),
              bottomLeft: Radius.circular(size * 0.6),
              bottomRight: Radius.circular(size * 0.6),
            );
            break;
            
          case FaceState.awake:
          case FaceState.speaking:
            // Normal with blinking
            eyeHeight = size * (1.0 - _blinkController.value * 0.85);
            break;
            
          case FaceState.listening:
            // Excited - slightly bigger
            scale = 1.0 + _pulseController.value * 0.08;
            break;
            
          case FaceState.thinking:
            // Looking around
            final lookValue = _lookController.value;
            if (lookValue < 0.25) {
              pupilOffsetX = -size * 0.15 * (lookValue / 0.25);
              pupilOffsetY = -size * 0.08 * (lookValue / 0.25);
            } else if (lookValue < 0.5) {
              pupilOffsetX = -size * 0.15 + size * 0.3 * ((lookValue - 0.25) / 0.25);
              pupilOffsetY = -size * 0.08 + size * 0.04 * ((lookValue - 0.25) / 0.25);
            } else if (lookValue < 0.75) {
              pupilOffsetX = size * 0.15 - size * 0.15 * ((lookValue - 0.5) / 0.25);
              pupilOffsetY = -size * 0.04 + size * 0.12 * ((lookValue - 0.5) / 0.25);
            } else {
              pupilOffsetX = 0;
              pupilOffsetY = size * 0.08 * (1 - (lookValue - 0.75) / 0.25);
            }
            break;
            
          case FaceState.happy:
            // Curved happy eyes - no pupil visible
            eyeHeight = size * 0.45;
            borderRadius = BorderRadius.only(
              topLeft: Radius.circular(size),
              topRight: Radius.circular(size),
              bottomLeft: Radius.circular(size * 0.3),
              bottomRight: Radius.circular(size * 0.3),
            );
            showPupil = false;
            break;
            
          case FaceState.surprised:
            // Wide open
            scale = 1.2;
            break;
            
          case FaceState.confused:
            // Droopy sad eyes
            rotation = isLeft ? -0.15 : 0.15;
            break;
        }
        
        return Transform.rotate(
          angle: rotation,
          child: Transform.scale(
            scale: scale,
            child: Container(
              width: size,
              height: eyeHeight,
              decoration: BoxDecoration(
                color: AssistantTheme.eyeWhite,
                borderRadius: borderRadius,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: showPupil ? Stack(
                alignment: Alignment.center,
                children: [
                  // Pupil
                  Transform.translate(
                    offset: Offset(pupilOffsetX, pupilOffsetY),
                    child: Container(
                      width: size * 0.52,
                      height: size * 0.52,
                      decoration: const BoxDecoration(
                        color: AssistantTheme.eyePupil,
                        shape: BoxShape.circle,
                      ),
                      child: Stack(
                        children: [
                          // Main highlight
                          Positioned(
                            top: size * 0.08,
                            right: size * 0.08,
                            child: Container(
                              width: size * 0.18,
                              height: size * 0.18,
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                          // Secondary highlight
                          Positioned(
                            bottom: size * 0.12,
                            left: size * 0.12,
                            child: Container(
                              width: size * 0.1,
                              height: size * 0.1,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.5),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ) : null,
            ),
          ),
        );
      },
    );
  }

  Widget _buildCheek() {
    return AnimatedOpacity(
      opacity: _showCheeks ? 1.0 : 0.0,
      duration: const Duration(milliseconds: 300),
      child: Container(
        width: widget.width * 0.13,
        height: widget.height * 0.09,
        decoration: BoxDecoration(
          color: AssistantTheme.cheekColor,
          borderRadius: BorderRadius.circular(widget.width * 0.08),
        ),
      ),
    );
  }

  Widget _buildMouth() {
    return AnimatedBuilder(
      animation: Listenable.merge([_speakController, _lookController]),
      builder: (context, child) {
        switch (widget.state) {
          case FaceState.idle:
            // Sleepy - flat line
            return Container(
              width: widget.width * 0.12,
              height: 4,
              decoration: BoxDecoration(
                color: AssistantTheme.mouthColor,
                borderRadius: BorderRadius.circular(2),
              ),
            );
            
          case FaceState.awake:
          case FaceState.listening:
            // Small smile
            return CustomPaint(
              size: Size(widget.width * 0.14, widget.height * 0.08),
              painter: _SmilePainter(
                color: AssistantTheme.mouthColor,
                strokeWidth: 3,
              ),
            );
            
          case FaceState.thinking:
            // Small 'o' moving side to side
            final offset = math.sin(_lookController.value * math.pi * 2) * 4;
            return Transform.translate(
              offset: Offset(offset, 0),
              child: Container(
                width: widget.width * 0.1,
                height: widget.width * 0.1,
                decoration: const BoxDecoration(
                  color: AssistantTheme.mouthInside,
                  shape: BoxShape.circle,
                ),
              ),
            );
            
          case FaceState.speaking:
            // Animated talking mouth
            final openAmount = 0.6 + _speakController.value * 0.4;
            return Container(
              width: widget.width * 0.14,
              height: widget.height * 0.12 * openAmount,
              decoration: BoxDecoration(
                color: AssistantTheme.mouthInside,
                borderRadius: BorderRadius.circular(widget.width * 0.1),
              ),
            );
            
          case FaceState.happy:
            // Big smile
            return CustomPaint(
              size: Size(widget.width * 0.28, widget.height * 0.16),
              painter: _SmilePainter(
                color: AssistantTheme.mouthColor,
                strokeWidth: 5,
              ),
            );
            
          case FaceState.surprised:
            // Big O
            return Container(
              width: widget.width * 0.16,
              height: widget.width * 0.16,
              decoration: const BoxDecoration(
                color: AssistantTheme.mouthInside,
                shape: BoxShape.circle,
              ),
            );
            
          case FaceState.confused:
            // Frown
            return CustomPaint(
              size: Size(widget.width * 0.18, widget.height * 0.1),
              painter: _FrownPainter(
                color: AssistantTheme.mouthColor,
                strokeWidth: 3,
              ),
            );
        }
      },
    );
  }
}

class _SmilePainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  
  _SmilePainter({required this.color, this.strokeWidth = 3});
  
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    
    final path = Path();
    path.moveTo(0, size.height * 0.2);
    path.quadraticBezierTo(
      size.width / 2, size.height * 1.1,
      size.width, size.height * 0.2,
    );
    
    canvas.drawPath(path, paint);
  }
  
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _FrownPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  
  _FrownPainter({required this.color, this.strokeWidth = 3});
  
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    
    final path = Path();
    path.moveTo(0, size.height * 0.8);
    path.quadraticBezierTo(
      size.width / 2, -size.height * 0.1,
      size.width, size.height * 0.8,
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
        duration: Duration(milliseconds: 500 + (index * 80)),
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
      height: 28,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(_barCount, (index) {
          return AnimatedBuilder(
            animation: _controllers[index],
            builder: (context, child) {
              final heights = [12.0, 20.0, 16.0, 24.0, 18.0, 22.0, 14.0];
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
// SCREEN DISPLAYS
// ============================================================================

class IdleScreen extends StatelessWidget {
  final VoidCallback? onTap;

  const IdleScreen({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final timeStr = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

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
                  const FriendlyFace(
                    state: FaceState.idle,
                    width: 240,
                    height: 195,
                  ),
                  const SizedBox(height: 28),
                  Text(
                    timeStr,
                    style: const TextStyle(
                      fontSize: 52,
                      fontWeight: FontWeight.w200,
                      color: AssistantTheme.textLight,
                    ),
                  ),
                  const Text(
                    'Friday, January 17',
                    style: TextStyle(
                      fontSize: 14,
                      color: AssistantTheme.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 28,
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
                      Text('Say ', style: TextStyle(color: AssistantTheme.textMuted, fontSize: 13)),
                      Text('"Hey Panel"', style: TextStyle(color: AssistantTheme.primary, fontSize: 13, fontWeight: FontWeight.w500)),
                      Text(' to wake me up!', style: TextStyle(color: AssistantTheme.textMuted, fontSize: 13)),
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

class ListeningScreen extends StatelessWidget {
  final String? transcribedText;
  final VoidCallback? onCancel;

  const ListeningScreen({
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
          const FriendlyFace(
            state: FaceState.listening,
            width: 240,
            height: 195,
          ),
          const SizedBox(height: 20),
          if (transcribedText != null && transcribedText!.isNotEmpty) ...[
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 40),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              decoration: BoxDecoration(
                color: AssistantTheme.primary,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '"$transcribedText"',
                style: const TextStyle(color: Colors.white, fontSize: 16),
                textAlign: TextAlign.center,
              ),
            ),
          ] else ...[
            const Text(
              "I'm listening...",
              style: TextStyle(color: AssistantTheme.textLight, fontSize: 20, fontWeight: FontWeight.w300),
            ),
          ],
          const SizedBox(height: 16),
          const VoiceWaveform(),
          const SizedBox(height: 28),
          GestureDetector(
            onTap: onCancel,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              decoration: BoxDecoration(
                border: Border.all(color: AssistantTheme.borderDark),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text('Cancel', style: TextStyle(color: AssistantTheme.textMuted, fontSize: 14)),
            ),
          ),
        ],
      ),
    );
  }
}

class ThinkingScreen extends StatelessWidget {
  final String query;

  const ThinkingScreen({super.key, required this.query});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AssistantTheme.bgDark,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const FriendlyFace(
            state: FaceState.thinking,
            width: 240,
            height: 195,
          ),
          const SizedBox(height: 20),
          const Text(
            'Hmm, let me think...',
            style: TextStyle(color: AssistantTheme.textLight, fontSize: 20, fontWeight: FontWeight.w300),
          ),
          const SizedBox(height: 12),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 40),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            decoration: BoxDecoration(
              border: Border.all(color: AssistantTheme.borderDark, style: BorderStyle.solid),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              '"$query"',
              style: const TextStyle(color: AssistantTheme.textMuted, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

class HappyScreen extends StatelessWidget {
  final String message;

  const HappyScreen({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AssistantTheme.bgDark,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const FriendlyFace(
            state: FaceState.happy,
            width: 240,
            height: 195,
          ),
          const SizedBox(height: 24),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 32),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            decoration: BoxDecoration(
              color: AssistantTheme.cardDark,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AssistantTheme.borderDark),
            ),
            child: Text(
              message,
              style: const TextStyle(color: AssistantTheme.textLight, fontSize: 16),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

class ErrorScreen extends StatelessWidget {
  final VoidCallback? onRetry;

  const ErrorScreen({super.key, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AssistantTheme.bgDark,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const FriendlyFace(
            state: FaceState.confused,
            width: 240,
            height: 195,
          ),
          const SizedBox(height: 20),
          const Text(
            "Oops! I didn't catch that 😅",
            style: TextStyle(color: AssistantTheme.textLight, fontSize: 18),
          ),
          const SizedBox(height: 8),
          const Text(
            'Could you say that again?',
            style: TextStyle(color: AssistantTheme.textMuted, fontSize: 14),
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
                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w500),
              ),
            ),
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
  runApp(const FriendlyAssistantDemo());
}

class FriendlyAssistantDemo extends StatefulWidget {
  const FriendlyAssistantDemo({super.key});

  @override
  State<FriendlyAssistantDemo> createState() => _FriendlyAssistantDemoState();
}

class _FriendlyAssistantDemoState extends State<FriendlyAssistantDemo> {
  int _currentState = 0;
  final _states = ['idle', 'listening', 'transcribing', 'thinking', 'speaking', 'happy', 'error'];

  void _nextState() {
    setState(() {
      _currentState = (_currentState + 1) % _states.length;
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
          body: SafeArea(child: _buildCurrentScreen()),
        ),
      ),
    );
  }

  Widget _buildCurrentScreen() {
    switch (_states[_currentState]) {
      case 'idle':
        return IdleScreen(onTap: _nextState);
      case 'listening':
        return const ListeningScreen();
      case 'transcribing':
        return const ListeningScreen(transcribedText: 'Turn on the living room lights');
      case 'thinking':
        return const ThinkingScreen(query: 'Turn on the living room lights');
      case 'speaking':
        return Container(
          color: AssistantTheme.bgDark,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const FriendlyFace(state: FaceState.speaking, width: 240, height: 195),
              const SizedBox(height: 24),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 32),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                decoration: BoxDecoration(
                  color: AssistantTheme.cardDark,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  "Sure! I'm turning on the living room lights now.",
                  style: TextStyle(color: AssistantTheme.textLight, fontSize: 16),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        );
      case 'happy':
        return const HappyScreen(message: "Done! ✨ Your lights are on.");
      case 'error':
        return ErrorScreen(onRetry: _nextState);
      default:
        return IdleScreen(onTap: _nextState);
    }
  }
}
