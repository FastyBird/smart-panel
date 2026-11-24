import 'dart:math' as math;

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

  /// Between the icon tile and the label, side by side.
  static const double rowGap = 8;

  /// The height the stacked layout needs: the padding, the icon tile and a
  /// label line with room to spare. A shorter tile lays the label beside the
  /// icon (design canvas: a row tile below 64 px).
  static double stackedHeightFor(ScreenSizeClass sizeClass) =>
      2 * paddingFor(sizeClass) + chipFor(sizeClass) + 1.5 * labelFor(sizeClass) + 4;
}

/// A tile on the settings home grid: `surface.card` with a `border.light`
/// outline and radius 8, an icon tile on [iconBgColor] and the label at
/// 12/500 (16 on Expanded): the icon at the top, the label at the foot. A
/// tile too short for that ([SettingsTileMetrics.stackedHeightFor]) lays the
/// label beside the icon, up to two lines.
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

    final padding = AppSpacings.scale(
      SettingsTileMetrics.paddingFor(resolvedClass),
    );
    final labelStyle = TextStyle(
      fontSize: AppSpacings.scale(SettingsTileMetrics.labelFor(resolvedClass)),
      fontWeight: FontWeight.w500,
      color: neutrals.textPrimary,
    );

    Widget chip(double size) => Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: iconBgColor, borderRadius: radius),
      child: Icon(
        icon,
        size: math.min(
          size,
          AppSpacings.scale(SettingsTileMetrics.iconFor(resolvedClass)),
        ),
        color: iconColor,
      ),
    );

    final content = LayoutBuilder(
      builder: (context, constraints) {
        final stacked =
            !constraints.hasBoundedHeight ||
            constraints.maxHeight >=
                AppSpacings.scale(
                  SettingsTileMetrics.stackedHeightFor(resolvedClass),
                );

        if (stacked) {
          return Padding(
            padding: EdgeInsets.all(padding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                chip(chipSize),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: labelStyle,
                ),
              ],
            ),
          );
        }

        // Side by side: the icon tile shrinks to a very short tile, and the
        // padding gives way before it does.
        final rowChip = math.min(chipSize, constraints.maxHeight);
        final vertical = math.max(
          0.0,
          math.min(padding, (constraints.maxHeight - rowChip) / 2),
        );

        return Padding(
          padding: EdgeInsets.symmetric(
            horizontal: padding,
            vertical: vertical,
          ),
          child: Row(
            spacing: AppSpacings.scale(SettingsTileMetrics.rowGap),
            children: [
              chip(rowChip),
              Expanded(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: labelStyle,
                ),
              ),
            ],
          ),
        );
      },
    );

    // One node, announced once, that a screen reader can activate too.
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      onTap: onTap,
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
          child: content,
        ),
      ),
    );
  }
}
