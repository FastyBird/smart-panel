import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:flutter/material.dart';

// -----------------------------------------------------------------------------
// CardSlider
// -----------------------------------------------------------------------------

/// A reusable card-style slider widget with labeled steps.
///
/// Features:
/// - Continuous or discrete step modes
/// - Customizable step labels
/// - Theme-aware colors via [ThemeColorFamily] and [themeColor]
/// - Custom thumb with colored border for better visibility
/// - Smooth animated transitions when value or enabled state changes
class CardSlider extends StatefulWidget {
  // --- Display ---
  /// Label shown above the slider (e.g., 'Speed', 'Volume')
  final String label;

  /// Optional icon shown next to the label. When null, only the label is shown.
  final IconData? icon;

  /// Label shown when disabled (defaults to same as label)
  final String? disabledLabel;

  // --- Value ---
  /// Current value (0.0 to 1.0)
  final double value;

  /// Callback when value changes
  final ValueChanged<double>? onChanged;

  /// Labels to show below the slider (e.g., ['Off', 'Low', 'Med', 'High', 'Max'])
  final List<String> steps;

  /// Whether to show step labels below the slider. Defaults to true.
  final bool showSteps;

  /// When true, the slider snaps to discrete step positions.
  /// When false, the slider allows continuous 0-100% values.
  final bool discrete;

  // --- Behavior & appearance ---
  /// Whether the slider is enabled
  final bool enabled;

  /// Theme color key for the slider. Resolved via [ThemeColorFamily].
  final ThemeColors themeColor;

  /// Optional footer widget rendered inside the container below the step labels.
  /// Useful for placing mode selectors or other controls within the slider box.
  final Widget? footer;

  /// Optional widget rendered to the left of the slider (e.g., mute button).
  final Widget? leading;

  /// Optional widget rendered to the right of the slider (e.g., value label).
  final Widget? trailing;

  /// Whether to show the value percentage/label in the header. Set to false when
  /// [trailing] displays the value (e.g., volume card with percentage on the right).
  final bool showHeaderValue;

  /// Optional card background color. When null, uses the default
  /// (AppFillColorLight.blank / AppFillColorDark.light).
  final Color? cardColor;

  /// Optional card border color. When null, uses the default
  /// (AppBorderColorLight.light / AppBorderColorDark.light).
  final Color? borderColor;

  const CardSlider({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.disabledLabel,
    this.onChanged,
    this.steps = const ['Off', 'Low', 'Med', 'High', 'Max'],
    this.showSteps = true,
    this.discrete = false,
    this.enabled = true,
    this.themeColor = ThemeColors.primary,
    this.footer,
    this.leading,
    this.trailing,
    this.showHeaderValue = true,
    this.cardColor,
    this.borderColor,
  });

  @override
  State<CardSlider> createState() => _CardSliderState();
}

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

class _CardSliderState extends State<CardSlider> {
  // --- Dependencies ---
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  // --- Value sync state ---
  /// Displayed value to prevent jumps during state changes.
  double _displayValue = 0.0;

  /// Grace period after enabled-state changes to ignore value fluctuations.
  DateTime? _enabledStateChangeTime;
  static const _gracePeriod = Duration(milliseconds: 300);

  // --- Lifecycle ---

  @override
  void initState() {
    super.initState();
    _displayValue = widget.value.clamp(0.0, 1.0);
  }

  @override
  void didUpdateWidget(CardSlider oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.enabled != widget.enabled) {
      _enabledStateChangeTime = DateTime.now();
      _displayValue = widget.value.clamp(0.0, 1.0);
      return;
    }

    final inGracePeriod = _enabledStateChangeTime != null &&
        DateTime.now().difference(_enabledStateChangeTime!) < _gracePeriod;
    if (inGracePeriod) return;

    _enabledStateChangeTime = null;
    _displayValue = widget.value.clamp(0.0, 1.0);
  }

  // --- Helpers ---

  double _scale(double val) =>
      _screenService.scale(val, density: _visualDensityService.density);

  String _getCurrentStepLabel() {
    if (widget.steps.isEmpty) return '';
    final clamped = _displayValue.clamp(0.0, 1.0);
    final index =
        (clamped * (widget.steps.length - 1)).round().clamp(0, widget.steps.length - 1);
    return widget.steps[index];
  }

  // --- Build ---

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = (
      card: widget.cardColor ?? (isDark ? AppFillColorDark.light : AppFillColorLight.blank),
      border: widget.borderColor ?? (isDark ? AppBorderColorDark.light : AppBorderColorLight.light),
      text: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
      secondary: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
    );
    final displayLabel =
        widget.enabled ? widget.label : (widget.disabledLabel ?? widget.label);

    return AnimatedOpacity(
      opacity: widget.enabled ? 1.0 : 0.5,
      duration: const Duration(milliseconds: 200),
      child: Container(
        padding: AppSpacings.paddingMd,
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isDark ? colors.card : colors.border,
            width: _scale(1),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: AppSpacings.pMd,
          children: [
            _buildHeader(context, colors, displayLabel),
            _buildSliderRow(context),
            if (widget.footer != null) widget.footer!,
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    ({Color card, Color border, Color text, Color secondary}) colors,
    String displayLabel,
  ) {
    final valueText = widget.discrete
        ? _getCurrentStepLabel()
        : '${(_displayValue * 100).toInt()}%';

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          spacing: AppSpacings.pSm,
          children: [
            if (widget.icon != null)
              Icon(
                widget.icon,
                size: AppFontSize.small,
                color: colors.secondary,
              ),
            Text(
              displayLabel.toUpperCase(),
              style: TextStyle(
                color: colors.secondary,
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        if (widget.showHeaderValue)
          Text(
            valueText,
            style: TextStyle(
              color: colors.text,
              fontSize: AppFontSize.extraLarge,
              fontWeight: FontWeight.w600,
            ),
          ),
      ],
    );
  }

  Widget _buildSliderRow(BuildContext context) {
    final slider = SliderWithSteps(
      value: _displayValue,
      themeColor: widget.themeColor,
      steps: widget.steps,
      showSteps: widget.showSteps,
      enabled: widget.enabled,
      discrete: widget.discrete,
      onChanged: widget.onChanged,
    );

    if (widget.leading != null || widget.trailing != null) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        spacing: AppSpacings.pMd,
        children: [
          if (widget.leading != null) widget.leading!,
          Expanded(child: slider),
          if (widget.trailing != null) widget.trailing!,
        ],
      );
    }

    return slider;
  }
}
