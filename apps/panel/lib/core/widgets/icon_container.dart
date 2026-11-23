import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// The state icon of system pages and state templates: the icon in a circle
/// on its colour's tint, 36, 44 or 56 design px by class
/// (docs/display-ui-design-spec.md §7).
///
/// When [useContainer] is false only the icon is drawn, at the circle's size.
class IconContainer extends StatelessWidget {
  final ScreenService screenService;
  final IconData icon;
  final Color color;

  /// Kept for existing callers; the size follows the size class only.
  final bool isLandscape;

  final bool useContainer;

  /// The circle's fill. Defaults to [color] at 12 % on the page surface;
  /// pass the matching soft token where there is one.
  final Color? softColor;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  const IconContainer({
    super.key,
    required this.screenService,
    required this.icon,
    required this.color,
    required this.isLandscape,
    this.useContainer = true,
    this.softColor,
    this.sizeClass,
  });

  /// Circle side and icon size in design px for [sizeClass].
  static ({double circle, double icon}) metricsFor(ScreenSizeClass sizeClass) =>
      switch (sizeClass) {
        ScreenSizeClass.compact => (circle: 36, icon: 18),
        ScreenSizeClass.regular => (circle: 44, icon: 22),
        ScreenSizeClass.expanded => (circle: 56, icon: 28),
      };

  @override
  Widget build(BuildContext context) {
    final metrics = metricsFor(sizeClass ?? screenService.sizeClass);
    final circle = screenService.scale(metrics.circle);

    if (!useContainer) {
      return Icon(icon, color: color, size: circle);
    }

    final fill = softColor ??
        Color.alphaBlend(
          color.withValues(alpha: 0.12),
          Theme.of(context).neutrals.surfacePage,
        );

    return Container(
      width: circle,
      height: circle,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
      child: Icon(icon, color: color, size: screenService.scale(metrics.icon)),
    );
  }
}
