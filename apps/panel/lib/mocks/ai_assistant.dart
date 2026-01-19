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

  // AI accent colors - warm coral/orange (not typical AI blue)
  static const Color primary = Color(0xFFE85A4F);
  static const Color primaryLight = Color(0x26E85A4F);
  static const Color secondary = Color(0xFFFF8A65);

  static const Color success = Color(0xFF66BB6A);
  static const Color error = Color(0xFFEF5350);
  static const Color warning = Color(0xFFFFCA28);

  static const double radiusSm = 12.0;
  static const double radiusMd = 16.0;
  static const double radiusLg = 24.0;

  static const Gradient primaryGradient = LinearGradient(
    colors: [primary, secondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

// ============================================================================
// DATA MODELS
// ============================================================================

enum AssistantState {
  idle,
  listening,
  processing,
  responding,
  error,
}

class AssistantMessage {
  final String text;
  final bool isUser;
  final DateTime timestamp;
  final List<ActionCard>? actions;
  final List<String>? suggestions;

  const AssistantMessage({
    required this.text,
    required this.isUser,
    required this.timestamp,
    this.actions,
    this.suggestions,
  });
}

class ActionCard {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String statusText;
  final bool completed;

  const ActionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.statusText,
    this.completed = true,
  });
}

// ============================================================================
// ANIMATED ORB WIDGET
// ============================================================================

class AnimatedOrb extends StatefulWidget {
  final AssistantState state;
  final double size;

  const AnimatedOrb({
    super.key,
    required this.state,
    this.size = 160,
  });

  @override
  State<AnimatedOrb> createState() => _AnimatedOrbState();
}

class _AnimatedOrbState extends State<AnimatedOrb> with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _spinController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat(reverse: true);

    _spinController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat();

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.08).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _spinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.state == AssistantState.processing) {
      return _buildProcessingOrb();
    }
    return _buildListeningOrb();
  }

  Widget _buildListeningOrb() {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Transform.scale(
          scale: _pulseAnimation.value,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer rings
              Container(
                width: widget.size + 40,
                height: widget.size + 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AssistantTheme.primary.withOpacity(0.15),
                    width: 1,
                  ),
                ),
              ),
              Container(
                width: widget.size + 20,
                height: widget.size + 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AssistantTheme.primary.withOpacity(0.3),
                    width: 2,
                  ),
                ),
              ),
              // Main orb
              Container(
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: AssistantTheme.primaryGradient,
                  boxShadow: [
                    BoxShadow(
                      color: AssistantTheme.primary.withOpacity(0.4),
                      blurRadius: 30,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.mic,
                  color: Colors.white,
                  size: 48,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildProcessingOrb() {
    return AnimatedBuilder(
      animation: _spinController,
      builder: (context, child) {
        return Transform.rotate(
          angle: _spinController.value * 2 * math.pi,
          child: Container(
            width: widget.size * 0.75,
            height: widget.size * 0.75,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: SweepGradient(
                colors: [
                  AssistantTheme.primary,
                  AssistantTheme.secondary,
                  AssistantTheme.primary.withOpacity(0.3),
                  AssistantTheme.primary,
                ],
              ),
            ),
            child: Center(
              child: Container(
                width: widget.size * 0.75 - 16,
                height: widget.size * 0.75 - 16,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AssistantTheme.bgDark,
                ),
                child: Center(
                  child: Container(
                    width: widget.size * 0.75 - 32,
                    height: widget.size * 0.75 - 32,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: AssistantTheme.primaryGradient,
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
  void didUpdateWidget(VoiceWaveform oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive != oldWidget.isActive) {
      for (final controller in _controllers) {
        if (widget.isActive) {
          controller.repeat(reverse: true);
        } else {
          controller.stop();
        }
      }
    }
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
      height: 40,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(_barCount, (index) {
          return AnimatedBuilder(
            animation: _controllers[index],
            builder: (context, child) {
              final heights = [20.0, 35.0, 25.0, 40.0, 30.0, 35.0, 20.0];
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
// IDLE DISPLAY
// ============================================================================

class IdleDisplay extends StatelessWidget {
  final VoidCallback? onTap;

  const IdleDisplay({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final timeStr = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    final months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    final dateStr = '${days[now.weekday % 7]}, ${months[now.month - 1]} ${now.day}';

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        color: AssistantTheme.bgDark,
        child: Stack(
          children: [
            // Main content
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    timeStr,
                    style: const TextStyle(
                      fontSize: 96,
                      fontWeight: FontWeight.w200,
                      color: AssistantTheme.textLight,
                      letterSpacing: -4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    dateStr,
                    style: const TextStyle(
                      fontSize: 18,
                      color: AssistantTheme.textMuted,
                    ),
                  ),
                  const SizedBox(height: 24),
                  // Weather widget
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    decoration: BoxDecoration(
                      color: AssistantTheme.cardDark,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.wb_sunny, color: AssistantTheme.warning, size: 28),
                        SizedBox(width: 12),
                        Text(
                          '22°C',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w300,
                            color: AssistantTheme.textLight,
                          ),
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Partly Cloudy',
                          style: TextStyle(
                            fontSize: 14,
                            color: AssistantTheme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Wake hint at bottom
            Positioned(
              left: 0,
              right: 0,
              bottom: 40,
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
                      Icon(Icons.mic, color: AssistantTheme.primary, size: 18),
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
                        ' or tap to start',
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
// LISTENING DISPLAY
// ============================================================================

class ListeningDisplay extends StatelessWidget {
  final String? transcribedText;
  final VoidCallback? onCancel;

  const ListeningDisplay({
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
          const AnimatedOrb(state: AssistantState.listening),
          const SizedBox(height: 32),
          if (transcribedText != null && transcribedText!.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Text(
                '"$transcribedText"',
                style: const TextStyle(
                  color: AssistantTheme.textLight,
                  fontSize: 24,
                  fontWeight: FontWeight.w400,
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
          const SizedBox(height: 24),
          const VoiceWaveform(),
          const SizedBox(height: 40),
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
// PROCESSING DISPLAY
// ============================================================================

class ProcessingDisplay extends StatelessWidget {
  final String query;

  const ProcessingDisplay({
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
          const AnimatedOrb(state: AssistantState.processing, size: 120),
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
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              '"$query"',
              style: const TextStyle(
                color: AssistantTheme.textMuted,
                fontSize: 16,
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
// RESPONSE DISPLAY
// ============================================================================

class ResponseDisplay extends StatelessWidget {
  final List<AssistantMessage> messages;
  final VoidCallback? onMicTap;
  final ValueChanged<String>? onSuggestionTap;

  const ResponseDisplay({
    super.key,
    required this.messages,
    this.onMicTap,
    this.onSuggestionTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AssistantTheme.bgDark,
      child: Column(
        children: [
          // Messages
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(24),
              itemCount: messages.length,
              itemBuilder: (context, index) {
                final message = messages[index];
                return _MessageBubble(
                  message: message,
                  onSuggestionTap: onSuggestionTap,
                );
              },
            ),
          ),
          // Input bar
          _InputBar(onMicTap: onMicTap),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final AssistantMessage message;
  final ValueChanged<String>? onSuggestionTap;

  const _MessageBubble({
    required this.message,
    this.onSuggestionTap,
  });

  @override
  Widget build(BuildContext context) {
    if (message.isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.7),
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          decoration: BoxDecoration(
            color: AssistantTheme.cardDark,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
              bottomLeft: Radius.circular(20),
              bottomRight: Radius.circular(4),
            ),
          ),
          child: Text(
            message.text,
            style: const TextStyle(
              color: AssistantTheme.textLight,
              fontSize: 16,
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // AI response bubble
        Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.85),
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
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
            message.text,
            style: const TextStyle(
              color: AssistantTheme.textLight,
              fontSize: 16,
              height: 1.5,
            ),
          ),
        ),

        // Action cards
        if (message.actions != null)
          ...message.actions!.map((action) => _ActionCardWidget(action: action)),

        // Suggestions
        if (message.suggestions != null && message.suggestions!.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: message.suggestions!.map((suggestion) {
              return GestureDetector(
                onTap: () => onSuggestionTap?.call(suggestion),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: AssistantTheme.cardDark,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AssistantTheme.borderDark),
                  ),
                  child: Text(
                    suggestion,
                    style: const TextStyle(
                      color: AssistantTheme.textLight,
                      fontSize: 13,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
        ],
      ],
    );
  }
}

class _ActionCardWidget extends StatelessWidget {
  final ActionCard action;

  const _ActionCardWidget({required this.action});

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
                  color: action.color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(action.icon, color: action.color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      action.title,
                      style: const TextStyle(
                        color: AssistantTheme.textLight,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      action.subtitle,
                      style: const TextStyle(
                        color: AssistantTheme.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: const BoxDecoration(
                      color: AssistantTheme.success,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check, color: Colors.white, size: 14),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    action.statusText,
                    style: const TextStyle(
                      color: AssistantTheme.success,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  border: Border.all(color: AssistantTheme.borderDark),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Undo',
                  style: TextStyle(
                    color: AssistantTheme.textMuted,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  final VoidCallback? onMicTap;

  const _InputBar({this.onMicTap});

  @override
  Widget build(BuildContext context) {
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
// ERROR DISPLAY
// ============================================================================

class ErrorDisplay extends StatelessWidget {
  final String message;
  final String hint;
  final VoidCallback? onRetry;

  const ErrorDisplay({
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
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AssistantTheme.error.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.sentiment_dissatisfied,
              color: AssistantTheme.error,
              size: 40,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            message,
            style: const TextStyle(
              color: AssistantTheme.textLight,
              fontSize: 18,
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
// MAIN AI ASSISTANT PAGE
// ============================================================================

class AIAssistantPage extends StatefulWidget {
  const AIAssistantPage({super.key});

  @override
  State<AIAssistantPage> createState() => _AIAssistantPageState();
}

class _AIAssistantPageState extends State<AIAssistantPage> {
  AssistantState _state = AssistantState.idle;
  String _transcribedText = '';
  final List<AssistantMessage> _messages = [];

  void _startListening() {
    setState(() {
      _state = AssistantState.listening;
      _transcribedText = '';
    });

    // Simulate transcription
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted && _state == AssistantState.listening) {
        setState(() {
          _transcribedText = 'Turn on the living room lights';
        });
      }
    });

    // Simulate processing
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        _processQuery(_transcribedText);
      }
    });
  }

  void _processQuery(String query) {
    setState(() {
      _state = AssistantState.processing;
    });

    // Add user message
    _messages.add(AssistantMessage(
      text: query,
      isUser: true,
      timestamp: DateTime.now(),
    ));

    // Simulate response
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) {
        _showResponse();
      }
    });
  }

  void _showResponse() {
    setState(() {
      _state = AssistantState.responding;
      _messages.add(AssistantMessage(
        text: "Done! I've turned on the living room lights for you.",
        isUser: false,
        timestamp: DateTime.now(),
        actions: [
          const ActionCard(
            title: 'Living Room Lights',
            subtitle: '3 lights',
            icon: Icons.lightbulb_outline,
            color: Color(0xFFFFCA28),
            statusText: 'Turned on',
          ),
        ],
        suggestions: [
          'Set brightness to 50%',
          'Change color',
          'Turn off in 30 minutes',
        ],
      ));
    });
  }

  void _cancel() {
    setState(() {
      _state = AssistantState.idle;
      _transcribedText = '';
    });
  }

  void _handleSuggestion(String suggestion) {
    _messages.add(AssistantMessage(
      text: suggestion,
      isUser: true,
      timestamp: DateTime.now(),
    ));
    _processQuery(suggestion);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AssistantTheme.bgDark,
      body: SafeArea(
        child: _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    switch (_state) {
      case AssistantState.idle:
        return IdleDisplay(onTap: _startListening);
      case AssistantState.listening:
        return ListeningDisplay(
          transcribedText: _transcribedText,
          onCancel: _cancel,
        );
      case AssistantState.processing:
        return ProcessingDisplay(query: _transcribedText);
      case AssistantState.responding:
        return ResponseDisplay(
          messages: _messages,
          onMicTap: _startListening,
          onSuggestionTap: _handleSuggestion,
        );
      case AssistantState.error:
        return ErrorDisplay(onRetry: _startListening);
    }
  }
}

// ============================================================================
// DEMO APP
// ============================================================================

void main() {
  runApp(const AIAssistantDemo());
}

class AIAssistantDemo extends StatelessWidget {
  const AIAssistantDemo({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: const AIAssistantPage(),
    );
  }
}
