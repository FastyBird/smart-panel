import 'package:flutter/material.dart';

// ============================================================================
// POWER BUTTON WIDGET
// Matches the design from lights_capability_ui.html
// ============================================================================

class LightingTheme {
  // Light theme
  static const Color bg = Color(0xFFF5F5F5);
  static const Color card = Color(0xFFFFFFFF);
  static const Color cardLight = Color(0xFFE8E8E8);
  static const Color text = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color textMuted = Color(0xFF9E9E9E);
  static const Color border = Color(0xFFE0E0E0);
  
  static const Color accent = Color(0xFFE85A4F);
  static const Color accentLight = Color(0x1AE85A4F); // 10% opacity
  static const Color accentGlow = Color(0x40E85A4F); // 25% opacity
}

/// Large circular power button for controlling lights on/off state
/// 
/// Features:
/// - 180px circle with power icon and state text
/// - Glow effect when on
/// - Optional info text below showing hint or current state
/// - Touch feedback with scale animation
class PowerButton extends StatefulWidget {
  final bool isOn;
  final VoidCallback? onTap;
  final String? infoText;
  final double size;

  const PowerButton({
    super.key,
    required this.isOn,
    this.onTap,
    this.infoText,
    this.size = 180,
  });

  @override
  State<PowerButton> createState() => _PowerButtonState();
}

class _PowerButtonState extends State<PowerButton> 
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  bool _isPressed = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails details) {
    setState(() => _isPressed = true);
    _controller.forward();
  }

  void _onTapUp(TapUpDetails details) {
    setState(() => _isPressed = false);
    _controller.reverse();
    widget.onTap?.call();
  }

  void _onTapCancel() {
    setState(() => _isPressed = false);
    _controller.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Power circle
        GestureDetector(
          onTapDown: _onTapDown,
          onTapUp: _onTapUp,
          onTapCancel: _onTapCancel,
          child: AnimatedBuilder(
            animation: _scaleAnimation,
            builder: (context, child) {
              return Transform.scale(
                scale: _scaleAnimation.value,
                child: child,
              );
            },
            child: _buildCircle(),
          ),
        ),
        // Info text
        if (widget.infoText != null) ...[
          const SizedBox(height: 24),
          Text(
            widget.infoText!,
            style: const TextStyle(
              color: LightingTheme.textSecondary,
              fontSize: 14,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }

  Widget _buildCircle() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: widget.isOn ? LightingTheme.accentLight : LightingTheme.card,
        border: Border.all(
          color: widget.isOn ? LightingTheme.accent : Colors.transparent,
          width: 4,
        ),
        boxShadow: widget.isOn
            ? [
                BoxShadow(
                  color: LightingTheme.accentGlow,
                  blurRadius: 40,
                  spreadRadius: 0,
                ),
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Power icon
          Icon(
            Icons.power_settings_new,
            size: widget.size * 0.27, // ~48px for 180px circle
            color: widget.isOn 
                ? LightingTheme.accent 
                : LightingTheme.textMuted,
          ),
          SizedBox(height: widget.size * 0.044), // ~8px
          // State text
          Text(
            widget.isOn ? 'On' : 'Off',
            style: TextStyle(
              fontSize: widget.size * 0.156, // ~28px
              fontWeight: FontWeight.w300,
              color: widget.isOn 
                  ? LightingTheme.accent 
                  : LightingTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Smaller power button for header or compact layouts
class CompactPowerButton extends StatelessWidget {
  final bool isOn;
  final VoidCallback? onTap;
  final double size;

  const CompactPowerButton({
    super.key,
    required this.isOn,
    this.onTap,
    this.size = 48,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isOn ? LightingTheme.accent : LightingTheme.cardLight,
          boxShadow: isOn
              ? [
                  BoxShadow(
                    color: LightingTheme.accentGlow,
                    blurRadius: 12,
                    spreadRadius: 0,
                  ),
                ]
              : null,
        ),
        child: Icon(
          Icons.power_settings_new,
          size: size * 0.5,
          color: isOn ? Colors.white : LightingTheme.textMuted,
        ),
      ),
    );
  }
}

// ============================================================================
// DEMO
// ============================================================================

void main() {
  runApp(const PowerButtonDemo());
}

class PowerButtonDemo extends StatefulWidget {
  const PowerButtonDemo({super.key});

  @override
  State<PowerButtonDemo> createState() => _PowerButtonDemoState();
}

class _PowerButtonDemoState extends State<PowerButtonDemo> {
  bool _isOn = true;
  int _brightness = 65;
  int _colorTemp = 3000;

  String get _infoText {
    if (_isOn) {
      return '$_brightness% brightness • ${_colorTemp}K';
    } else {
      return 'Tap to turn on';
    }
  }

  String get _simpleInfoText {
    return _isOn ? 'Tap to turn off' : 'Tap to turn on';
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: LightingTheme.bg,
        appBar: AppBar(
          backgroundColor: LightingTheme.card,
          elevation: 0,
          title: const Text(
            'Power Button Demo',
            style: TextStyle(color: LightingTheme.text),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: CompactPowerButton(
                isOn: _isOn,
                onTap: () => setState(() => _isOn = !_isOn),
              ),
            ),
          ],
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              // Section: Role control (with info)
              _buildSection(
                'Role Control',
                'Shows current state info',
                PowerButton(
                  isOn: _isOn,
                  onTap: () => setState(() => _isOn = !_isOn),
                  infoText: _infoText,
                ),
              ),
              
              const SizedBox(height: 48),
              
              // Section: Simple device
              _buildSection(
                'Simple Device',
                'On/Off only - shows action hint',
                PowerButton(
                  isOn: _isOn,
                  onTap: () => setState(() => _isOn = !_isOn),
                  infoText: _simpleInfoText,
                ),
              ),
              
              const SizedBox(height: 48),
              
              // Section: Smaller size
              _buildSection(
                'Compact Size',
                'For smaller layouts',
                PowerButton(
                  isOn: _isOn,
                  onTap: () => setState(() => _isOn = !_isOn),
                  infoText: _simpleInfoText,
                  size: 140,
                ),
              ),
              
              const SizedBox(height: 48),
              
              // Controls
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: LightingTheme.card,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Adjust values',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        const Text('Brightness:'),
                        Expanded(
                          child: Slider(
                            value: _brightness.toDouble(),
                            min: 0,
                            max: 100,
                            activeColor: LightingTheme.accent,
                            onChanged: (v) => setState(() => _brightness = v.round()),
                          ),
                        ),
                        Text('$_brightness%'),
                      ],
                    ),
                    Row(
                      children: [
                        const Text('Color Temp:'),
                        Expanded(
                          child: Slider(
                            value: _colorTemp.toDouble(),
                            min: 2700,
                            max: 6500,
                            activeColor: LightingTheme.accent,
                            onChanged: (v) => setState(() => _colorTemp = v.round()),
                          ),
                        ),
                        Text('${_colorTemp}K'),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSection(String title, String subtitle, Widget child) {
    return Column(
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: LightingTheme.text,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: const TextStyle(
            fontSize: 13,
            color: LightingTheme.textMuted,
          ),
        ),
        const SizedBox(height: 24),
        child,
      ],
    );
  }
}
