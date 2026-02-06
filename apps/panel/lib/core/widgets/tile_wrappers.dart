import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:flutter/material.dart';

/// Vertical tile for landscape large screens.
///
/// Used inside GridView.count with crossAxisCount: 2 and childAspectRatio: square.
/// The GridView controls the tile dimensions - this wrapper just applies
/// the correct layout and styling.
///
/// Source of truth: climate_domain_view.dart - sensors section (landscape large)
class VerticalTileLarge extends StatelessWidget {
  final IconData icon;
  final IconData? activeIcon;
  final String name;
  final String? status;
  final bool isActive;
  final bool isOffline;
  final bool isSelected;
  final bool showSelectionIndicator;
  final bool showWarningBadge;
  final ThemeColors? activeColor;
  final ThemeColors? iconAccentColor;
  final VoidCallback? onIconTap;
  final VoidCallback? onTileTap;

  const VerticalTileLarge({
    super.key,
    required this.icon,
    this.activeIcon,
    required this.name,
    this.status,
    this.isActive = false,
    this.isOffline = false,
    this.isSelected = false,
    this.showSelectionIndicator = false,
    this.showWarningBadge = false,
    this.activeColor,
    this.iconAccentColor,
    this.onIconTap,
    this.onTileTap,
  });

  @override
  Widget build(BuildContext context) {
    return UniversalTile(
      layout: TileLayout.vertical,
      icon: icon,
      activeIcon: activeIcon,
      name: name,
      status: status,
      isActive: isActive,
      isOffline: isOffline,
      isSelected: isSelected,
      activeColor: activeColor,
      iconAccentColor: iconAccentColor,
      onIconTap: onIconTap,
      onTileTap: onTileTap,
      showGlow: false,
      showDoubleBorder: false,
      showWarningBadge: showWarningBadge,
      showInactiveBorder: true,
      showSelectionIndicator: showSelectionIndicator,
    );
  }
}

/// Horizontal tile for landscape small/medium screens.
///
/// Fixed height, stretches to fill available width.
/// Wrap in SizedBox or let parent control width.
///
/// Source of truth: climate_domain_view.dart - sensors section (landscape small/medium)
class HorizontalTileStretched extends StatelessWidget {
  final IconData icon;
  final IconData? activeIcon;
  final String name;
  final String? status;
  final bool isActive;
  final bool isOffline;
  final bool isSelected;
  final bool showSelectionIndicator;
  final bool showWarningBadge;
  final ThemeColors? activeColor;
  final ThemeColors? iconAccentColor;
  final VoidCallback? onIconTap;
  final VoidCallback? onTileTap;

  const HorizontalTileStretched({
    super.key,
    required this.icon,
    this.activeIcon,
    required this.name,
    this.status,
    this.isActive = false,
    this.isOffline = false,
    this.isSelected = false,
    this.showSelectionIndicator = false,
    this.showWarningBadge = false,
    this.activeColor,
    this.iconAccentColor,
    this.onIconTap,
    this.onTileTap,
  });

  @override
  Widget build(BuildContext context) {
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal);

    return SizedBox(
      height: tileHeight,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: icon,
        activeIcon: activeIcon,
        name: name,
        status: status,
        isActive: isActive,
        isOffline: isOffline,
        isSelected: isSelected,
        activeColor: activeColor,
        iconAccentColor: iconAccentColor,
        onIconTap: onIconTap,
        onTileTap: onTileTap,
        showGlow: false,
        showDoubleBorder: false,
        showWarningBadge: showWarningBadge,
        showInactiveBorder: true,
        showSelectionIndicator: showSelectionIndicator,
      ),
    );
  }
}

/// Horizontal tile for portrait mode (all sizes).
///
/// Fixed width and height, used in horizontal scroll lists.
///
/// Source of truth: climate_domain_view.dart - sensors section (portrait)
class HorizontalTileCompact extends StatelessWidget {

  final IconData icon;
  final IconData? activeIcon;
  final String name;
  final String? status;
  final bool isActive;
  final bool isOffline;
  final bool isSelected;
  final bool showWarningBadge;
  final ThemeColors? activeColor;
  final ThemeColors? iconAccentColor;
  final VoidCallback? onIconTap;
  final VoidCallback? onTileTap;

  const HorizontalTileCompact({
    super.key,
    required this.icon,
    this.activeIcon,
    required this.name,
    this.status,
    this.isActive = false,
    this.isOffline = false,
    this.isSelected = false,
    this.showWarningBadge = false,
    this.activeColor,
    this.iconAccentColor,
    this.onIconTap,
    this.onTileTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: AppSpacings.scale(AppTileWidth.horizontalMedium),
      height: AppSpacings.scale(AppTileHeight.horizontal),
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: icon,
        activeIcon: activeIcon,
        name: name,
        status: status,
        isActive: isActive,
        isOffline: isOffline,
        isSelected: isSelected,
        activeColor: activeColor,
        iconAccentColor: iconAccentColor,
        onIconTap: onIconTap,
        onTileTap: onTileTap,
        showGlow: false,
        showDoubleBorder: false,
        showWarningBadge: showWarningBadge,
        showInactiveBorder: false,
      ),
    );
  }
}

/// Vertical tile for portrait mode (all sizes).
///
/// Fixed width, used in horizontal scroll lists with custom height container.
/// Suitable for channel tiles that need selection indicator.
///
/// Source of truth: lighting_control_panel.dart - channels section (portrait)
class VerticalTileCompact extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final IconData icon;
  final IconData? activeIcon;
  final String name;
  final String? status;
  final bool isActive;
  final bool isOffline;
  final bool isSelected;
  final bool showSelectionIndicator;
  final bool showWarningBadge;
  final bool showInactiveBorder;
  final ThemeColors? activeColor;
  final ThemeColors? iconAccentColor;
  final VoidCallback? onIconTap;
  final VoidCallback? onTileTap;

  VerticalTileCompact({
    super.key,
    required this.icon,
    this.activeIcon,
    required this.name,
    this.status,
    this.isActive = false,
    this.isOffline = false,
    this.isSelected = false,
    this.showSelectionIndicator = false,
    this.showWarningBadge = false,
    this.showInactiveBorder = true,
    this.activeColor,
    this.iconAccentColor,
    this.onIconTap,
    this.onTileTap,
  });

  @override
  Widget build(BuildContext context) {
    // Use medium width for small screens, large width for others
    final tileWidth = _screenService.isSmallScreen
        ? AppTileWidth.verticalMedium
        : AppTileWidth.verticalLarge;

    return SizedBox(
      width: AppSpacings.scale(tileWidth),
      child: UniversalTile(
        layout: TileLayout.vertical,
        icon: icon,
        activeIcon: activeIcon,
        name: name,
        status: status,
        isActive: isActive,
        isOffline: isOffline,
        isSelected: isSelected,
        activeColor: activeColor,
        iconAccentColor: iconAccentColor,
        onIconTap: onIconTap,
        onTileTap: onTileTap,
        showGlow: false,
        showDoubleBorder: false,
        showWarningBadge: showWarningBadge,
        showInactiveBorder: showInactiveBorder,
        showSelectionIndicator: showSelectionIndicator,
      ),
    );
  }
}

/// Horizontal device tile for landscape mode (all sizes).
///
/// Fixed height, stretches to fill available width.
/// Shows warning badge for offline devices.
///
/// Source of truth: climate_domain_view.dart - auxiliary devices (landscape)
class DeviceTileLandscape extends StatelessWidget {
  final IconData icon;
  final IconData? activeIcon;
  final String name;
  final String? status;
  final bool isActive;
  final bool isOffline;
  final bool isSelected;
  final bool showSelectionIndicator;
  final ThemeColors? activeColor;
  final ThemeColors? iconAccentColor;
  final VoidCallback? onIconTap;
  final VoidCallback? onTileTap;
  final Widget? accessories;

  const DeviceTileLandscape({
    super.key,
    required this.icon,
    this.activeIcon,
    required this.name,
    this.status,
    this.isActive = false,
    this.isOffline = false,
    this.isSelected = false,
    this.showSelectionIndicator = false,
    this.activeColor,
    this.iconAccentColor,
    this.onIconTap,
    this.onTileTap,
    this.accessories,
  });

  @override
  Widget build(BuildContext context) {
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal);

    return SizedBox(
      height: tileHeight,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: icon,
        activeIcon: activeIcon,
        name: name,
        status: status,
        isActive: isActive,
        isOffline: isOffline,
        isSelected: isSelected,
        activeColor: activeColor,
        iconAccentColor: iconAccentColor,
        onIconTap: onIconTap,
        onTileTap: onTileTap,
        showGlow: false,
        showDoubleBorder: false,
        showWarningBadge: true,
        showInactiveBorder: true,
        showSelectionIndicator: showSelectionIndicator,
        accessories: accessories,
      ),
    );
  }
}

/// Horizontal device tile for portrait mode (all sizes).
///
/// Fixed height, stretches to fill available width (use with Expanded).
/// Shows warning badge for offline devices.
///
/// Source of truth: climate_domain_view.dart - auxiliary devices (portrait)
class DeviceTilePortrait extends StatelessWidget {

  final IconData icon;
  final IconData? activeIcon;
  final String name;
  final String? status;
  final bool isActive;
  final bool isOffline;
  final bool isSelected;
  final ThemeColors? activeColor;
  final ThemeColors? iconAccentColor;
  final VoidCallback? onIconTap;
  final VoidCallback? onTileTap;
  final Widget? accessories;

  const DeviceTilePortrait({
    super.key,
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
    this.accessories,
  });

  @override
  Widget build(BuildContext context) {
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal);

    return SizedBox(
      height: tileHeight,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: icon,
        activeIcon: activeIcon,
        name: name,
        status: status,
        isActive: isActive,
        isOffline: isOffline,
        isSelected: isSelected,
        activeColor: activeColor,
        iconAccentColor: iconAccentColor,
        onIconTap: onIconTap,
        onTileTap: onTileTap,
        showGlow: false,
        showDoubleBorder: false,
        showWarningBadge: true,
        showInactiveBorder: false,
        accessories: accessories,
      ),
    );
  }
}
