import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/services/screen.dart';

/// Responsive circular icon container for system pages.
/// Handles compact/landscape sizing automatically.
/// When [useContainer] is true, wraps icon in a circle with tinted background.
/// When false, renders just the icon with responsive sizing.
class IconContainer extends StatelessWidget {
  final ScreenService screenService;
  final IconData icon;
  final Color color;
  final bool isLandscape;
  final bool useContainer;

  const IconContainer({
    super.key,
    required this.screenService,
    required this.icon,
    required this.color,
    required this.isLandscape,
    this.useContainer = true,
  });

  @override
  Widget build(BuildContext context) {
    final isCompact =
        screenService.isSmallScreen || screenService.isMediumScreen;
    final isCompactLandscape = isCompact && isLandscape;

    final containerSize =
        screenService.scale(isCompactLandscape ? 56 : 80);
    final iconSize = screenService.scale(
      useContainer
          ? (isCompactLandscape ? 28 : 40)
          : (isCompactLandscape ? 32 : 48),
    );

    if (useContainer) {
      return Container(
        width: containerSize,
        height: containerSize,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: color, size: iconSize),
      );
    }

    return Icon(icon, color: color, size: iconSize);
  }
}
