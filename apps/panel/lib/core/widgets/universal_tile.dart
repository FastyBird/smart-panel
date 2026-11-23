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

/// Universal tile widget for consistent UI across domains
/// (docs/display-ui-design-spec.md §2, §5, §7).
///
/// - Vertical layout (icon top, text bottom) for grids, horizontal (icon
///   left, text right) for lists.
/// - Default: `surface.card` with a `border.light` outline, radius 8.
/// - Active: the soft tint of [activeColor], the domain colour on the icon
///   and `text.primary` on the text. Selected adds a domain-colour outline.
/// - Offline: the state line in the warning colour, a warning badge in the
///   corner and the icon dimmed to `text.disabled`.
/// - Separate icon tap and tile tap callbacks; the icon is the on/off zone.
///
/// [activeColor] `primary` (the default) follows the panel accent.
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
  /// No longer drawn: tiles have no shadow. Kept so callers compile.
  final bool showGlow;
  final bool showSelectionIndicator;
  final bool showWarningBadge;

  /// No longer drawn: tiles have one outline. Kept so callers compile.
  final bool showDoubleBorder;

  /// No longer used: every tile has its outline. Kept so callers compile.
  final bool showInactiveBorder;

  // Font sizes (optional overrides)
  final double? nameFontSize;
  final double? statusFontSize;

  // Accessories widget (capability icons, etc.)
  // Horizontal: placed on the right side after text content
  // Vertical: placed at the bottom after status text
  final Widget? accessories;

  // Optional padding override for the tile content area.
  final EdgeInsetsGeometry? contentPadding;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

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
    this.sizeClass,
  });

  /// Side of the icon tile in the horizontal layout, in design px; with its
  /// padding it is the 36 px on/off tap zone.
  static const double horizontalIconTile = 36;

  static const double horizontalIconSize = 20;

  /// Offline and lock badge in the tile's corner.
  static const double badgeSize = 12;

  @override
  Widget build(BuildContext context) {
    final colors = tileColors(
      Theme.of(context),
      activeColor: activeColor,
      iconAccentColor: iconAccentColor,
      isActive: isActive,
      isOffline: isOffline,
      isSelected: isSelected,
    );
    final isExpanded =
        (sizeClass ?? _screenService.sizeClass) == ScreenSizeClass.expanded;
    final tile = layout == TileLayout.vertical
        ? _buildVerticalTile(context, colors, isExpanded)
        : _buildHorizontalTile(context, colors, isExpanded);

    return GestureDetector(
      onTap: onTileTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(color: colors.border, width: AppSpacings.scale(1)),
        ),
        child: Stack(
          children: [
            tile,
            if (isOffline && showWarningBadge)
              Positioned(
                top: AppSpacings.pSm,
                right: AppSpacings.pSm,
                child: Icon(
                  MdiIcons.alert,
                  size: AppSpacings.scale(badgeSize),
                  color: colors.badge,
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ============================================================================
  // VERTICAL LAYOUT (icon top, text bottom)
  // ============================================================================

  Widget _buildVerticalTile(
    BuildContext context,
    UniversalTileColors colors,
    bool isExpanded,
  ) {
    return Stack(
      children: [
        Padding(
          padding:
              contentPadding ??
              EdgeInsets.symmetric(
                horizontal: AppSpacings.pMd,
                vertical: AppSpacings.pSm,
              ),
          child: Column(
            children: [
              // Icon - takes available space
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(bottom: AppSpacings.pSm),
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
              _buildName(colors, isExpanded, TextAlign.center),
              if (status != null)
                _buildStatus(colors, isExpanded, TextAlign.center),
              if (accessories != null) ...[
                SizedBox(height: AppSpacings.pSm),
                accessories!,
              ],
            ],
          ),
        ),
        if (isSelected && showSelectionIndicator)
          Positioned(
            top: AppSpacings.pSm,
            left: AppSpacings.pSm,
            child: Icon(
              MdiIcons.checkCircle,
              size: AppSpacings.scale(14),
              color: colors.selection,
            ),
          ),
      ],
    );
  }

  // ============================================================================
  // HORIZONTAL LAYOUT (icon left, text right)
  // ============================================================================

  Widget _buildHorizontalTile(
    BuildContext context,
    UniversalTileColors colors,
    bool isExpanded,
  ) {
    return Padding(
      padding:
          contentPadding ??
          EdgeInsets.symmetric(
            horizontal: AppSpacings.pSm,
            vertical: AppSpacings.pSm,
          ),
      child: Row(
        spacing: AppSpacings.pMd,
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildIconButton(
            context,
            colors,
            AppSpacings.scale(horizontalIconTile),
            AppSpacings.scale(horizontalIconSize),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              spacing: AppSpacings.scale(1),
              children: [
                _buildName(colors, isExpanded, TextAlign.start),
                if (status != null)
                  _buildStatus(colors, isExpanded, TextAlign.start),
              ],
            ),
          ),
          if (accessories != null) accessories!,
          if (isSelected && showSelectionIndicator)
            Icon(
              MdiIcons.checkCircle,
              size: AppSpacings.scale(16),
              color: colors.selection,
            ),
        ],
      ),
    );
  }

  Widget _buildName(
    UniversalTileColors colors,
    bool isExpanded,
    TextAlign align,
  ) => Text(
    name,
    style: TextStyle(
      color: colors.text,
      fontSize:
          nameFontSize ?? (isExpanded ? AppFontSize.base : AppFontSize.small),
      fontWeight: FontWeight.w500,
    ),
    overflow: TextOverflow.ellipsis,
    maxLines: 1,
    textAlign: align,
  );

  Widget _buildStatus(
    UniversalTileColors colors,
    bool isExpanded,
    TextAlign align,
  ) => Text(
    status!,
    style: TextStyle(
      color: colors.status,
      fontSize:
          statusFontSize ??
          (isExpanded ? AppFontSize.small : AppFontSize.extraSmall),
    ),
    overflow: TextOverflow.ellipsis,
    maxLines: 1,
    textAlign: align,
  );

  // ============================================================================
  // ICON BUTTON (shared between layouts)
  // ============================================================================

  Widget _buildIconButton(
    BuildContext context,
    UniversalTileColors colors,
    double containerSize,
    double iconSize,
  ) {
    final iconWidget = Container(
      width: containerSize,
      height: containerSize,
      decoration: BoxDecoration(
        color: colors.iconBackground,
        borderRadius: BorderRadius.circular(AppBorderRadius.inner),
      ),
      child: Icon(
        (isActive && activeIcon != null) ? activeIcon : icon,
        color: colors.icon,
        size: iconSize,
      ),
    );

    if (onIconTap != null) {
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onIconTap,
        child: iconWidget,
      );
    }

    return iconWidget;
  }

  // ============================================================================
  // COLORS
  // ============================================================================

  /// The tile's colours for a state. [activeColor] `primary` (or null)
  /// follows the panel accent; other keys use their family's base and soft.
  static UniversalTileColors tileColors(
    ThemeData theme, {
    ThemeColors? activeColor,
    ThemeColors? iconAccentColor,
    bool isActive = false,
    bool isOffline = false,
    bool isSelected = false,
  }) {
    final neutrals = theme.neutrals;
    final warning = theme.status(AppStatus.warning);
    final tint = _tint(theme, activeColor);
    final iconTint = iconAccentColor == null
        ? null
        : _tint(theme, iconAccentColor);

    if (isOffline) {
      return UniversalTileColors(
        background: neutrals.surfaceCard,
        border: isSelected ? tint.base : neutrals.borderLight,
        iconBackground: neutrals.fillLight,
        icon: neutrals.textDisabled,
        text: neutrals.textPrimary,
        status: warning.text,
        badge: warning.text,
        selection: tint.base,
      );
    }

    final tinted = isActive || isSelected;

    return UniversalTileColors(
      background: tinted ? tint.soft : neutrals.surfaceCard,
      border: isSelected
          ? tint.base
          : isActive
          ? tint.soft
          : neutrals.borderLight,
      iconBackground: isActive
          ? tint.soft
          : iconTint?.soft ?? neutrals.fillLight,
      icon: isActive ? tint.base : iconTint?.base ?? neutrals.textSecondary,
      text: neutrals.textPrimary,
      status: neutrals.textSecondary,
      badge: warning.text,
      selection: tint.base,
    );
  }

  static ({Color base, Color soft}) _tint(ThemeData theme, ThemeColors? key) {
    if (key == null || key == ThemeColors.primary) {
      final accent = theme.accent;

      return (base: accent.text, soft: accent.soft);
    }

    final family = ThemeColorFamily.get(theme.brightness, key);

    return (base: family.base, soft: family.soft);
  }
}

/// Computed tile colours for one state.
@immutable
class UniversalTileColors {
  final Color background;
  final Color border;
  final Color iconBackground;
  final Color icon;
  final Color text;
  final Color status;
  final Color badge;
  final Color selection;

  const UniversalTileColors({
    required this.background,
    required this.border,
    required this.iconBackground,
    required this.icon,
    required this.text,
    required this.status,
    required this.badge,
    required this.selection,
  });
}
