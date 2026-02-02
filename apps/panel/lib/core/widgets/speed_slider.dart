import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
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

  /// Optional footer widget rendered inside the container below the step labels.
  /// Useful for placing mode selectors or other controls within the slider box.
  final Widget? footer;

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
    this.footer,
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

    final displayLabel = widget.enabled ? widget.label : (widget.disabledLabel ?? widget.label);

    return AnimatedOpacity(
      opacity: widget.enabled ? 1.0 : 0.5,
      duration: const Duration(milliseconds: 200),
      child: Container(
        padding: EdgeInsets.symmetric(
          vertical: AppSpacings.pMd,
          horizontal: AppSpacings.pLg,
        ),
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
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
            SliderWithSteps(
              value: _displayValue,
              activeColor: effectiveActiveColor,
              overlayColor: widget.overlayColor,
              steps: widget.steps,
              enabled: widget.enabled,
              discrete: widget.discrete,
              onChanged: widget.onChanged,
            ),
            if (widget.footer != null) ...[
              AppSpacings.spacingMdVertical,
              widget.footer!,
            ],
          ],
        ),
      ),
    );
  }
}
