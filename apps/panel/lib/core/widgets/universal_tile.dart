import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

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

  /// Optional theme color key for active/accent. When set, only theme colors are used
  /// (no alpha modifiers). Light/dark is chosen from current theme.
  /// When set but [isActive] is false, only the icon (and icon bg) use this color.
  final ThemeColors? activeColor;

  // Icon-only accent color (colors icon/icon bg without affecting tile active state)
  // Useful for sensors where icon color indicates type but tile isn't "active"
  final ThemeColors? iconAccentColor;

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

  // Accessories widget (capability icons, etc.)
  // Horizontal: placed on the right side after text content
  // Vertical: placed at the bottom after status text
  final Widget? accessories;

  // Optional padding override for the tile content area.
  // Defaults to horizontal: pMd, vertical: pSm.
  final EdgeInsetsGeometry? contentPadding;

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
    this.accessories,
    this.contentPadding,
  });

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
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: colors.outerBorderColor,
            width: colors.borderWidth,
          ),
          boxShadow: (isActive && showGlow && !isOffline)
              ? [
                  BoxShadow(
                    color: colors.accentColorLight5.withValues(alpha: 0.35),
                    blurRadius: AppSpacings.scale(8),
                    spreadRadius: AppSpacings.scale(1),
                  ),
                ]
              : [],
        ),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: colors.tileBgColor,
            borderRadius: BorderRadius.circular(
              AppBorderRadius.base - colors.borderWidth,
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
                padding: contentPadding ??
                    EdgeInsets.symmetric(
                      horizontal: AppSpacings.pMd,
                      vertical: AppSpacings.pSm,
                    ),
                child: Column(
                  children: [
                    // Icon - takes available space
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(bottom: AppSpacings.pMd),
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
                    ),

                    // Name + Status grouped together
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

                    // Accessories (optional)
                    if (accessories != null) ...[
                      SizedBox(height: AppSpacings.pSm),
                      accessories!,
                    ],
                  ],
                ),
              ),

              // Selection indicator
              if (isSelected && showSelectionIndicator)
                Positioned(
                  top: AppSpacings.scale(4),
                  right: AppSpacings.scale(4),
                  child: Icon(
                    MdiIcons.checkCircle,
                    size: AppSpacings.scale(14),
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
        padding: contentPadding ??
            EdgeInsets.symmetric(
              horizontal: AppSpacings.pSm,
              vertical: AppSpacings.pSm,
            ),
        decoration: BoxDecoration(
          color: colors.tileBgColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: colors.outerBorderColor,
            width: colors.borderWidth,
          ),
          boxShadow: (isActive && showGlow && !isOffline)
              ? [
                  BoxShadow(
                    color: colors.accentColorLight5.withValues(alpha: 0.35),
                    blurRadius: AppSpacings.scale(6),
                    spreadRadius: AppSpacings.scale(1),
                  ),
                ]
              : [],
        ),
        child: Row(
          spacing: AppSpacings.pMd,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon
            _buildIconButton(
              context,
              colors,
              AppSpacings.scale(32),
              AppSpacings.scale(18),
            ),

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
                      fontSize: nameFontSize ?? AppFontSize.small,
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

            // Accessories for horizontal
            if (accessories != null)
              Padding(
                padding: EdgeInsets.only(left: AppSpacings.pSm),
                child: accessories!,
              ),

            // Selection indicator for horizontal
            if (isSelected && showSelectionIndicator)
              Padding(
                padding: EdgeInsets.only(left: AppSpacings.pSm),
                child: Icon(
                  MdiIcons.checkCircle,
                  size: AppSpacings.scale(16),
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
            right: -AppSpacings.scale(2),
            bottom: -AppSpacings.scale(2),
            child: Icon(
              MdiIcons.alert,
              size: AppSpacings.scale(14),
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
    final brightness = Theme.of(context).brightness;
    final isDark = brightness == Brightness.dark;
    final borderWidth = AppSpacings.scale(1);

    // Resolve theme color family (no alpha modifiers)
    final colorKey = activeColor ?? ThemeColors.primary;
    final family = ThemeColorFamily.get(brightness, colorKey);
    final accentColor = family.base;
    final accentColorDark2 = family.dark2;
    final accentColorLight5 = family.light5;
    final accentColorLight9 = family.light9;

    // Tile background
    final Color tileBgColor;
    if (isOffline) {
      tileBgColor = isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    } else if (isActive) {
      tileBgColor = accentColorLight9;
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
      outerBorderColor = isDark ? accentColorLight9 : accentColorLight5;
      innerBorderColor = outerBorderColor;
    } else {
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
      iconBgColor = ThemeColorFamily.get(brightness, iconAccentColor!).light5;
    } else if (isActive) {
      iconBgColor = accentColorLight5;
    } else {
      iconBgColor = isDark ? AppFillColorDark.darker : AppFillColorLight.light;
    }

    // Icon color
    final Color iconColor;
    if (isOffline) {
      iconColor = isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;
    } else if (iconAccentColor != null) {
      iconColor = ThemeColorFamily.get(brightness, iconAccentColor!).base;
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
    } else if (isActive) {
      subtitleColor = accentColorDark2;
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
      accentColorLight5: accentColorLight5,
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
  final Color accentColorLight5;
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
    required this.accentColorLight5,
    required this.borderWidth,
  });
}
