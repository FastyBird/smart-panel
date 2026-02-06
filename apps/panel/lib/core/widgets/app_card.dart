import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A reusable card container with consistent fill, border, and border-radius
/// styling that adapts to light/dark theme.
///
/// Use this widget wherever a card-like container is needed instead of manually
/// building Container + BoxDecoration with fill color, border, and borderRadius.
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double? width;
  final double? height;

  /// Optional card background color. When null, uses the default
  /// (AppFillColorLight.light / AppFillColorDark.lighter).
  final Color? color;

  /// Optional card border color. When null, uses the default
  /// (AppBorderColorLight.darker / AppBorderColorDark.light).
  final Color? borderColor;

  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.width,
    this.height,
    this.color,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final resolvedColor =
        color ?? (isDark ? AppFillColorDark.lighter : AppFillColorLight.light);
    final resolvedBorderColor = borderColor ??
        (isDark ? AppBorderColorDark.light : AppBorderColorLight.darker);
    final borderWidth = AppSpacings.scale(1);

    return Container(
      width: width,
      height: height,
      padding: padding ?? AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: resolvedColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: resolvedBorderColor, width: borderWidth),
      ),
      child: child,
    );
  }
}
