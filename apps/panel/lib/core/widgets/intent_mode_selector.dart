import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The visual state of a mode in the intent selector.
///
/// - [active]: Mode was set by intent and still matches current state
/// - [matched]: Mode matches current state but wasn't set by intent
/// - [lastIntent]: Last applied intent when no mode matches
/// - [none]: Mode is not highlighted
enum IntentModeState {
  active,
  matched,
  lastIntent,
  none,
}

/// The segmented control ([ModeSelector]) for intent-based domains (lighting,
/// shading), with a corner icon that tells how the mode came about:
///
/// - Active: selected, with a check in the selected colour
/// - Matched: selected, with an approximately-equal sign
/// - Last intent: not selected, with a history icon in `text.secondary`
class IntentModeSelector<T> extends StatelessWidget {
  /// List of mode options to display
  final List<ModeOption<T>> modes;

  /// Mode that was set by intent and still matches
  final T? activeValue;

  /// Mode that matches current state but wasn't set by intent
  final T? matchedValue;

  /// Last applied intent when no mode matches
  final T? lastIntentValue;

  /// Callback when a mode is selected
  final ValueChanged<T> onChanged;

  /// Orientation of the selector (horizontal or vertical)
  final ModeSelectorOrientation orientation;

  /// Where to place the icon relative to the label
  final ModeSelectorIconPlacement iconPlacement;

  /// Whether to show labels
  final bool? showLabels;

  /// Minimum width for each mode button (horizontal layout)
  final double minButtonWidth;

  /// Minimum height for each mode button in vertical scrollable orientation
  final double minButtonHeight;

  /// Fixed width for the entire selector (vertical layout)
  final double? fixedWidth;

  /// Whether the selector should be scrollable
  final bool scrollable;

  /// The selected segment's colour; [ThemeColors.primary] is the accent.
  final ThemeColors color;

  /// Pending, not confirmed or disabled look.
  final ControlState state;

  const IntentModeSelector({
    super.key,
    required this.modes,
    required this.onChanged,
    this.activeValue,
    this.matchedValue,
    this.lastIntentValue,
    this.orientation = ModeSelectorOrientation.horizontal,
    this.iconPlacement = ModeSelectorIconPlacement.left,
    this.showLabels,
    this.minButtonWidth = 80.0,
    this.minButtonHeight = 56.0,
    this.fixedWidth,
    this.scrollable = false,
    this.color = ThemeColors.primary,
    this.state = ControlState.idle,
  });

  /// The visual state of [modeValue].
  IntentModeState stateOf(T modeValue) {
    if (activeValue == modeValue) return IntentModeState.active;
    if (matchedValue == modeValue) return IntentModeState.matched;
    if (lastIntentValue == modeValue) return IntentModeState.lastIntent;
    return IntentModeState.none;
  }

  @override
  Widget build(BuildContext context) {
    if (modes.isEmpty) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final selected = activeValue ?? matchedValue;
    final statusIcons = <T, (IconData, Color)>{};

    for (final mode in modes) {
      final tint = ControlTint.of(theme, mode.color ?? color);
      final icon = switch (stateOf(mode.value)) {
        IntentModeState.active => (MdiIcons.check, tint.text),
        IntentModeState.matched => (MdiIcons.approximatelyEqual, tint.text),
        IntentModeState.lastIntent => (
          MdiIcons.history,
          theme.neutrals.textSecondary,
        ),
        IntentModeState.none => null,
      };
      if (icon != null) statusIcons[mode.value] = icon;
    }

    final selector = ModeSelector<T>(
      modes: modes,
      selectedValue: selected,
      onChanged: onChanged,
      orientation: orientation,
      iconPlacement: iconPlacement,
      color: color,
      showLabels: showLabels,
      minButtonWidth: minButtonWidth,
      minButtonHeight: minButtonHeight,
      scrollable: scrollable,
      statusIcons: statusIcons,
      state: state,
    );

    if (orientation == ModeSelectorOrientation.vertical && fixedWidth != null) {
      return SizedBox(width: fixedWidth, child: selector);
    }

    return selector;
  }
}
