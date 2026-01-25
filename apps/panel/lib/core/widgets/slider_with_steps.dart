import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A simple slider widget with step labels below.
///
/// Unlike [SpeedSlider], this widget does not include a container, label,
/// or value display - just the slider and step labels. Useful when you want
/// to embed a slider within an existing card or layout.
///
/// Features:
/// - Continuous or discrete step modes
/// - Customizable step labels
/// - Theme-aware colors with custom active color support
/// - Custom thumb with colored border for better visibility
class SliderWithSteps extends StatelessWidget {
  /// Current value (0.0 to 1.0)
  final double value;

  /// Active/accent color for the slider track and thumb border
  final Color? activeColor;

  /// Overlay color when dragging
  final Color? overlayColor;

  /// Callback when value changes
  final ValueChanged<double>? onChanged;

  /// Labels to show below the slider (e.g., ['Off', 'Low', 'Med', 'High', 'Max'])
  final List<String> steps;

  /// Whether the slider is enabled
  final bool enabled;

  /// When true, the slider snaps to discrete step positions.
  /// When false, the slider allows continuous 0-100% values.
  final bool discrete;

  const SliderWithSteps({
    super.key,
    required this.value,
    this.activeColor,
    this.overlayColor,
    this.onChanged,
    this.steps = const ['0%', '25%', '50%', '75%', '100%'],
    this.enabled = true,
    this.discrete = false,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();

    double scale(double val) =>
        screenService.scale(val, density: visualDensityService.density);

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor =
        activeColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;
    final trackColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;

    // For discrete mode, calculate divisions based on steps
    final divisions = discrete && steps.length > 1 ? steps.length - 1 : null;

    // Disabled active track color (left part of track when disabled)
    final disabledActiveColor =
        isDark ? AppFillColorDark.base : AppFillColorLight.base;

    // Active track: accent when enabled, muted gray when disabled
    final sliderActiveColor = enabled ? effectiveActiveColor : disabledActiveColor;
    // Thumb border matches active track
    final thumbBorderColor = enabled ? effectiveActiveColor : disabledActiveColor;
    // Thumb fill: dark background when enabled, matches active track (left part) when disabled
    final thumbFillColor = enabled
        ? (isDark ? AppFillColorDark.darker : AppColors.white)
        : disabledActiveColor;

    final clampedValue = value.clamp(0.0, 1.0);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: sliderActiveColor,
              inactiveTrackColor: trackColor,
              thumbColor: thumbFillColor,
              overlayColor: overlayColor ??
                  effectiveActiveColor.withValues(alpha: 0.15),
              trackHeight: scale(8),
              thumbShape: _SliderThumbWithBorder(
                thumbRadius: scale(12),
                fillColor: thumbFillColor,
                borderColor: thumbBorderColor,
                borderWidth: scale(2),
              ),
            ),
            child: IgnorePointer(
              ignoring: !enabled,
              child: Slider(
                value: clampedValue,
                divisions: divisions,
                onChanged: enabled ? onChanged : null,
              ),
            ),
          ),
          AppSpacings.spacingXsVertical,
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: steps
                .map((s) => Text(
                      s,
                      style: TextStyle(
                        color: mutedColor,
                        fontSize: AppFontSize.extraSmall,
                      ),
                    ))
                .toList(),
          ),
        ],
      );
  }
}

/// Custom slider thumb shape with colored border for better contrast
class _SliderThumbWithBorder extends SliderComponentShape {
  final double thumbRadius;
  final Color fillColor;
  final Color borderColor;
  final double borderWidth;

  const _SliderThumbWithBorder({
    required this.thumbRadius,
    required this.fillColor,
    required this.borderColor,
    required this.borderWidth,
  });

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) {
    return Size.fromRadius(thumbRadius);
  }

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    required bool isDiscrete,
    required TextPainter labelPainter,
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required TextDirection textDirection,
    required double value,
    required double textScaleFactor,
    required Size sizeWithOverflow,
  }) {
    final Canvas canvas = context.canvas;

    // Draw fill
    final fillPaint = Paint()
      ..color = fillColor
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, thumbRadius, fillPaint);

    // Draw colored border
    final borderPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth;
    canvas.drawCircle(center, thumbRadius - borderWidth / 2, borderPaint);
  }
}
