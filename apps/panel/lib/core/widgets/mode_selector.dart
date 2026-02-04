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
  final ThemeColors? color;

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
/// - When scrollable, scrolls to the selected item when loaded
class ModeSelector<T> extends StatefulWidget {
  /// List of mode options to display
  final List<ModeOption<T>> modes;

  /// Currently selected value (null means no selection)
  final T? selectedValue;

  /// Callback when a mode is selected
  final ValueChanged<T> onChanged;

  /// Orientation of the selector (horizontal or vertical)
  final ModeSelectorOrientation orientation;

  /// Where to place the icon relative to the label
  final ModeSelectorIconPlacement iconPlacement;

  /// Default color for all modes (can be overridden per mode)
  final ThemeColors color;

  /// Whether to show labels (if false, only icons are shown)
  /// When null, labels are shown/hidden automatically based on available space
  final bool? showLabels;

  /// Minimum width for each mode button in horizontal orientation.
  /// When [scrollable] is true, this is enforced so labels don't shrink to ellipsis;
  /// otherwise used only to decide if labels should be hidden when space is tight.
  final double minButtonWidth;

  /// Minimum height for each mode button in vertical scrollable orientation.
  /// When [scrollable] is true and orientation is vertical, this is enforced
  /// so items maintain consistent sizing.
  final double minButtonHeight;

  /// Whether the selector should be scrollable when content doesn't fit
  /// When true, enables horizontal scroll for horizontal orientation
  /// and vertical scroll for vertical orientation
  final bool scrollable;

  /// Whether to show icons (defaults to true)
  /// When false, only labels are shown (showLabels is forced to true)
  final bool showIcon;

  /// Optional status icons to display in the top-right corner of mode buttons.
  /// Maps mode values to (icon, color) pairs. If a mode's value is in this map,
  /// the icon will be shown with the specified color.
  final Map<T, (IconData, Color)>? statusIcons;

  const ModeSelector({
    super.key,
    required this.modes,
    required this.selectedValue,
    required this.onChanged,
    this.orientation = ModeSelectorOrientation.horizontal,
    this.iconPlacement = ModeSelectorIconPlacement.left,
    this.color = ThemeColors.primary,
    this.showLabels,
    this.showIcon = true,
    this.minButtonWidth = 80.0,
    this.minButtonHeight = 56.0,
    this.scrollable = false,
    this.statusIcons,
  });

  @override
  State<ModeSelector<T>> createState() => _ModeSelectorState<T>();
}

class _ModeSelectorState<T> extends State<ModeSelector<T>> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// Key used to scroll to the selected item when scrollable and after first frame.
  final GlobalKey _selectedKey = GlobalKey();

  ScrollController? _scrollController;

  @override
  void initState() {
    super.initState();
    if (widget.scrollable) {
      _scrollController = ScrollController();
      _scheduleScrollToSelected();
    }
  }

  @override
  void didUpdateWidget(ModeSelector<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.scrollable &&
        (widget.selectedValue != oldWidget.selectedValue ||
            widget.modes != oldWidget.modes)) {
      _scheduleScrollToSelected();
    }
  }

  void _scheduleScrollToSelected() {
    if (widget.scrollable && widget.selectedValue != null) {
      WidgetsBinding.instance.addPostFrameCallback(_scrollToSelected);
    }
  }

  @override
  void dispose() {
    _scrollController?.dispose();
    super.dispose();
  }

  /// Scroll only the selector's list to center the selected item (does not scroll the page).
  void _scrollToSelected(_) {
    final ctx = _selectedKey.currentContext;
    if (ctx == null || !mounted || _scrollController == null) return;

    final box = ctx.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize || box.parent == null) return;

    final position = _scrollController!.position;
    final viewportDimension = position.viewportDimension;
    final maxScrollExtent = position.maxScrollExtent;

    final isHorizontal = widget.orientation == ModeSelectorOrientation.horizontal;
    final itemOffsetInContent = box.localToGlobal(Offset.zero, ancestor: box.parent);
    final itemOffset = isHorizontal ? itemOffsetInContent.dx : itemOffsetInContent.dy;
    final itemSize = isHorizontal ? box.size.width : box.size.height;

    final scrollOffset = (itemOffset + itemSize / 2 - viewportDimension / 2)
        .clamp(0.0, maxScrollExtent);

    _scrollController!.animateTo(
      scrollOffset,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    // Guard against empty modes to prevent division by zero
    if (widget.modes.isEmpty) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: EdgeInsets.all(AppSpacings.pSm),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.darker : AppFillColorLight.darker,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: widget.orientation == ModeSelectorOrientation.horizontal
          ? _buildHorizontal(context, isDark)
          : _buildVertical(context, isDark),
    );
  }

  Widget _buildHorizontal(BuildContext context, bool isDark) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Determine if we should show labels based on available space
        final availableWidth = constraints.maxWidth;
        final buttonCount = widget.modes.length;
        final widthPerButton = availableWidth / buttonCount;
        final shouldShowLabels = !widget.showIcon
            ? true
            : (widget.showLabels ?? (widthPerButton >= widget.minButtonWidth));

        final selectedIndex = widget.selectedValue != null
            ? widget.modes.indexWhere((m) => m.value == widget.selectedValue)
            : -1;

        final buttons = widget.modes.asMap().entries.map((entry) {
          final index = entry.key;
          final mode = entry.value;
          final isSelected = widget.selectedValue == mode.value;
          final modeColor = mode.color ?? widget.color;
          final colors = _getColors(
              isDark ? Brightness.dark : Brightness.light, modeColor);
          final statusIcon = widget.statusIcons?[mode.value];

          final button = _buildModeButton(
            context,
            isDark: isDark,
            mode: mode,
            isSelected: isSelected,
            colors: colors,
            showLabel: shouldShowLabels,
            useTopIcon: widget.iconPlacement == ModeSelectorIconPlacement.top,
            isScrollable: widget.scrollable,
            statusIcon: statusIcon,
          );

          Widget wrapped = Padding(
            padding: EdgeInsets.only(
              right: index < widget.modes.length - 1 ? AppSpacings.pSm : 0,
            ),
            child: button,
          );
          if (widget.scrollable && index == selectedIndex) {
            wrapped = KeyedSubtree(key: _selectedKey, child: wrapped);
          }

          // In horizontal scrollable layout, enforce minimum width so labels don't shrink to ellipsis
          if (widget.scrollable) {
            wrapped = ConstrainedBox(
              constraints: BoxConstraints(minWidth: widget.minButtonWidth),
              child: wrapped,
            );
            return wrapped;
          }
          return Expanded(child: wrapped);
        }).toList();

        if (widget.scrollable) {
          return SingleChildScrollView(
            controller: _scrollController,
            scrollDirection: Axis.horizontal,
            child: Row(children: buttons),
          );
        }

        return Row(children: buttons);
      },
    );
  }

  Widget _buildVertical(BuildContext context, bool isDark) {
    final selectedIndex = widget.selectedValue != null
        ? widget.modes.indexWhere((m) => m.value == widget.selectedValue)
        : -1;

    final buttons = widget.modes.asMap().entries.map((entry) {
      final index = entry.key;
      final mode = entry.value;
      final isSelected = widget.selectedValue == mode.value;
      final modeColor = mode.color ?? widget.color;
      final colors = _getColors(
          isDark ? Brightness.dark : Brightness.light, modeColor);
      final statusIcon = widget.statusIcons?[mode.value];

      final button = _buildModeButton(
        context,
        isDark: isDark,
        mode: mode,
        isSelected: isSelected,
        colors: colors,
        showLabel: !widget.showIcon ? true : (widget.showLabels ?? false),
        useTopIcon: true,
        isVerticalLayout: true,
        isScrollable: widget.scrollable,
        statusIcon: statusIcon,
      );

      Widget wrapped = Padding(
        padding: EdgeInsets.only(
          bottom: index < widget.modes.length - 1 ? AppSpacings.pSm : 0,
        ),
        child: button,
      );

      if (widget.scrollable && index == selectedIndex) {
        wrapped = KeyedSubtree(key: _selectedKey, child: wrapped);
      }

      // In vertical scrollable layout, enforce minimum height
      if (widget.scrollable) {
        wrapped = ConstrainedBox(
          constraints: BoxConstraints(minHeight: widget.minButtonHeight),
          child: wrapped,
        );
      }

      return wrapped;
    }).toList();

    if (widget.scrollable) {
      return SingleChildScrollView(
        controller: _scrollController,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: buttons,
        ),
      );
    }

    // Non-scrollable: stretch items to fill width
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
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
    (IconData, Color)? statusIcon,
  }) {
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    // Determine the content color based on selection state
    final Color contentColor = isSelected ? colors.active : secondaryColor;

    // Determine font weight based on state
    final fontWeight = isSelected ? FontWeight.w600 : FontWeight.w500;

    Widget content;

    if (!widget.showIcon) {
      // Label only (no icon)
      content = Center(
        child: Text(
          mode.label,
          style: TextStyle(
            color: contentColor,
            fontSize: AppFontSize.small,
            fontWeight: fontWeight,
          ),
          overflow: isScrollable ? TextOverflow.visible : TextOverflow.ellipsis,
          maxLines: 1,
          softWrap: false,
        ),
      );
    } else if (!showLabel) {
      // Icon only
      content = Center(
        child: Icon(
          mode.icon,
          color: contentColor,
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
      // Icon on left, label on right
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
          // When scrollable, don't use Flexible (unbounded width)
          isScrollable ? textWidget : Flexible(child: textWidget),
        ],
      );
    }

    // For vertical layout: fixed height when icon-only, null when showing labels
    final buttonHeight = isVerticalLayout && !showLabel ? _scale(36) : null;
    // For horizontal layout: fixed width when icon-only and scrollable
    final buttonWidth = !isVerticalLayout && isScrollable && !showLabel && widget.showIcon
        ? _scale(48)
        : null;

    // Use transparent white for light theme to avoid dark flash during animation
    // (transparent black interpolates through dark colors on light backgrounds)
    final transparentColor = isDark
        ? AppColors.blank
        : AppColors.white.withValues(alpha: 0);

    // Determine background and border colors based on selection state
    final Color backgroundColor;
    final Color borderColor;
    if (isSelected) {
      backgroundColor = colors.background;
      borderColor = colors.active;
    } else {
      backgroundColor = transparentColor;
      borderColor = transparentColor;
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

    // Build the final content with optional status icon
    Widget finalContent = content;
    if (statusIcon != null) {
      finalContent = Stack(
        clipBehavior: Clip.none,
        fit: StackFit.passthrough,
        children: [
          content,
          Positioned(
            top: -_scale(5),
            right: _scale(0),
            child: Icon(
              statusIcon.$1,
              color: statusIcon.$2,
              size: _scale(12),
            ),
          ),
        ],
      );
    }

    return GestureDetector(
      onTap: () => widget.onChanged(mode.value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: buttonWidth,
        height: buttonHeight,
        padding: buttonPadding,
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: borderColor,
            width: _scale(2),
          ),
        ),
        child: finalContent,
      ),
    );
  }

  _ModeColors _getColors(Brightness brightness, ThemeColors key) {
    final family = ThemeColorFamily.get(brightness, key);
    return _ModeColors(
      active: family.base,
      background: family.light9,
    );
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
