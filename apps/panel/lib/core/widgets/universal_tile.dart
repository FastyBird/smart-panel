import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Layout orientation for the tile.
enum TileLayout {
  /// Icon on top, text below (for grids)
  vertical,

  /// Icon on left, text on right (for lists/rows)
  horizontal,
}

/// Universal tile widget for consistent UI across domains.
///
/// Supports:
/// - Vertical layout (icon top, text bottom) for grids
/// - Horizontal layout (icon left, text right) for lists
/// - Active/inactive states with color theming
/// - Offline state (shows warning badge)
/// - Selection indicator
/// - Separate icon tap and tile tap callbacks
/// - Glow effect when active
/// - Warning badge for offline devices
///
/// Used for: light tiles, scene tiles, sensor tiles, auxiliary tiles,
/// channel tiles, role tiles, etc.
class UniversalTile extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  // Layout
  final TileLayout layout;

  // Icon
  final IconData icon;
  final IconData? activeIcon;

  // Text
  final String name;
  final String? status;

  // States
  final bool isActive;
  final bool isOffline;
  final bool isSelected;

  // Colors (optional overrides for custom theming like sensor types)
  final Color? activeColor;

  // Icon-only accent color (colors icon/icon bg without affecting tile active state)
  // Useful for sensors where icon color indicates type but tile isn't "active"
  final Color? iconAccentColor;

  // Interactions
  final VoidCallback? onIconTap;
  final VoidCallback? onTileTap;

  // Visual options
  final bool showGlow;
  final bool showSelectionIndicator;
  final bool showWarningBadge;
  final bool showDoubleBorder;
  final bool showInactiveBorder;

  // Font sizes (optional overrides)
  final double? nameFontSize;
  final double? statusFontSize;

  UniversalTile({
    super.key,
    this.layout = TileLayout.vertical,
    required this.icon,
    this.activeIcon,
    required this.name,
    this.status,
    this.isActive = false,
    this.isOffline = false,
    this.isSelected = false,
    this.activeColor,
    this.iconAccentColor,
    this.onIconTap,
    this.onTileTap,
    this.showGlow = true,
    this.showSelectionIndicator = false,
    this.showWarningBadge = true,
    this.showDoubleBorder = true,
    this.showInactiveBorder = false,
    this.nameFontSize,
    this.statusFontSize,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    return layout == TileLayout.vertical
        ? _buildVerticalTile(context)
        : _buildHorizontalTile(context);
  }

  // ============================================================================
  // VERTICAL LAYOUT (icon top, text bottom)
  // ============================================================================

  Widget _buildVerticalTile(BuildContext context) {
    final colors = _getTileColors(context);
    final isLargeScreen = _screenService.isLargeScreen;

    return GestureDetector(
      onTap: onTileTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          border: Border.all(
            color: colors.outerBorderColor,
            width: colors.borderWidth,
          ),
          boxShadow: (isActive && showGlow && !isOffline)
              ? [
                  BoxShadow(
                    color: colors.accentColor.withValues(alpha: 0.2),
                    blurRadius: _scale(8),
                    spreadRadius: _scale(1),
                  ),
                ]
              : [],
        ),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: colors.tileBgColor,
            borderRadius: BorderRadius.circular(
              AppBorderRadius.medium - colors.borderWidth,
            ),
            border: showDoubleBorder
                ? Border.all(
                    color: colors.innerBorderColor,
                    width: colors.borderWidth,
                  )
                : null,
          ),
          child: Stack(
            children: [
              Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                  vertical: AppSpacings.pSm,
                ),
                child: Column(
                  children: [
                    // Icon - takes available space
                    Expanded(
                      child: Center(
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            final iconSize = constraints.maxHeight;
                            return _buildIconButton(
                              context,
                              colors,
                              iconSize,
                              iconSize * 0.6,
                            );
                          },
                        ),
                      ),
                    ),
                    AppSpacings.spacingSmVertical,

                    // Name
                    Text(
                      name,
                      style: TextStyle(
                        color: colors.textColor,
                        fontSize: nameFontSize ??
                            (isLargeScreen ? AppFontSize.base : AppFontSize.small),
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                      textAlign: TextAlign.center,
                    ),

                    // Status (optional)
                    if (status != null) ...[
                      AppSpacings.spacingXsVertical,
                      Text(
                        status!,
                        style: TextStyle(
                          color: isOffline
                              ? colors.warningColor
                              : colors.subtitleColor,
                          fontSize: statusFontSize ??
                              (isLargeScreen ? AppFontSize.small : AppFontSize.extraSmall),
                        ),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ],
                ),
              ),

              // Selection indicator
              if (isSelected && showSelectionIndicator)
                Positioned(
                  top: _scale(4),
                  right: _scale(4),
                  child: Icon(
                    Icons.check_circle,
                    size: _scale(14),
                    color: isActive
                        ? colors.accentColor
                        : (Theme.of(context).brightness == Brightness.dark
                            ? AppColorsDark.success
                            : AppColorsLight.success),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  // ============================================================================
  // HORIZONTAL LAYOUT (icon left, text right)
  // ============================================================================

  Widget _buildHorizontalTile(BuildContext context) {
    final colors = _getTileColors(context);

    return GestureDetector(
      onTap: onTileTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSm,
        ),
        decoration: BoxDecoration(
          color: colors.tileBgColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          border: Border.all(
            color: colors.outerBorderColor,
            width: colors.borderWidth,
          ),
          boxShadow: (isActive && showGlow && !isOffline)
              ? [
                  BoxShadow(
                    color: colors.accentColor.withValues(alpha: 0.15),
                    blurRadius: _scale(6),
                    spreadRadius: _scale(1),
                  ),
                ]
              : [],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon
            _buildIconButton(
              context,
              colors,
              _scale(32),
              _scale(18),
            ),
            AppSpacings.spacingMdHorizontal,

            // Text content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    name,
                    style: TextStyle(
                      color: colors.textColor,
                      fontSize: nameFontSize ?? AppFontSize.base,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                  if (status != null)
                    Text(
                      status!,
                      style: TextStyle(
                        color: isOffline
                            ? colors.warningColor
                            : colors.subtitleColor,
                        fontSize: statusFontSize ?? AppFontSize.extraSmall,
                      ),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                ],
              ),
            ),

            // Selection indicator for horizontal
            if (isSelected && showSelectionIndicator)
              Padding(
                padding: EdgeInsets.only(left: AppSpacings.pSm),
                child: Icon(
                  Icons.check_circle,
                  size: _scale(16),
                  color: isActive
                      ? colors.accentColor
                      : (Theme.of(context).brightness == Brightness.dark
                          ? AppColorsDark.success
                          : AppColorsLight.success),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ============================================================================
  // ICON BUTTON (shared between layouts)
  // ============================================================================

  Widget _buildIconButton(
    BuildContext context,
    _TileColors colors,
    double containerSize,
    double iconSize,
  ) {
    final iconWidget = Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: containerSize,
          height: containerSize,
          decoration: BoxDecoration(
            color: colors.iconBgColor,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
          ),
          child: Icon(
            (isActive && activeIcon != null) ? activeIcon : icon,
            color: colors.iconColor,
            size: iconSize,
          ),
        ),

        // Warning badge for offline devices
        if (isOffline && showWarningBadge)
          Positioned(
            right: -_scale(2),
            bottom: -_scale(2),
            child: Icon(
              Icons.warning_rounded,
              size: _scale(14),
              color: colors.warningColor,
            ),
          ),
      ],
    );

    // Wrap with GestureDetector if onIconTap is provided
    if (onIconTap != null) {
      return GestureDetector(
        onTap: onIconTap,
        child: iconWidget,
      );
    }

    return iconWidget;
  }

  // ============================================================================
  // COLOR CALCULATIONS
  // ============================================================================

  _TileColors _getTileColors(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderWidth = _scale(1);

    // Use custom active color or default primary
    final accentColor = activeColor ??
        (isDark ? AppColorsDark.primary : AppColorsLight.primary);

    final accentColorLight5 = activeColor?.withValues(alpha: 0.3) ??
        (isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5);

    final accentColorLight9 = activeColor?.withValues(alpha: 0.1) ??
        (isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9);

    // Tile background
    final Color tileBgColor;
    if (isOffline) {
      tileBgColor = isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    } else if (isActive) {
      tileBgColor = activeColor != null
          ? activeColor!.withValues(alpha: 0.1)
          : accentColorLight9;
    } else {
      tileBgColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
    }

    // Border colors
    final Color outerBorderColor;
    final Color innerBorderColor;

    if (isOffline) {
      outerBorderColor =
          isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
      innerBorderColor = tileBgColor;
    } else if (isActive) {
      outerBorderColor = activeColor != null
          ? activeColor!.withValues(alpha: 0.3)
          : accentColorLight5;
      innerBorderColor = outerBorderColor;
    } else {
      // Light theme: always show border for inactive tiles
      // Dark theme: only show border when showInactiveBorder is true (on colored backgrounds)
      outerBorderColor = (!isDark || showInactiveBorder)
          ? (isDark ? AppBorderColorDark.light : AppBorderColorLight.light)
          : tileBgColor;
      innerBorderColor = tileBgColor;
    }

    // Icon background
    final Color iconBgColor;
    if (isOffline) {
      iconBgColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
    } else if (iconAccentColor != null) {
      // Icon-only accent: color icon bg without full active state
      iconBgColor = iconAccentColor!.withValues(alpha: 0.12);
    } else if (isActive) {
      iconBgColor = activeColor != null
          ? activeColor!.withValues(alpha: 0.15)
          : accentColorLight5;
    } else {
      iconBgColor = isDark ? AppFillColorDark.darker : AppFillColorLight.light;
    }

    // Icon color
    final Color iconColor;
    if (isOffline) {
      iconColor = isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;
    } else if (iconAccentColor != null) {
      // Icon-only accent: color icon without full active state
      iconColor = iconAccentColor!;
    } else if (isActive) {
      iconColor = accentColor;
    } else {
      iconColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }

    // Text color
    final Color textColor;
    if (isOffline) {
      textColor = isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;
    } else if (isActive) {
      textColor = accentColor;
    } else {
      textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    }

    // Subtitle color
    final Color subtitleColor;
    if (isOffline) {
      subtitleColor =
          isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;
    } else if (isActive && activeColor != null) {
      subtitleColor = activeColor!.withValues(alpha: 0.8);
    } else {
      subtitleColor =
          isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }

    final warningColor =
        isDark ? AppColorsDark.warning : AppColorsLight.warning;

    return _TileColors(
      tileBgColor: tileBgColor,
      outerBorderColor: outerBorderColor,
      innerBorderColor: innerBorderColor,
      iconBgColor: iconBgColor,
      iconColor: iconColor,
      textColor: textColor,
      subtitleColor: subtitleColor,
      warningColor: warningColor,
      accentColor: accentColor,
      borderWidth: borderWidth,
    );
  }
}

/// Internal class for holding computed tile colors.
class _TileColors {
  final Color tileBgColor;
  final Color outerBorderColor;
  final Color innerBorderColor;
  final Color iconBgColor;
  final Color iconColor;
  final Color textColor;
  final Color subtitleColor;
  final Color warningColor;
  final Color accentColor;
  final double borderWidth;

  const _TileColors({
    required this.tileBgColor,
    required this.outerBorderColor,
    required this.innerBorderColor,
    required this.iconBgColor,
    required this.iconColor,
    required this.textColor,
    required this.subtitleColor,
    required this.warningColor,
    required this.accentColor,
    required this.borderWidth,
  });
}
