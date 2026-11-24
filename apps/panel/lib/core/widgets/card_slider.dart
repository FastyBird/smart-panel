import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:flutter/material.dart';

// -----------------------------------------------------------------------------
// CardSlider
// -----------------------------------------------------------------------------

/// A card with a label, the value and the one slider
/// (docs/display-ui-design-spec.md §5).
///
/// The value is a Barlow card value (18, 28 on Expanded). Step labels are
/// dropped; in [discrete] mode [steps] sets the snap points and the value
/// shows the current step's name. [showSteps] is kept so callers compile.
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

  /// Snap points in [discrete] mode, and the value's name at each
  /// (e.g., ['Off', 'Low', 'Med', 'High', 'Max']).
  final List<String> steps;

  /// No longer draws anything; step labels are dropped.
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
  /// (AppFillColorLight.light / AppFillColorDark.lighter), matching control cards.
  final Color? cardColor;

  /// Optional card border color. When null, uses the default
  /// (AppBorderColorLight.darker / AppBorderColorDark.light).
  final Color? borderColor;

  /// When false, removes the card border (useful when embedded in a sheet/drawer).
  final bool showBorder;

  /// Pending, not confirmed or disabled look of the slider.
  final ControlState state;

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
    this.showBorder = true,
    this.state = ControlState.idle,
  });

  @override
  State<CardSlider> createState() => _CardSliderState();
}

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

class _CardSliderState extends State<CardSlider> {
  // --- Value sync state ---
  /// Displayed value to prevent jumps during state changes.
  double _displayValue = 0.0;

  /// Whether the user is actively dragging the slider.
  /// When true, external value updates are ignored to prevent jank.
  bool _isDragging = false;

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

    // A slider that stops taking input mid-drag never calls onChangeEnd
    // (the slider passes null), so end the drag here; otherwise device
    // values would be ignored from now on.
    final interactive = widget.enabled &&
        widget.onChanged != null &&
        widget.state != ControlState.disabled;
    if (!interactive) _isDragging = false;

    // Never overwrite display value while user is dragging
    if (_isDragging) return;

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
    final neutrals = Theme.of(context).neutrals;
    final displayLabel =
        widget.enabled ? widget.label : (widget.disabledLabel ?? widget.label);
    final isExpanded =
        locator<ScreenService>().sizeClass == ScreenSizeClass.expanded;

    // A card value (spec §3: Barlow 18, 28 on Expanded); a step's name is
    // text, so it stays Roboto 12.
    final valueFontSize = widget.discrete
        ? AppFontSize.small
        : AppSpacings.scale(isExpanded ? 28 : 18);

    final valueText = widget.discrete
        ? _getCurrentStepLabel()
        : '${(_displayValue * 100).toInt()} %';

    return BaseCard(
      color: widget.cardColor,
      borderColor: widget.borderColor,
      borderWidth: widget.showBorder ? null : 0,
      headerIcon: widget.icon,
      headerTitle: displayLabel.toUpperCase(),
      headerTitleColor:
          widget.enabled ? neutrals.textSecondary : neutrals.textDisabled,
      headerTrailing: widget.showHeaderValue
          ? Text(
              valueText,
              style: TextStyle(
                color: widget.enabled
                    ? neutrals.textPrimary
                    : neutrals.textDisabled,
                fontFamily: widget.discrete ? null : AppNumeralFont.family,
                fontSize: valueFontSize,
                fontWeight: AppNumeralFont.value,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          _buildSliderRow(context),
          if (widget.footer != null) widget.footer!,
        ],
      ),
    );
  }

  Widget _buildSliderRow(BuildContext context) {
    final slider = SliderWithSteps(
      value: _displayValue,
      themeColor: widget.themeColor,
      steps: widget.steps,
      enabled: widget.enabled,
      discrete: widget.discrete,
      state: widget.state,
      semanticLabel: widget.label,
      onChanged: widget.onChanged != null
          ? (v) {
              setState(() {
                _isDragging = true;
                _displayValue = v.clamp(0.0, 1.0);
              });
              widget.onChanged!(v);
            }
          : null,
      onChangeEnd: (_) {
        _isDragging = false;
      },
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
