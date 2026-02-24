import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';

/// List item widget for displaying a discovered backend/gateway
class GatewayListItem extends StatelessWidget {
  final DiscoveredBackend backend;
  final bool isSelected;
  final VoidCallback? onTap;
  final bool isDark;

  const GatewayListItem({
    super.key,
    required this.backend,
    this.isSelected = false,
    this.onTap,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    final accent = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final accentLight = isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pMd,
        ),
        decoration: BoxDecoration(
          color: isSelected ? accentLight : isDark ? AppFillColorDark.base : AppFillColorLight.blank,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isSelected ? accent : AppColors.blank,
            width: AppSpacings.pXs,
          ),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                    color: AppColors.black.withValues(alpha: 0.05),
                    blurRadius: AppSpacings.pMd,
                    offset: Offset(0, AppSpacings.pXs),
                  ),
                ],
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: AppSpacings.scale(44),
              height: AppSpacings.scale(44),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isSelected
                    ? accent
                    : isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
              ),
              child: Icon(
                isSelected ? MdiIcons.check : MdiIcons.server,
                color: isSelected
                    ? AppColors.white
                    : isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
                size: AppSpacings.pLg + AppSpacings.pMd,
              ),
            ),
            AppSpacings.spacingMdHorizontal,
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    backend.name,
                    style: TextStyle(
                      color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  AppSpacings.spacingXsVertical,
                  Text(
                    backend.displayAddress,
                    style: TextStyle(
                      color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                      fontSize: AppFontSize.small,
                    ),
                  ),
                ],
              ),
            ),
            // Badge
            if (backend.version != null)
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pSm,
                  vertical: AppSpacings.pXs,
                ),
                decoration: BoxDecoration(
                  color: isDark ? AppFillColorDark.dark : AppFillColorLight.dark,
                  borderRadius: BorderRadius.circular(AppBorderRadius.small),
                ),
                child: Text(
                  'v${backend.version}',
                  style: TextStyle(
                    color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                    letterSpacing: AppSpacings.scale(0.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Animated pulse rings that expand outward from center
/// Used for discovery/searching states
class PulseRings extends StatefulWidget {
  final double size;
  final Color color;
  final int ringCount;

  const PulseRings({
    super.key,
    this.size = 80,
    required this.color,
    this.ringCount = 2,
  });

  @override
  State<PulseRings> createState() => _PulseRingsState();
}

class _PulseRingsState extends State<PulseRings> with TickerProviderStateMixin {
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
                      border: Border.all(color: widget.color, width: AppSpacings.scale(2)),
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

/// Custom loading spinner with arc animation
class LoadingSpinner extends StatefulWidget {
  final double size;
  final Color color;
  final double strokeWidth;

  const LoadingSpinner({
    super.key,
    this.size = 48,
    required this.color,
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
  bool shouldRepaint(covariant _SpinnerPainter oldDelegate) =>
      color != oldDelegate.color || strokeWidth != oldDelegate.strokeWidth;
}
