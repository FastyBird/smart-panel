import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A reusable speed/level slider widget with labeled steps.
///
/// Features:
/// - Continuous or discrete step modes
/// - Customizable step labels
/// - Theme-aware colors with custom active color support
/// - Custom thumb with colored border for better visibility
class SpeedSlider extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

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

  /// Label shown above the slider (default: 'Speed')
  final String label;

  /// Label shown when disabled (default: 'Speed (Auto)')
  final String? disabledLabel;

  SpeedSlider({
    super.key,
    required this.value,
    this.activeColor,
    this.overlayColor,
    this.onChanged,
    this.steps = const ['Off', 'Low', 'Med', 'High', 'Max'],
    this.enabled = true,
    this.discrete = false,
    this.label = 'Speed',
    this.disabledLabel,
  });

  double _scale(double val) =>
      _screenService.scale(val, density: _visualDensityService.density);

  /// Get the current step label for discrete mode
  String _getCurrentStepLabel() {
    if (steps.isEmpty) return '';
    final index = (value * (steps.length - 1)).round().clamp(0, steps.length - 1);
    return steps[index];
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor =
        activeColor ?? (isDark ? AppColorsDark.info : AppColorsLight.info);
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;
    final trackColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    final thumbFillColor =
        isDark ? AppFillColorDark.darker : Colors.white;

    // For discrete mode, calculate divisions based on steps
    final divisions = discrete ? steps.length - 1 : null;

    final displayLabel = enabled ? label : (disabledLabel ?? '$label (Auto)');

    return Opacity(
      opacity: enabled ? 1.0 : 0.5,
      child: Container(
        padding: EdgeInsets.all(_scale(20)),
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.round),
          border: Border.all(color: borderColor, width: _scale(1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  displayLabel,
                  style: TextStyle(
                    color: secondaryColor,
                    fontSize: AppFontSize.small,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  discrete ? _getCurrentStepLabel() : '${(value * 100).toInt()}%',
                  style: TextStyle(
                    color: textColor,
                    fontSize: AppFontSize.extraLarge,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            AppSpacings.spacingMdVertical,
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                activeTrackColor: effectiveActiveColor,
                inactiveTrackColor: trackColor,
                thumbColor: thumbFillColor,
                overlayColor: overlayColor ??
                    (isDark ? AppColorsDark.infoLight7 : AppColorsLight.infoLight7),
                trackHeight: _scale(8),
                thumbShape: _SliderThumbWithBorder(
                  thumbRadius: _scale(12),
                  fillColor: thumbFillColor,
                  borderColor: effectiveActiveColor,
                  borderWidth: _scale(2),
                ),
              ),
              child: Slider(
                value: value,
                divisions: divisions,
                onChanged: enabled ? onChanged : null,
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
        ),
      ),
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
