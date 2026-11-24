import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:flutter/material.dart';

/// A bare slider for an existing card or layout: the one [AppSlider].
///
/// Step labels are dropped (docs/display-ui-design-spec.md §5: presets sit
/// beside the slider instead). [steps] still sets the snap points when
/// [discrete] is true; [showSteps] is kept so callers compile and no longer
/// draws anything.
class SliderWithSteps extends StatelessWidget {
  /// Current value (0.0 to 1.0)
  final double value;

  /// The domain colour of the fill and the thumb's ring; [ThemeColors.primary]
  /// (the default) is the accent.
  final ThemeColors themeColor;

  /// Callback when value changes
  final ValueChanged<double>? onChanged;

  /// Snap points when [discrete] is true.
  final List<String> steps;

  /// Whether the slider is enabled
  final bool enabled;

  /// When true, the slider snaps to one position per entry in [steps].
  final bool discrete;

  /// No longer draws anything; step labels are dropped.
  final bool showSteps;

  /// When true, renders the slider vertically (bottom-to-top).
  final bool vertical;

  /// A track that shows the value's meaning; replaces the filled track.
  final List<Color>? trackGradientColors;

  /// The thumb's fill, for colour sliders where it shows the picked colour.
  final Color? thumbFillColor;

  /// The thumb's ring, for colour sliders where it shows the picked colour;
  /// defaults to the fill colour.
  final Color? thumbBorderColor;

  /// An already resolved fill colour. Wins over [themeColor].
  final Color? activeColor;

  /// Called when the user is done selecting a new value for the slider.
  final ValueChanged<double>? onChangeEnd;

  /// Pending, not confirmed or disabled look.
  final ControlState state;

  /// The hero card's slider size.
  final bool hero;

  /// What the slider sets, for screen readers.
  final String? semanticLabel;

  const SliderWithSteps({
    super.key,
    required this.value,
    this.themeColor = ThemeColors.primary,
    this.onChanged,
    this.onChangeEnd,
    this.steps = const ['0%', '25%', '50%', '75%', '100%'],
    this.enabled = true,
    this.discrete = false,
    this.showSteps = true,
    this.vertical = false,
    this.trackGradientColors,
    this.thumbFillColor,
    this.thumbBorderColor,
    this.activeColor,
    this.state = ControlState.idle,
    this.hero = false,
    this.semanticLabel,
  });

  @override
  Widget build(BuildContext context) {
    final slider = AppSlider(
      value: value,
      color: themeColor,
      activeColor: activeColor,
      trackGradient: trackGradientColors,
      thumbColor: thumbFillColor,
      ringColor: thumbBorderColor,
      divisions: discrete && steps.length > 1 ? steps.length - 1 : null,
      state: enabled ? state : ControlState.disabled,
      hero: hero,
      onChanged: onChanged,
      onChangeEnd: onChangeEnd,
      semanticLabel: semanticLabel,
    );

    return vertical ? RotatedBox(quarterTurns: 3, child: slider) : slider;
  }
}
