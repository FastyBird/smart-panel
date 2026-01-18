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
/// - Smooth animated transitions when value or enabled state changes
class SpeedSlider extends StatefulWidget {
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

  /// Label shown when disabled (defaults to same as label)
  final String? disabledLabel;

  const SpeedSlider({
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

  @override
  State<SpeedSlider> createState() => _SpeedSliderState();
}

class _SpeedSliderState extends State<SpeedSlider> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  // Track the displayed value to prevent jumps during state changes
  double _displayValue = 0.0;

  // Grace period after enabled state changes to ignore value fluctuations
  DateTime? _enabledStateChangeTime;
  static const _gracePeriod = Duration(milliseconds: 300);

  @override
  void initState() {
    super.initState();
    _displayValue = widget.value.clamp(0.0, 1.0);
  }

  @override
  void didUpdateWidget(SpeedSlider oldWidget) {
    super.didUpdateWidget(oldWidget);

    final enabledStateChanged = oldWidget.enabled != widget.enabled;

    if (enabledStateChanged) {
      // Mark when enabled state changed to start grace period
      _enabledStateChangeTime = DateTime.now();
      // Update display value to new value, then ignore subsequent fluctuations
      _displayValue = widget.value.clamp(0.0, 1.0);
      return;
    }

    // Check if we're still in the grace period after an enabled state change
    final inGracePeriod = _enabledStateChangeTime != null &&
        DateTime.now().difference(_enabledStateChangeTime!) < _gracePeriod;

    if (inGracePeriod) {
      // Ignore value changes during grace period to prevent animation glitches
      return;
    }

    // Clear grace period marker
    _enabledStateChangeTime = null;

    // Normal value update
    _displayValue = widget.value.clamp(0.0, 1.0);
  }

  double _scale(double val) =>
      _screenService.scale(val, density: _visualDensityService.density);

  /// Get the current step label for discrete mode
  String _getCurrentStepLabel() {
    if (widget.steps.isEmpty) return '';
    final clampedValue = _displayValue.clamp(0.0, 1.0);
    final index = (clampedValue * (widget.steps.length - 1)).round().clamp(0, widget.steps.length - 1);
    return widget.steps[index];
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor =
        widget.activeColor ?? (isDark ? AppColorsDark.info : AppColorsLight.info);
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
        isDark ? AppFillColorDark.darker : AppColors.white;

    // For discrete mode, calculate divisions based on steps
    // divisions must be null or > 0, so use null if steps has fewer than 2 items
    final divisions = widget.discrete && widget.steps.length > 1 ? widget.steps.length - 1 : null;

    final displayLabel = widget.enabled ? widget.label : (widget.disabledLabel ?? widget.label);

    // When disabled, use track color for both active track and thumb border
    final sliderActiveColor = widget.enabled ? effectiveActiveColor : trackColor;
    final thumbBorderColor = widget.enabled ? effectiveActiveColor : trackColor;

    return AnimatedOpacity(
      opacity: widget.enabled ? 1.0 : 0.5,
      duration: const Duration(milliseconds: 200),
      child: Container(
        padding: AppSpacings.paddingLg,
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
                  widget.discrete ? _getCurrentStepLabel() : '${(_displayValue * 100).toInt()}%',
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
                activeTrackColor: sliderActiveColor,
                inactiveTrackColor: trackColor,
                thumbColor: thumbFillColor,
                overlayColor: widget.overlayColor ??
                    (isDark ? AppColorsDark.infoLight7 : AppColorsLight.infoLight7),
                trackHeight: _scale(8),
                thumbShape: _SliderThumbWithBorder(
                  thumbRadius: _scale(12),
                  fillColor: thumbFillColor,
                  borderColor: thumbBorderColor,
                  borderWidth: _scale(2),
                ),
              ),
              child: IgnorePointer(
                ignoring: !widget.enabled,
                child: Slider(
                  value: _displayValue,
                  divisions: divisions,
                  onChanged: widget.onChanged,
                ),
              ),
            ),
            AppSpacings.spacingXsVertical,
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: widget.steps
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
