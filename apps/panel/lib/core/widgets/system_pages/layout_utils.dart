import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/icon_container.dart';

/// Layout utilities for system pages (discovery, error, configuration screens)
/// Provides consistent padding, icon sizing, and spacing across all system pages
class SystemPagesLayout {
  /// Returns the appropriate padding for system pages based on screen size and orientation
  /// LANDSCAPE - LARGE: pXl, MEDIUM/SMALL: pLg
  /// PORTRAIT - LARGE/MEDIUM: pXl, SMALL: pLg
  static double getPagePadding(ScreenService screenService, bool isLandscape) {
    if (isLandscape) {
      return screenService.isLargeScreen ? AppSpacings.pXl : AppSpacings.pLg;
    } else {
      return screenService.isSmallScreen ? AppSpacings.pLg : AppSpacings.pXl;
    }
  }

  /// Returns the spacing below the icon based on orientation and size
  static double getIconBottomSpacing(
    ScreenService screenService,
    bool isLandscape,
  ) {
    final isCompact =
        screenService.isSmallScreen || screenService.isMediumScreen;
    final isCompactLandscape = isCompact && isLandscape;

    return screenService.scale(isCompactLandscape ? 12 : 24);
  }

  /// Builds a system page icon with responsive sizing
  /// [useContainer] - wraps icon in IconContainer with background
  static Widget buildIcon({
    required ScreenService screenService,
    required IconData icon,
    required Color color,
    required bool isLandscape,
    bool useContainer = true,
  }) {
    final isCompact =
        screenService.isSmallScreen || screenService.isMediumScreen;
    final isCompactLandscape = isCompact && isLandscape;

    // Icon sizes: compact landscape uses smaller sizes
    final containerSize = screenService.scale(isCompactLandscape ? 56 : 80);
    final iconSize = screenService.scale(
      useContainer
          ? (isCompactLandscape ? 28 : 40)
          : (isCompactLandscape ? 32 : 48),
    );

    if (useContainer) {
      return IconContainer(
        icon: icon,
        color: color,
        size: containerSize,
        iconSize: iconSize,
      );
    }

    return Icon(icon, color: color, size: iconSize);
  }
}
