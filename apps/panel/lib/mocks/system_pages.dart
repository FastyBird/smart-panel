// ============================================================================
// SYSTEM PAGES - FastyBird Smart Panel
// ============================================================================
// Gateway discovery, connection errors, configuration states
// Supports: Light/Dark themes, Landscape/Portrait orientations
// ============================================================================

import 'dart:math' as math;
import 'package:flutter/material.dart';

// ============================================================================
// THEME
// ============================================================================

class SystemPagesTheme {
  // Shared accent colors
  static const Color accent = Color(0xFFE85A4F);
  static const Color accentHover = Color(0xFFD64A3F);
  static const Color accentLight = Color(0x26E85A4F); // 15% opacity

  // Status colors
  static const Color success = Color(0xFF66BB6A);
  static const Color successLight = Color(0x2666BB6A);
  static const Color warning = Color(0xFFFF9800);
  static const Color warningLight = Color(0x26FF9800);
  static const Color error = Color(0xFFEF5350);
  static const Color errorLight = Color(0x26EF5350);
  static const Color info = Color(0xFF42A5F5);
  static const Color infoLight = Color(0x2642A5F5);
  static const Color offline = Color(0xFF78909C);

  // Light theme
  static const Color bgLight = Color(0xFFF5F5F5);
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color cardSecondaryLight = Color(0xFFE8E8E8);
  static const Color borderLight = Color(0xFFE0E0E0);
  static const Color textPrimaryLight = Color(0xFF212121);
  static const Color textSecondaryLight = Color(0xFF757575);
  static const Color textMutedLight = Color(0xFF9E9E9E);

  // Dark theme
  static const Color bgDark = Color(0xFF1A1A1A);
  static const Color cardDark = Color(0xFF2A2A2A);
  static const Color cardSecondaryDark = Color(0xFF333333);
  static const Color borderDark = Color(0xFF3A3A3A);
  static const Color textPrimaryDark = Color(0xFFFFFFFF);
  static const Color textSecondaryDark = Color(0xFF9E9E9E);
  static const Color textMutedDark = Color(0xFF666666);

  // Border radii
  static const double radiusSm = 12.0;
  static const double radiusMd = 16.0;
  static const double radiusLg = 20.0;
  static const double radiusXl = 24.0;

  // Helper methods
  static Color background(bool isDark) => isDark ? bgDark : bgLight;
  static Color card(bool isDark) => isDark ? cardDark : cardLight;
  static Color cardSecondary(bool isDark) =>
      isDark ? cardSecondaryDark : cardSecondaryLight;
  static Color border(bool isDark) => isDark ? borderDark : borderLight;
  static Color textPrimary(bool isDark) =>
      isDark ? textPrimaryDark : textPrimaryLight;
  static Color textSecondary(bool isDark) =>
      isDark ? textSecondaryDark : textSecondaryLight;
  static Color textMuted(bool isDark) =>
      isDark ? textMutedDark : textMutedLight;
}

// ============================================================================
// GATEWAY MODEL
// ============================================================================

class GatewayInfo {
  final String id;
  final String name;
  final String address;
  final String? badge;
  final bool isOnline;

  const GatewayInfo({
    required this.id,
    required this.name,
    required this.address,
    this.badge,
    this.isOnline = true,
  });
}

// ============================================================================
// ANIMATED PULSE RINGS
// ============================================================================

class PulseRings extends StatefulWidget {
  final double size;
  final Color color;
  final int ringCount;

  const PulseRings({
    super.key,
    this.size = 80,
    this.color = SystemPagesTheme.accent,
    this.ringCount = 2,
  });

  @override
  State<PulseRings> createState() => _PulseRingsState();
}

class _PulseRingsState extends State<PulseRings>
    with TickerProviderStateMixin {
  late List<AnimationController> _controllers;
  late List<Animation<double>> _scaleAnimations;
  late List<Animation<double>> _opacityAnimations;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      widget.ringCount,
      (i) => AnimationController(
        duration: const Duration(milliseconds: 1500),
        vsync: this,
      ),
    );

    _scaleAnimations = _controllers.map((c) {
      return Tween<double>(begin: 1.0, end: 1.6).animate(
        CurvedAnimation(parent: c, curve: Curves.easeOut),
      );
    }).toList();

    _opacityAnimations = _controllers.map((c) {
      return Tween<double>(begin: 0.8, end: 0.0).animate(
        CurvedAnimation(parent: c, curve: Curves.easeOut),
      );
    }).toList();

    // Start animations with staggered delay
    for (int i = 0; i < widget.ringCount; i++) {
      Future.delayed(Duration(milliseconds: i * 500), () {
        if (mounted) {
          _controllers[i].repeat();
        }
      });
    }
  }

  @override
  void dispose() {
    for (var c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: List.generate(widget.ringCount, (i) {
          return AnimatedBuilder(
            animation: _controllers[i],
            builder: (context, child) {
              return Transform.scale(
                scale: _scaleAnimations[i].value,
                child: Opacity(
                  opacity: _opacityAnimations[i].value,
                  child: Container(
                    width: widget.size,
                    height: widget.size,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: widget.color, width: 2),
                    ),
                  ),
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
// LOADING SPINNER
// ============================================================================

class LoadingSpinner extends StatefulWidget {
  final double size;
  final Color color;
  final double strokeWidth;

  const LoadingSpinner({
    super.key,
    this.size = 48,
    this.color = SystemPagesTheme.accent,
    this.strokeWidth = 3,
  });

  @override
  State<LoadingSpinner> createState() => _LoadingSpinnerState();
}

class _LoadingSpinnerState extends State<LoadingSpinner>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.rotate(
          angle: _controller.value * 2 * math.pi,
          child: CustomPaint(
            size: Size(widget.size, widget.size),
            painter: _SpinnerPainter(
              color: widget.color,
              strokeWidth: widget.strokeWidth,
            ),
          ),
        );
      },
    );
  }
}

class _SpinnerPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;

  _SpinnerPainter({required this.color, required this.strokeWidth});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final rect = Rect.fromLTWH(
      strokeWidth / 2,
      strokeWidth / 2,
      size.width - strokeWidth,
      size.height - strokeWidth,
    );

    canvas.drawArc(rect, 0, math.pi * 1.5, false, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ============================================================================
// ICON CONTAINER
// ============================================================================

class IconContainer extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;
  final double iconSize;

  const IconContainer({
    super.key,
    required this.icon,
    required this.color,
    this.size = 80,
    this.iconSize = 40,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: color, size: iconSize),
    );
  }
}

// ============================================================================
// PRIMARY BUTTON
// ============================================================================

class PrimaryButton extends StatefulWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final double minWidth;

  const PrimaryButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.minWidth = 180,
  });

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      onTap: widget.onPressed,
      child: AnimatedScale(
        scale: _isPressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          constraints: BoxConstraints(minWidth: widget.minWidth),
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
          decoration: BoxDecoration(
            color: SystemPagesTheme.accent,
            borderRadius: BorderRadius.circular(SystemPagesTheme.radiusLg),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.icon != null) ...[
                Icon(widget.icon, color: Colors.white, size: 20),
                const SizedBox(width: 10),
              ],
              Text(
                widget.label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// SECONDARY BUTTON
// ============================================================================

class SecondaryButton extends StatefulWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool isDark;
  final double minWidth;

  const SecondaryButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.isDark = true,
    this.minWidth = 180,
  });

  @override
  State<SecondaryButton> createState() => _SecondaryButtonState();
}

class _SecondaryButtonState extends State<SecondaryButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      onTap: widget.onPressed,
      child: AnimatedScale(
        scale: _isPressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          constraints: BoxConstraints(minWidth: widget.minWidth),
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
          decoration: BoxDecoration(
            color: SystemPagesTheme.card(widget.isDark),
            borderRadius: BorderRadius.circular(SystemPagesTheme.radiusLg),
            border: Border.all(
              color: _isPressed
                  ? SystemPagesTheme.accent
                  : SystemPagesTheme.border(widget.isDark),
              width: 1.5,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.icon != null) ...[
                Icon(
                  widget.icon,
                  color: SystemPagesTheme.textPrimary(widget.isDark),
                  size: 20,
                ),
                const SizedBox(width: 10),
              ],
              Text(
                widget.label,
                style: TextStyle(
                  color: SystemPagesTheme.textPrimary(widget.isDark),
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// GHOST BUTTON
// ============================================================================

class GhostButton extends StatefulWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool isDark;

  const GhostButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.isDark = true,
  });

  @override
  State<GhostButton> createState() => _GhostButtonState();
}

class _GhostButtonState extends State<GhostButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final color = _isHovered
        ? SystemPagesTheme.accent
        : SystemPagesTheme.textSecondary(widget.isDark);

    return GestureDetector(
      onTapDown: (_) => setState(() => _isHovered = true),
      onTapUp: (_) => setState(() => _isHovered = false),
      onTapCancel: () => setState(() => _isHovered = false),
      onTap: widget.onPressed,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.icon != null) ...[
              Icon(widget.icon, color: color, size: 18),
              const SizedBox(width: 8),
            ],
            Text(
              widget.label,
              style: TextStyle(
                color: color,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// ERROR TOAST
// ============================================================================

class ErrorToast extends StatelessWidget {
  final String message;
  final VoidCallback? onDismiss;
  final bool isDark;

  const ErrorToast({
    super.key,
    required this.message,
    this.onDismiss,
    this.isDark = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      decoration: BoxDecoration(
        color: SystemPagesTheme.error,
        borderRadius: BorderRadius.circular(SystemPagesTheme.radiusLg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 32,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: Colors.white, size: 20),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              message,
              style: const TextStyle(color: Colors.white, fontSize: 14),
            ),
          ),
          if (onDismiss != null) ...[
            const SizedBox(width: 8),
            GestureDetector(
              onTap: onDismiss,
              child: const Icon(Icons.close, color: Colors.white70, size: 20),
            ),
          ],
        ],
      ),
    );
  }
}

// ============================================================================
// GATEWAY LIST ITEM
// ============================================================================

class GatewayListItem extends StatelessWidget {
  final GatewayInfo gateway;
  final bool isSelected;
  final VoidCallback? onTap;
  final bool isDark;

  const GatewayListItem({
    super.key,
    required this.gateway,
    this.isSelected = false,
    this.onTap,
    this.isDark = true,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: BoxDecoration(
          color: isSelected
              ? SystemPagesTheme.accentLight
              : SystemPagesTheme.card(isDark),
          borderRadius: BorderRadius.circular(SystemPagesTheme.radiusMd),
          border: Border.all(
            color: isSelected
                ? SystemPagesTheme.accent
                : Colors.transparent,
            width: 2,
          ),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: isSelected
                    ? SystemPagesTheme.accent
                    : SystemPagesTheme.cardSecondary(isDark),
                borderRadius: BorderRadius.circular(SystemPagesTheme.radiusSm),
              ),
              child: Icon(
                isSelected ? Icons.check : Icons.dns_outlined,
                color: isSelected
                    ? Colors.white
                    : SystemPagesTheme.textSecondary(isDark),
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    gateway.name,
                    style: TextStyle(
                      color: SystemPagesTheme.textPrimary(isDark),
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    gateway.address,
                    style: TextStyle(
                      color: SystemPagesTheme.textMuted(isDark),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            // Badge
            if (gateway.badge != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: SystemPagesTheme.cardSecondary(isDark),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  gateway.badge!,
                  style: TextStyle(
                    color: SystemPagesTheme.textMuted(isDark),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.5,
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
// 1. SEARCHING FOR GATEWAYS PAGE
// ============================================================================

class SearchingGatewaysPage extends StatelessWidget {
  final bool isDark;
  final String? errorMessage;
  final VoidCallback? onRescan;
  final VoidCallback? onManual;
  final VoidCallback? onDismissError;

  const SearchingGatewaysPage({
    super.key,
    this.isDark = true,
    this.errorMessage,
    this.onRescan,
    this.onManual,
    this.onDismissError,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isLandscape = constraints.maxWidth > constraints.maxHeight;

        return Container(
          color: SystemPagesTheme.background(isDark),
          child: Stack(
            children: [
              // Main content
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Animated icon with pulse rings
                    SizedBox(
                      width: 100,
                      height: 100,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          const PulseRings(size: 80),
                          Icon(
                            Icons.wifi,
                            size: 48,
                            color: SystemPagesTheme.accent,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 28),
                    Text(
                      'Searching for Gateways',
                      style: TextStyle(
                        color: SystemPagesTheme.textPrimary(isDark),
                        fontSize: 24,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 40),
                      child: Text(
                        'Looking for FastyBird Smart Panel gateways on your network...',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: SystemPagesTheme.textMuted(isDark),
                          fontSize: 14,
                          height: 1.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    LoadingSpinner(size: 48, color: SystemPagesTheme.accent),
                  ],
                ),
              ),

              // Bottom buttons
              Positioned(
                left: 0,
                right: 0,
                bottom: isLandscape ? 32 : 48,
                child: _buildButtons(isLandscape),
              ),

              // Error toast
              if (errorMessage != null)
                Positioned(
                  left: 24,
                  right: 24,
                  bottom: isLandscape ? 100 : 160,
                  child: Center(
                    child: ErrorToast(
                      message: errorMessage!,
                      onDismiss: onDismissError,
                      isDark: isDark,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildButtons(bool isLandscape) {
    if (isLandscape) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SecondaryButton(
            label: 'Rescan',
            icon: Icons.refresh,
            onPressed: onRescan,
            isDark: isDark,
          ),
          const SizedBox(width: 16),
          SecondaryButton(
            label: 'Manual',
            icon: Icons.edit_outlined,
            onPressed: onManual,
            isDark: isDark,
          ),
        ],
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: Column(
        children: [
          SizedBox(
            width: double.infinity,
            child: SecondaryButton(
              label: 'Rescan',
              icon: Icons.refresh,
              onPressed: onRescan,
              isDark: isDark,
              minWidth: double.infinity,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: SecondaryButton(
              label: 'Manual Entry',
              icon: Icons.edit_outlined,
              onPressed: onManual,
              isDark: isDark,
              minWidth: double.infinity,
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// 2. SELECT GATEWAY PAGE
// ============================================================================

class SelectGatewayPage extends StatelessWidget {
  final bool isDark;
  final List<GatewayInfo> gateways;
  final String? selectedGatewayId;
  final ValueChanged<String>? onGatewaySelected;
  final VoidCallback? onConnect;
  final VoidCallback? onRescan;
  final VoidCallback? onManual;

  const SelectGatewayPage({
    super.key,
    this.isDark = true,
    required this.gateways,
    this.selectedGatewayId,
    this.onGatewaySelected,
    this.onConnect,
    this.onRescan,
    this.onManual,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isLandscape = constraints.maxWidth > constraints.maxHeight;

        return Container(
          color: SystemPagesTheme.background(isDark),
          padding: EdgeInsets.all(isLandscape ? 32 : 40),
          child: isLandscape
              ? _buildLandscapeLayout()
              : _buildPortraitLayout(),
        );
      },
    );
  }

  Widget _buildPortraitLayout() {
    return Column(
      children: [
        // Header
        _buildHeader(centered: true),
        const SizedBox(height: 32),
        // Gateway list
        Expanded(
          child: _buildGatewayList(),
        ),
        const SizedBox(height: 24),
        // Connect button
        SizedBox(
          width: double.infinity,
          child: PrimaryButton(
            label: 'Connect to Selected Gateway',
            icon: Icons.arrow_forward,
            onPressed: selectedGatewayId != null ? onConnect : null,
            minWidth: double.infinity,
          ),
        ),
        const SizedBox(height: 16),
        // Secondary actions
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            GhostButton(
              label: 'Rescan',
              icon: Icons.refresh,
              onPressed: onRescan,
              isDark: isDark,
            ),
            GhostButton(
              label: 'Manual',
              icon: Icons.edit_outlined,
              onPressed: onManual,
              isDark: isDark,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildLandscapeLayout() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left: Header
        SizedBox(
          width: 240,
          child: _buildHeader(centered: false),
        ),
        const SizedBox(width: 48),
        // Right: List and actions
        Expanded(
          child: Column(
            children: [
              // Gateway list
              Expanded(
                child: _buildGatewayList(),
              ),
              const SizedBox(height: 24),
              // Actions
              Row(
                children: [
                  PrimaryButton(
                    label: 'Connect to Selected Gateway',
                    icon: Icons.arrow_forward,
                    onPressed: selectedGatewayId != null ? onConnect : null,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  GhostButton(
                    label: 'Rescan',
                    icon: Icons.refresh,
                    onPressed: onRescan,
                    isDark: isDark,
                  ),
                  GhostButton(
                    label: 'Manual',
                    icon: Icons.edit_outlined,
                    onPressed: onManual,
                    isDark: isDark,
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHeader({required bool centered}) {
    return Column(
      crossAxisAlignment:
          centered ? CrossAxisAlignment.center : CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.wifi,
          size: 56,
          color: SystemPagesTheme.accent,
        ),
        const SizedBox(height: 20),
        Text(
          'Select a Gateway',
          style: TextStyle(
            color: SystemPagesTheme.textPrimary(isDark),
            fontSize: 24,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Found ${gateways.length} gateway(s) on your network',
          style: TextStyle(
            color: SystemPagesTheme.textMuted(isDark),
            fontSize: 13,
          ),
        ),
      ],
    );
  }

  Widget _buildGatewayList() {
    return ListView.separated(
      itemCount: gateways.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final gateway = gateways[index];
        return GatewayListItem(
          gateway: gateway,
          isSelected: gateway.id == selectedGatewayId,
          onTap: () => onGatewaySelected?.call(gateway.id),
          isDark: isDark,
        );
      },
    );
  }
}

// ============================================================================
// 3. FAILED TO START APPLICATION PAGE
// ============================================================================

class FailedToStartPage extends StatelessWidget {
  final bool isDark;
  final String errorMessage;
  final String? errorCode;
  final VoidCallback? onRestart;

  const FailedToStartPage({
    super.key,
    this.isDark = true,
    this.errorMessage = 'An unexpected error occurred while starting the application.',
    this.errorCode,
    this.onRestart,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isLandscape = constraints.maxWidth > constraints.maxHeight;

        return Container(
          color: SystemPagesTheme.background(isDark),
          child: Center(
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: isLandscape ? 80 : 40,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Error icon
                  IconContainer(
                    icon: Icons.error_outline,
                    color: SystemPagesTheme.error,
                  ),
                  const SizedBox(height: 24),
                  // Title
                  Text(
                    isLandscape ? 'Failed to Start Application' : 'Failed to Start',
                    style: TextStyle(
                      color: SystemPagesTheme.textPrimary(isDark),
                      fontSize: 24,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Subtitle
                  Text(
                    errorMessage,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: SystemPagesTheme.textMuted(isDark),
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                  // Error code
                  if (errorCode != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: SystemPagesTheme.card(isDark),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        errorCode!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: SystemPagesTheme.textMuted(isDark),
                          fontSize: 12,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 32),
                  // Restart button
                  PrimaryButton(
                    label: 'Restart Application',
                    icon: Icons.refresh,
                    onPressed: onRestart,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

// ============================================================================
// 4. CONFIGURATION REQUIRED PAGE
// ============================================================================

class ConfigurationRequiredPage extends StatelessWidget {
  final bool isDark;
  final String title;
  final String message;
  final String? hintText;
  final VoidCallback? onHintTap;

  const ConfigurationRequiredPage({
    super.key,
    this.isDark = true,
    this.title = 'Configuration Required',
    this.message = 'Room display requires a space (room) to be assigned.',
    this.hintText = 'Configure this display in Admin > Displays',
    this.onHintTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: SystemPagesTheme.background(isDark),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Settings icon with slash
              SizedBox(
                width: 72,
                height: 72,
                child: CustomPaint(
                  painter: _SettingsSlashPainter(
                    color: SystemPagesTheme.warning,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              // Title
              Text(
                title,
                style: TextStyle(
                  color: SystemPagesTheme.textPrimary(isDark),
                  fontSize: 24,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              // Message
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: SystemPagesTheme.textMuted(isDark),
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
              // Hint card
              if (hintText != null) ...[
                const SizedBox(height: 24),
                GestureDetector(
                  onTap: onHintTap,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 16,
                    ),
                    decoration: BoxDecoration(
                      color: SystemPagesTheme.card(isDark),
                      borderRadius: BorderRadius.circular(SystemPagesTheme.radiusMd),
                      boxShadow: isDark
                          ? null
                          : [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.05),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: SystemPagesTheme.infoLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.info_outline,
                            color: SystemPagesTheme.info,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Flexible(
                          child: Text(
                            hintText!,
                            style: const TextStyle(
                              color: SystemPagesTheme.info,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Icon(
                          Icons.chevron_right,
                          color: SystemPagesTheme.textMuted(isDark),
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SettingsSlashPainter extends CustomPainter {
  final Color color;

  _SettingsSlashPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;

    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width * 0.35;

    // Draw gear teeth
    const teethCount = 8;
    const toothHeight = 6.0;
    
    final path = Path();
    for (int i = 0; i < teethCount; i++) {
      final angle = (i / teethCount) * 2 * math.pi - math.pi / 2;
      final nextAngle = ((i + 0.5) / teethCount) * 2 * math.pi - math.pi / 2;
      
      final outerX = center.dx + (radius + toothHeight) * math.cos(angle);
      final outerY = center.dy + (radius + toothHeight) * math.sin(angle);
      final innerX = center.dx + radius * math.cos(nextAngle);
      final innerY = center.dy + radius * math.sin(nextAngle);
      
      if (i == 0) {
        path.moveTo(outerX, outerY);
      } else {
        path.lineTo(outerX, outerY);
      }
      path.lineTo(innerX, innerY);
    }
    path.close();
    canvas.drawPath(path, paint);

    // Draw center circle
    canvas.drawCircle(center, radius * 0.35, paint);

    // Draw diagonal slash
    final slashPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(
      Offset(size.width * 0.15, size.height * 0.15),
      Offset(size.width * 0.85, size.height * 0.85),
      slashPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ============================================================================
// 5. NO GATEWAYS FOUND PAGE
// ============================================================================

class NoGatewaysFoundPage extends StatelessWidget {
  final bool isDark;
  final VoidCallback? onRetry;
  final VoidCallback? onManual;

  const NoGatewaysFoundPage({
    super.key,
    this.isDark = true,
    this.onRetry,
    this.onManual,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isLandscape = constraints.maxWidth > constraints.maxHeight;

        return Container(
          color: SystemPagesTheme.background(isDark),
          child: Center(
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: isLandscape ? 80 : 40,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Warning WiFi icon
                  IconContainer(
                    icon: Icons.wifi_off,
                    color: SystemPagesTheme.warning,
                  ),
                  const SizedBox(height: 24),
                  // Title
                  Text(
                    'No Gateways Found',
                    style: TextStyle(
                      color: SystemPagesTheme.textPrimary(isDark),
                      fontSize: 24,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Message
                  Text(
                    'We couldn\'t find any FastyBird gateways on your network. Make sure your gateway is powered on and connected.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: SystemPagesTheme.textMuted(isDark),
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 32),
                  // Buttons
                  _buildButtons(isLandscape),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildButtons(bool isLandscape) {
    if (isLandscape) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          PrimaryButton(
            label: 'Try Again',
            icon: Icons.refresh,
            onPressed: onRetry,
          ),
          const SizedBox(width: 16),
          SecondaryButton(
            label: 'Enter Manually',
            icon: Icons.edit_outlined,
            onPressed: onManual,
            isDark: isDark,
          ),
        ],
      );
    }

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: PrimaryButton(
            label: 'Try Again',
            icon: Icons.refresh,
            onPressed: onRetry,
            minWidth: double.infinity,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: SecondaryButton(
            label: 'Enter Manually',
            icon: Icons.edit_outlined,
            onPressed: onManual,
            isDark: isDark,
            minWidth: double.infinity,
          ),
        ),
      ],
    );
  }
}

// ============================================================================
// 6. CONNECTION LOST PAGE
// ============================================================================

class ConnectionLostPage extends StatelessWidget {
  final bool isDark;
  final VoidCallback? onReconnect;
  final VoidCallback? onChangeGateway;

  const ConnectionLostPage({
    super.key,
    this.isDark = true,
    this.onReconnect,
    this.onChangeGateway,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isLandscape = constraints.maxWidth > constraints.maxHeight;

        return Container(
          color: SystemPagesTheme.background(isDark),
          child: Center(
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: isLandscape ? 80 : 40,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Error WiFi icon
                  IconContainer(
                    icon: Icons.wifi_off,
                    color: SystemPagesTheme.error,
                  ),
                  const SizedBox(height: 24),
                  // Title
                  Text(
                    'Connection Lost',
                    style: TextStyle(
                      color: SystemPagesTheme.textPrimary(isDark),
                      fontSize: 24,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Message
                  Text(
                    'Unable to connect to the gateway. Please check your network connection and try again.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: SystemPagesTheme.textMuted(isDark),
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 32),
                  // Buttons
                  _buildButtons(isLandscape),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildButtons(bool isLandscape) {
    if (isLandscape) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          PrimaryButton(
            label: 'Reconnect',
            icon: Icons.refresh,
            onPressed: onReconnect,
          ),
          const SizedBox(width: 16),
          SecondaryButton(
            label: 'Change Gateway',
            icon: Icons.wifi,
            onPressed: onChangeGateway,
            isDark: isDark,
          ),
        ],
      );
    }

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: PrimaryButton(
            label: 'Reconnect',
            icon: Icons.refresh,
            onPressed: onReconnect,
            minWidth: double.infinity,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: SecondaryButton(
            label: 'Change Gateway',
            icon: Icons.wifi,
            onPressed: onChangeGateway,
            isDark: isDark,
            minWidth: double.infinity,
          ),
        ),
      ],
    );
  }
}

// ============================================================================
// DEMO APP
// ============================================================================

void main() {
  runApp(const SystemPagesDemo());
}

class SystemPagesDemo extends StatefulWidget {
  const SystemPagesDemo({super.key});

  @override
  State<SystemPagesDemo> createState() => _SystemPagesDemoState();
}

class _SystemPagesDemoState extends State<SystemPagesDemo> {
  bool _isDark = true;
  int _currentPage = 0;
  String? _selectedGatewayId;
  bool _showError = true;

  final List<GatewayInfo> _gateways = const [
    GatewayInfo(
      id: '1',
      name: 'Living Room Gateway',
      address: '192.168.1.100:3000',
      badge: 'prod',
    ),
    GatewayInfo(
      id: '2',
      name: 'Emulator Gateway (Debug)',
      address: '10.0.2.2:3000',
      badge: 'vdev',
    ),
  ];

  final List<String> _pageNames = [
    'Searching',
    'Select Gateway',
    'Failed to Start',
    'Config Required',
    'No Gateways',
    'Connection Lost',
  ];

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          title: Text(_pageNames[_currentPage]),
          actions: [
            // Theme toggle
            IconButton(
              icon: Icon(_isDark ? Icons.light_mode : Icons.dark_mode),
              onPressed: () => setState(() => _isDark = !_isDark),
            ),
            // Error toggle (for searching page)
            if (_currentPage == 0)
              IconButton(
                icon: Icon(_showError ? Icons.error : Icons.error_outline),
                onPressed: () => setState(() => _showError = !_showError),
              ),
          ],
        ),
        body: Column(
          children: [
            // Page selector
            Container(
              height: 50,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _pageNames.length,
                itemBuilder: (context, index) {
                  final isSelected = index == _currentPage;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(
                      label: Text(_pageNames[index]),
                      selected: isSelected,
                      onSelected: (_) => setState(() => _currentPage = index),
                      selectedColor: SystemPagesTheme.accent,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.white : Colors.grey,
                        fontSize: 12,
                      ),
                    ),
                  );
                },
              ),
            ),
            // Page content
            Expanded(
              child: _buildCurrentPage(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentPage() {
    switch (_currentPage) {
      case 0:
        return SearchingGatewaysPage(
          isDark: _isDark,
          errorMessage: _showError
              ? 'Could not connect to the stored backend server'
              : null,
          onRescan: () {},
          onManual: () {},
          onDismissError: () => setState(() => _showError = false),
        );
      case 1:
        return SelectGatewayPage(
          isDark: _isDark,
          gateways: _gateways,
          selectedGatewayId: _selectedGatewayId,
          onGatewaySelected: (id) => setState(() => _selectedGatewayId = id),
          onConnect: () {},
          onRescan: () {},
          onManual: () {},
        );
      case 2:
        return FailedToStartPage(
          isDark: _isDark,
          errorMessage: 'An unexpected error occurred while starting the application. Please try restarting.',
          errorCode: 'InvalidArgument: Type CoversTargetsRepository is already registered inside GetIt',
          onRestart: () {},
        );
      case 3:
        return ConfigurationRequiredPage(
          isDark: _isDark,
          onHintTap: () {},
        );
      case 4:
        return NoGatewaysFoundPage(
          isDark: _isDark,
          onRetry: () {},
          onManual: () {},
        );
      case 5:
        return ConnectionLostPage(
          isDark: _isDark,
          onReconnect: () {},
          onChangeGateway: () {},
        );
      default:
        return const SizedBox();
    }
  }
}
