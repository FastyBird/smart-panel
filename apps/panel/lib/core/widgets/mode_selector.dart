import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Defines the orientation of the mode selector
enum ModeSelectorOrientation {
  /// Modes arranged horizontally in a row
  horizontal,

  /// Modes arranged vertically in a column
  vertical,
}

/// Defines where the icon is placed relative to the label
enum ModeSelectorIconPlacement {
  /// Icon on the left, label on the right (for horizontal orientation)
  left,

  /// Icon on top, label below (for vertical orientation or compact horizontal)
  top,
}

/// Semantic color names that map to theme colors
enum ModeSelectorColor {
  primary,
  success,
  warning,
  danger,
  info,
  neutral,
  teal,
  cyan,
  pink,
  indigo,
}

/// Represents a single mode option in the selector
class ModeOption<T> {
  /// The value this option represents
  final T value;

  /// Icon to display for this mode
  final IconData icon;

  /// Label text for this mode
  final String label;

  /// Optional override color for this specific mode
  /// If null, uses the selector's default color
  final ModeSelectorColor? color;

  const ModeOption({
    required this.value,
    required this.icon,
    required this.label,
    this.color,
  });
}

/// A reusable mode selector widget that displays a group of selectable modes.
///
/// Features:
/// - Horizontal or vertical orientation
/// - Icon placement (left or top)
/// - Automatic text hiding when space is limited
/// - Theme-aware colors using semantic color names
/// - Smooth animations on selection change
class ModeSelector<T> extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// List of mode options to display
  final List<ModeOption<T>> modes;

  /// Currently selected value
  final T selectedValue;

  /// Callback when a mode is selected
  final ValueChanged<T> onChanged;

  /// Orientation of the selector (horizontal or vertical)
  final ModeSelectorOrientation orientation;

  /// Where to place the icon relative to the label
  final ModeSelectorIconPlacement iconPlacement;

  /// Default color for all modes (can be overridden per mode)
  final ModeSelectorColor color;

  /// Whether to show labels (if false, only icons are shown)
  /// When null, labels are shown/hidden automatically based on available space
  final bool? showLabels;

  /// Minimum width for each mode button in horizontal orientation
  /// Used to determine if labels should be hidden
  final double minButtonWidth;

  /// Whether the selector should be scrollable when content doesn't fit
  /// When true, enables horizontal scroll for horizontal orientation
  /// and vertical scroll for vertical orientation
  final bool scrollable;

  ModeSelector({
    super.key,
    required this.modes,
    required this.selectedValue,
    required this.onChanged,
    this.orientation = ModeSelectorOrientation.horizontal,
    this.iconPlacement = ModeSelectorIconPlacement.left,
    this.color = ModeSelectorColor.primary,
    this.showLabels,
    this.minButtonWidth = 80.0,
    this.scrollable = false,
  });

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: EdgeInsets.all(AppSpacings.pSm),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.darker : AppFillColorLight.darker,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
      ),
      child: orientation == ModeSelectorOrientation.horizontal
          ? _buildHorizontal(context, isDark)
          : _buildVertical(context, isDark),
    );
  }

  Widget _buildHorizontal(BuildContext context, bool isDark) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Determine if we should show labels based on available space
        final availableWidth = constraints.maxWidth;
        final buttonCount = modes.length;
        final widthPerButton = availableWidth / buttonCount;
        final shouldShowLabels = showLabels ?? (widthPerButton >= minButtonWidth);

        final buttons = modes.asMap().entries.map((entry) {
          final index = entry.key;
          final mode = entry.value;
          final isSelected = selectedValue == mode.value;
          final modeColor = mode.color ?? color;
          final colors = _getColors(isDark, modeColor);

          final button = _buildModeButton(
            context,
            isDark: isDark,
            mode: mode,
            isSelected: isSelected,
            colors: colors,
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
    final buttons = modes.asMap().entries.map((entry) {
      final index = entry.key;
      final mode = entry.value;
      final isSelected = selectedValue == mode.value;
      final modeColor = mode.color ?? color;
      final colors = _getColors(isDark, modeColor);

      return Padding(
        padding: EdgeInsets.only(
          bottom: index < modes.length - 1 ? AppSpacings.pSm : 0,
        ),
        child: _buildModeButton(
          context,
          isDark: isDark,
          mode: mode,
          isSelected: isSelected,
          colors: colors,
          showLabel: showLabels ?? false,
          useTopIcon: true,
          isVerticalLayout: true,
        ),
      );
    }).toList();

    if (scrollable) {
      return SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: buttons,
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: buttons,
    );
  }

  Widget _buildModeButton(
    BuildContext context, {
    required bool isDark,
    required ModeOption<T> mode,
    required bool isSelected,
    required _ModeColors colors,
    required bool showLabel,
    required bool useTopIcon,
    bool isVerticalLayout = false,
    bool isScrollable = false,
  }) {
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    Widget content;

    if (!showLabel) {
      // Icon only
      content = Center(
        child: Icon(
          mode.icon,
          color: isSelected ? colors.active : secondaryColor,
          size: _scale(20),
        ),
      );
    } else if (useTopIcon) {
      // Icon on top, label below
      content = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            mode.icon,
            color: isSelected ? colors.active : secondaryColor,
            size: _scale(18),
          ),
          AppSpacings.spacingXsVertical,
          Flexible(
            child: Text(
              mode.label,
              style: TextStyle(
                color: isSelected ? colors.active : secondaryColor,
                fontSize: AppFontSize.extraSmall,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
              textAlign: TextAlign.center,
            ),
          ),
        ],
      );
    } else {
      // Icon on left, label on right
      final textWidget = Text(
        mode.label,
        style: TextStyle(
          color: isSelected ? colors.active : secondaryColor,
          fontSize: AppFontSize.small,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
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
            color: isSelected ? colors.active : secondaryColor,
            size: _scale(18),
          ),
          AppSpacings.spacingSmHorizontal,
          // When scrollable, don't use Flexible (unbounded width)
          isScrollable ? textWidget : Flexible(child: textWidget),
        ],
      );
    }

    final buttonSize = isVerticalLayout ? _scale(36) : null;
    // When scrollable in horizontal mode:
    // - With labels: use intrinsic width (null) so content determines size
    // - Icon only: use fixed minimum size
    final scrollableWidth = isScrollable && !isVerticalLayout && !showLabel
        ? _scale(48)
        : null;

    return GestureDetector(
      onTap: () => onChanged(mode.value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: buttonSize ?? scrollableWidth,
        height: buttonSize,
        padding: isVerticalLayout
            ? null
            : EdgeInsets.symmetric(
                vertical: AppSpacings.pMd,
                horizontal: isScrollable ? AppSpacings.pMd : AppSpacings.pSm,
              ),
        decoration: BoxDecoration(
          color: isSelected ? colors.background : AppColors.blank,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isSelected ? colors.active : AppColors.blank,
            width: _scale(2),
          ),
        ),
        child: content,
      ),
    );
  }

  _ModeColors _getColors(bool isDark, ModeSelectorColor colorName) {
    switch (colorName) {
      case ModeSelectorColor.primary:
        return _ModeColors(
          active: isDark ? AppColorsDark.primary : AppColorsLight.primary,
          background:
              isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9,
        );
      case ModeSelectorColor.success:
        return _ModeColors(
          active: isDark ? AppColorsDark.success : AppColorsLight.success,
          background:
              isDark ? AppColorsDark.successLight9 : AppColorsLight.successLight9,
        );
      case ModeSelectorColor.warning:
        return _ModeColors(
          active: isDark ? AppColorsDark.warning : AppColorsLight.warning,
          background:
              isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9,
        );
      case ModeSelectorColor.danger:
        return _ModeColors(
          active: isDark ? AppColorsDark.danger : AppColorsLight.danger,
          background:
              isDark ? AppColorsDark.dangerLight9 : AppColorsLight.dangerLight9,
        );
      case ModeSelectorColor.info:
        return _ModeColors(
          active: isDark ? AppColorsDark.info : AppColorsLight.info,
          background:
              isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9,
        );
      case ModeSelectorColor.neutral:
        return _ModeColors(
          active: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
          background:
              isDark ? AppColorsDark.neutralLight9 : AppColorsLight.neutralLight9,
        );
      case ModeSelectorColor.teal:
        return _ModeColors(
          active: isDark ? AppColorsDark.teal : AppColorsLight.teal,
          background:
              isDark ? AppColorsDark.tealLight9 : AppColorsLight.tealLight9,
        );
      case ModeSelectorColor.cyan:
        return _ModeColors(
          active: isDark ? AppColorsDark.cyan : AppColorsLight.cyan,
          background:
              isDark ? AppColorsDark.cyanLight9 : AppColorsLight.cyanLight9,
        );
      case ModeSelectorColor.pink:
        return _ModeColors(
          active: isDark ? AppColorsDark.pink : AppColorsLight.pink,
          background:
              isDark ? AppColorsDark.pinkLight9 : AppColorsLight.pinkLight9,
        );
      case ModeSelectorColor.indigo:
        return _ModeColors(
          active: isDark ? AppColorsDark.indigo : AppColorsLight.indigo,
          background:
              isDark ? AppColorsDark.indigoLight9 : AppColorsLight.indigoLight9,
        );
    }
  }
}

/// Internal class to hold computed colors for a mode
class _ModeColors {
  final Color active;
  final Color background;

  const _ModeColors({
    required this.active,
    required this.background,
  });
}
