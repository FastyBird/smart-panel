import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// The settings home tile's sizes (design canvas, "Settings").
class SettingsTileMetrics {
  SettingsTileMetrics._();

  static double paddingFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.compact ? 6 : 12;

  /// The icon tile.
  static double chipFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 28,
    ScreenSizeClass.regular => 36,
    ScreenSizeClass.expanded => 44,
  };

  static double iconFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 16,
    ScreenSizeClass.regular => 20,
    ScreenSizeClass.expanded => 24,
  };

  /// The label: 12, 16 on Expanded.
  static double labelFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.expanded ? 16 : 12;
}

/// A tile on the settings home grid: `surface.card` with a `border.light`
/// outline and radius 8, an icon tile on [iconBgColor] and the label at
/// 12/500 (16 on Expanded): the icon at the top, the label at the foot. The
/// settings grid keeps tiles tall enough for both (64 px and up).
class SettingsTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final VoidCallback? onTap;

  /// The class to size the tile for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  const SettingsTile({
    super.key,
    required this.label,
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    this.onTap,
    this.sizeClass,
  });

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final radius = BorderRadius.circular(AppBorderRadius.base);
    final chipSize = AppSpacings.scale(SettingsTileMetrics.chipFor(resolvedClass));

    final chip = Container(
      width: chipSize,
      height: chipSize,
      decoration: BoxDecoration(color: iconBgColor, borderRadius: radius),
      child: Icon(
        icon,
        size: AppSpacings.scale(SettingsTileMetrics.iconFor(resolvedClass)),
        color: iconColor,
      ),
    );
    final text = Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        fontSize: AppSpacings.scale(SettingsTileMetrics.labelFor(resolvedClass)),
        fontWeight: FontWeight.w500,
        color: neutrals.textPrimary,
      ),
    );

    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: neutrals.surfaceCard,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(
            color: neutrals.borderLight,
            width: AppSpacings.scale(1),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: Padding(
            padding: EdgeInsets.all(
              AppSpacings.scale(SettingsTileMetrics.paddingFor(resolvedClass)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [chip, text],
            ),
          ),
        ),
      ),
    );
  }
}
