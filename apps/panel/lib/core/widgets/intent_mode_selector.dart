import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The visual state of a mode in the intent selector.
///
/// - [active]: Mode was set by intent and still matches current state (2px border, mode color)
/// - [matched]: Mode matches current state but wasn't set by intent (1px border, mode color)
/// - [lastIntent]: Last applied intent when no mode matches (1px border, neutral color)
/// - [none]: Mode is not highlighted
enum IntentModeState {
  active,
  matched,
  lastIntent,
  none,
}

/// A mode selector specifically designed for intent-based domains (lighting, shading).
///
/// This widget wraps [ModeSelector] and adds support for distinguishing between:
/// - Active intent: mode set by intent that still matches
/// - Matched: mode that matches current state but wasn't set by intent
/// - Last intent: last applied intent when no mode currently matches
///
/// Visual distinction:
/// - Active: primary color, status icon with check
/// - Matched: info color, status icon with approximately-equal
/// - Last intent: neutral color, status icon with history
class IntentModeSelector<T> extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// List of mode options to display
  final List<ModeOption<T>> modes;

  /// Mode that was set by intent and still matches (shown with 2px border)
  final T? activeValue;

  /// Mode that matches current state but wasn't set by intent (shown with 1px border)
  final T? matchedValue;

  /// Last applied intent when no mode matches (shown with neutral 1px border)
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
  /// When set, buttons will have this fixed width for proper status icon positioning
  final double? fixedWidth;

  /// Whether the selector should be scrollable
  final bool scrollable;

  IntentModeSelector({
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
  });

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  /// Determine the visual state of a mode
  IntentModeState _getModeState(T modeValue) {
    if (activeValue == modeValue) return IntentModeState.active;
    if (matchedValue == modeValue) return IntentModeState.matched;
    if (lastIntentValue == modeValue) return IntentModeState.lastIntent;
    return IntentModeState.none;
  }

  @override
  Widget build(BuildContext context) {
    if (modes.isEmpty) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isVertical = orientation == ModeSelectorOrientation.vertical;

    return Container(
      width: isVertical && fixedWidth != null ? fixedWidth : null,
      padding: EdgeInsets.all(AppSpacings.pSm),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.darker : AppFillColorLight.darker,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: isVertical
          ? _buildVertical(context, isDark)
          : _buildHorizontal(context, isDark),
    );
  }

  Widget _buildHorizontal(BuildContext context, bool isDark) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth;
        final buttonCount = modes.length;
        final widthPerButton = availableWidth / buttonCount;
        final shouldShowLabels = showLabels ?? (widthPerButton >= minButtonWidth);

        final buttons = modes.asMap().entries.map((entry) {
          final index = entry.key;
          final mode = entry.value;
          final state = _getModeState(mode.value);

          final button = _buildHorizontalModeButton(
            context,
            isDark: isDark,
            mode: mode,
            state: state,
            showLabel: shouldShowLabels,
            useTopIcon: iconPlacement == ModeSelectorIconPlacement.top,
            isScrollable: scrollable,
          );

          if (scrollable) {
            return Padding(
              padding: EdgeInsets.only(
                right: index < modes.length - 1 ? AppSpacings.pSm : 0,
              ),
              child: button,
            );
          }
          return Expanded(child: button);
        }).toList();

        if (scrollable) {
          return SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: buttons),
          );
        }

        return Row(children: buttons);
      },
    );
  }

  Widget _buildVertical(BuildContext context, bool isDark) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Get the available width for buttons (used for status icon positioning)
        final availableWidth = constraints.maxWidth.isFinite ? constraints.maxWidth : null;

        final buttons = modes.asMap().entries.map((entry) {
          final index = entry.key;
          final mode = entry.value;
          final state = _getModeState(mode.value);

          final button = _buildVerticalModeButton(
            context,
            isDark: isDark,
            mode: mode,
            state: state,
            showLabel: showLabels ?? false,
            useTopIcon: true,
            isVerticalLayout: true,
            isScrollable: scrollable,
            verticalButtonWidth: availableWidth,
          );

          Widget wrapped = Padding(
            padding: EdgeInsets.only(
              bottom: index < modes.length - 1 ? AppSpacings.pSm : 0,
            ),
            child: button,
          );

          // In vertical scrollable layout, enforce minimum height
          if (scrollable) {
            wrapped = ConstrainedBox(
              constraints: BoxConstraints(minHeight: minButtonHeight),
              child: wrapped,
            );
          }

          return wrapped;
        }).toList();

        if (scrollable) {
          // Center content when it fits, scroll when it doesn't
          final column = Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: buttons,
          );

          // If height is bounded, center the content within the scrollable area
          if (constraints.maxHeight.isFinite) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Center(child: column),
              ),
            );
          }

          return SingleChildScrollView(child: column);
        }

        // Non-scrollable: center content vertically, stretch items to fill width
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: buttons,
          ),
        );
      },
    );
  }

  Widget _buildHorizontalModeButton(
    BuildContext context, {
    required bool isDark,
    required ModeOption<T> mode,
    required IntentModeState state,
    required bool showLabel,
    required bool useTopIcon,
    bool isVerticalLayout = false,
    bool isScrollable = false,
  }) {
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    // Fixed colors based on state (not mode's color):
    // - Active: primary
    // - Matched: info
    // - Last intent: neutral
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
    final infoBgColor =
        isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9;
    final neutralColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final neutralBgColor =
        isDark ? AppColorsDark.neutralLight9 : AppColorsLight.neutralLight9;

    // Determine colors and border width based on state
    final Color contentColor;
    final Color backgroundColor;
    final Color borderColor;
    final double borderWidth;

    switch (state) {
      case IntentModeState.active:
        contentColor = primaryColor;
        backgroundColor = primaryBgColor;
        borderColor = primaryColor;
        borderWidth = _scale(2);
        break;
      case IntentModeState.matched:
        contentColor = infoColor;
        backgroundColor = infoBgColor;
        borderColor = infoColor;
        borderWidth = _scale(2);
        break;
      case IntentModeState.lastIntent:
        contentColor = neutralColor;
        backgroundColor = neutralBgColor;
        borderColor = neutralColor;
        borderWidth = _scale(2);
        break;
      case IntentModeState.none:
        contentColor = secondaryColor;
        backgroundColor = isDark
            ? AppColors.blank
            : AppColors.white.withValues(alpha: 0);
        borderColor = isDark
            ? AppColors.blank
            : AppColors.white.withValues(alpha: 0);
        borderWidth = _scale(2);
        break;
    }

    final fontWeight = state != IntentModeState.none
        ? FontWeight.w600
        : FontWeight.w500;

    Widget content;

    if (!showLabel) {
      content = Center(
        child: Icon(
          mode.icon,
          color: contentColor,
          size: _scale(20),
        ),
      );
    } else if (useTopIcon) {
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            mode.icon,
            color: contentColor,
            size: _scale(18),
          ),
          AppSpacings.spacingXsVertical,
          Flexible(
            child: Text(
              mode.label,
              style: TextStyle(
                color: contentColor,
                fontSize: AppFontSize.extraSmall,
                fontWeight: fontWeight,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
              textAlign: TextAlign.center,
            ),
          ),
        ],
      );
    } else {
      final textWidget = Text(
        mode.label,
        style: TextStyle(
          color: contentColor,
          fontSize: AppFontSize.small,
          fontWeight: fontWeight,
        ),
        overflow: TextOverflow.ellipsis,
        maxLines: 1,
      );

      content = Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: isScrollable ? MainAxisSize.min : MainAxisSize.max,
        children: [
          Icon(
            mode.icon,
            color: contentColor,
            size: _scale(18),
          ),
          AppSpacings.spacingSmHorizontal,
          isScrollable ? textWidget : Flexible(child: textWidget),
        ],
      );
    }

    final buttonSize = isVerticalLayout && !showLabel ? _scale(36) : null;
    final scrollableWidth = isScrollable && !isVerticalLayout && !showLabel
        ? _scale(48)
        : null;

    EdgeInsetsGeometry? buttonPadding;
    if (isVerticalLayout) {
      buttonPadding = showLabel
          ? EdgeInsets.symmetric(vertical: AppSpacings.pMd, horizontal: AppSpacings.pLg)
          : null;
    } else {
      buttonPadding = EdgeInsets.symmetric(
        vertical: AppSpacings.pMd,
        horizontal: isScrollable ? AppSpacings.pMd : AppSpacings.pSm,
      );
    }

    // Determine status icon based on state
    // - Active: check
    // - Matched: approximately-equal
    // - Last intent: history
    IconData? statusIconData;
    switch (state) {
      case IntentModeState.active:
        statusIconData = MdiIcons.check;
        break;
      case IntentModeState.matched:
        statusIconData = MdiIcons.approximatelyEqual;
        break;
      case IntentModeState.lastIntent:
        statusIconData = MdiIcons.history;
        break;
      case IntentModeState.none:
        statusIconData = null;
        break;
    }

    // Build the final content with optional status icon
    Widget finalContent = content;
    if (statusIconData != null) {
      // For icon-only mode, position in corner and add circular background
      final isIconOnly = !showLabel;
      final needsBackground = isIconOnly && state != IntentModeState.none;

      final iconSize = _scale(12);

      // Wrap icon in fixed-size container to ensure consistent sizing across different icons
      Widget statusIcon = SizedBox(
        width: iconSize,
        height: iconSize,
        child: Center(
          child: Icon(
            statusIconData,
            color: needsBackground ? backgroundColor : contentColor,
            size: iconSize,
          ),
        ),
      );

      // Wrap with circular background for icon-only mode
      if (needsBackground) {
        final containerSize = iconSize + _scale(4);
        statusIcon = Container(
          width: containerSize,
          height: containerSize,
          decoration: BoxDecoration(
            color: borderColor,
            shape: BoxShape.circle,
          ),
          child: Center(child: statusIcon),
        );
      }

      final topOffset = -_scale(5);
      final rightOffset = isIconOnly ? -_scale(5) : _scale(0);

      finalContent = Stack(
        clipBehavior: Clip.none,
        fit: StackFit.passthrough,
        children: [
          content,
          Positioned(
            top: topOffset,
            right: rightOffset,
            child: statusIcon,
          ),
        ],
      );
    }

    return GestureDetector(
      onTap: () => onChanged(mode.value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: buttonSize ?? scrollableWidth,
        height: buttonSize,
        padding: buttonPadding,
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: borderColor,
            width: borderWidth,
          ),
        ),
        child: finalContent,
      ),
    );
  }

  Widget _buildVerticalModeButton(
    BuildContext context, {
    required bool isDark,
    double? verticalButtonWidth,
    required ModeOption<T> mode,
    required IntentModeState state,
    required bool showLabel,
    required bool useTopIcon,
    bool isVerticalLayout = false,
    bool isScrollable = false,
  }) {
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    // Fixed colors based on state (not mode's color):
    // - Active: primary
    // - Matched: info
    // - Last intent: neutral
    final primaryColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
    final infoBgColor =
        isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9;
    final neutralColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final neutralBgColor =
        isDark ? AppColorsDark.neutralLight9 : AppColorsLight.neutralLight9;

    // Determine colors and border width based on state
    final Color contentColor;
    final Color backgroundColor;
    final Color borderColor;
    final double borderWidth;

    switch (state) {
      case IntentModeState.active:
        contentColor = primaryColor;
        backgroundColor = primaryBgColor;
        borderColor = primaryColor;
        borderWidth = _scale(2);
        break;
      case IntentModeState.matched:
        contentColor = infoColor;
        backgroundColor = infoBgColor;
        borderColor = infoColor;
        borderWidth = _scale(2);
        break;
      case IntentModeState.lastIntent:
        contentColor = neutralColor;
        backgroundColor = neutralBgColor;
        borderColor = neutralColor;
        borderWidth = _scale(2);
        break;
      case IntentModeState.none:
        contentColor = secondaryColor;
        backgroundColor = isDark
            ? AppColors.blank
            : AppColors.white.withValues(alpha: 0);
        borderColor = isDark
            ? AppColors.blank
            : AppColors.white.withValues(alpha: 0);
        borderWidth = _scale(2);
        break;
    }

    final fontWeight = state != IntentModeState.none
        ? FontWeight.w600
        : FontWeight.w500;

    Widget content;

    if (!showLabel) {
      content = Center(
        child: Icon(
          mode.icon,
          color: contentColor,
          size: _scale(20),
        ),
      );
    } else if (useTopIcon) {
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            mode.icon,
            color: contentColor,
            size: _scale(18),
          ),
          AppSpacings.spacingXsVertical,
          Flexible(
            child: Text(
              mode.label,
              style: TextStyle(
                color: contentColor,
                fontSize: AppFontSize.extraSmall,
                fontWeight: fontWeight,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
              textAlign: TextAlign.center,
            ),
          ),
        ],
      );
    } else {
      final textWidget = Text(
        mode.label,
        style: TextStyle(
          color: contentColor,
          fontSize: AppFontSize.small,
          fontWeight: fontWeight,
        ),
        overflow: TextOverflow.ellipsis,
        maxLines: 1,
      );

      content = Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: isScrollable ? MainAxisSize.min : MainAxisSize.max,
        children: [
          Icon(
            mode.icon,
            color: contentColor,
            size: _scale(18),
          ),
          AppSpacings.spacingSmHorizontal,
          isScrollable ? textWidget : Flexible(child: textWidget),
        ],
      );
    }

    // For vertical layout: fixed height when icon-only, null when showing labels
    final buttonHeight = isVerticalLayout && !showLabel ? _scale(36) : null;
    // For vertical layout: use passed width for proper status icon positioning
    // For horizontal layout: fixed width when icon-only and scrollable
    final double? buttonWidth;
    if (isVerticalLayout && verticalButtonWidth != null) {
      buttonWidth = verticalButtonWidth;
    } else if (!isVerticalLayout && isScrollable && !showLabel) {
      buttonWidth = _scale(48);
    } else {
      buttonWidth = null;
    }

    // Padding based on layout mode
    EdgeInsetsGeometry buttonPadding;
    if (isVerticalLayout) {
      // Vertical layout: symmetric padding, more when showing labels
      buttonPadding = showLabel
          ? EdgeInsets.symmetric(vertical: AppSpacings.pMd, horizontal: AppSpacings.pLg)
          : EdgeInsets.symmetric(vertical: AppSpacings.pSm, horizontal: AppSpacings.pMd);
    } else {
      // Horizontal layout
      buttonPadding = EdgeInsets.symmetric(
        vertical: AppSpacings.pMd,
        horizontal: isScrollable ? AppSpacings.pMd : AppSpacings.pSm,
      );
    }

    // Determine status icon based on state
    // - Active: check
    // - Matched: approximately-equal
    // - Last intent: history
    IconData? statusIconData;
    switch (state) {
      case IntentModeState.active:
        statusIconData = MdiIcons.check;
        break;
      case IntentModeState.matched:
        statusIconData = MdiIcons.approximatelyEqual;
        break;
      case IntentModeState.lastIntent:
        statusIconData = MdiIcons.history;
        break;
      case IntentModeState.none:
        statusIconData = null;
        break;
    }

    // Build the button container
    Widget button = AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: buttonWidth,
      height: buttonHeight,
      padding: buttonPadding,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: borderColor,
          width: borderWidth,
        ),
      ),
      child: content,
    );

    // Wrap with Stack for status icon - Stack wraps the button so it sizes to button bounds
    if (statusIconData != null) {
      // For icon-only mode, add circular background
      final isIconOnly = !showLabel;
      final needsBackground = isIconOnly && state != IntentModeState.none;

      final iconSize = _scale(12);

      // Wrap icon in fixed-size container to ensure consistent sizing across different icons
      Widget statusIcon = SizedBox(
        width: iconSize,
        height: iconSize,
        child: Center(
          child: Icon(
            statusIconData,
            color: needsBackground ? backgroundColor : contentColor,
            size: iconSize,
          ),
        ),
      );

      // Wrap with circular background for icon-only mode
      if (needsBackground) {
        final containerSize = iconSize + _scale(4);
        statusIcon = Container(
          width: containerSize,
          height: containerSize,
          decoration: BoxDecoration(
            color: borderColor,
            shape: BoxShape.circle,
          ),
          child: Center(child: statusIcon),
        );
      }

      // Position differs for icon-only vs with-label
      final statusTop = isIconOnly ? -_scale(5) : _scale(5);
      final statusRight = isIconOnly ? -_scale(5) : _scale(10);

      // Use StackFit.loose - the AnimatedContainer inside has explicit dimensions,
      // so Stack sizes to it. StackFit.expand fails with unbounded height in Column.
      button = Stack(
        clipBehavior: Clip.none,
        fit: StackFit.loose,
        children: [
          button,
          Positioned(
            top: statusTop,
            right: statusRight,
            child: statusIcon,
          ),
        ],
      );
    }

    return GestureDetector(
      onTap: () => onChanged(mode.value),
      child: button,
    );
  }
}
