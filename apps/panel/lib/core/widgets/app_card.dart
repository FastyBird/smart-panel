import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A reusable card container with consistent fill, border, and border-radius
/// styling that adapts to light/dark theme.
///
/// Use this widget wherever a card-like container is needed instead of manually
/// building Container + BoxDecoration with fill color, border, and borderRadius.
///
/// Optionally includes a built-in header row with [headerIcon], [headerTitle],
/// and [headerTrailing]. When a header is provided, the card body ([child]) is
/// rendered below it.
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

  final double? borderWidth;

  /// Optional header icon displayed before the title.
  final IconData? headerIcon;

  /// Optional header title. When provided, a header row is rendered
  /// above [child].
  final String? headerTitle;

  /// Optional title color override. When null, uses theme primary text color.
  final Color? headerTitleColor;

  /// Optional trailing widget in the header row (e.g. badge, button).
  final Widget? headerTrailing;

  /// When true, draws a divider line below the header row.
  final bool headerLine;

  /// When true, the card's internal Column uses [MainAxisSize.max] so that
  /// [Expanded] children work correctly. Defaults to false ([MainAxisSize.min]).
  final bool expanded;

  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.width,
    this.height,
    this.color,
    this.borderColor,
    this.borderWidth,
    this.headerIcon,
    this.headerTitle,
    this.headerTitleColor,
    this.headerTrailing,
    this.headerLine = false,
    this.expanded = false,
  });

  bool get _hasHeader => headerTitle != null;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final resolvedColor =
        color ?? (isDark ? AppFillColorDark.lighter : AppFillColorLight.light);
    final resolvedBorderColor = borderColor ??
        (isDark ? AppBorderColorDark.light : AppBorderColorLight.darker);
    final finalBorderWidth = borderWidth ?? AppSpacings.scale(1);

    final resolvedPadding = padding ?? AppSpacings.paddingMd;

    if (!_hasHeader) {
      return Container(
        width: width,
        height: height,
        padding: resolvedPadding,
        decoration: BoxDecoration(
          color: resolvedColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(color: resolvedBorderColor, width: finalBorderWidth),
        ),
        child: child,
      );
    }

    final resolvedEdgeInsets = resolvedPadding.resolve(Directionality.of(context));

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: resolvedColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: resolvedBorderColor, width: finalBorderWidth),
      ),
      child: Column(
        mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(
              left: resolvedEdgeInsets.left,
              right: resolvedEdgeInsets.right,
              top: resolvedEdgeInsets.top,
              bottom: 0,
            ),
            child: _AppCardHeader(
              icon: headerIcon,
              title: headerTitle!,
              titleColor: headerTitleColor,
              trailing: headerTrailing,
            ),
          ),
          if (headerLine) ...[
            AppSpacings.spacingMdVertical,
            Divider(
              height: expanded ? AppSpacings.scale(1) : AppSpacings.pMd,
              thickness: AppSpacings.scale(1),
              color: resolvedBorderColor,
            ),
          ],
          if (expanded)
            child
          else
            Padding(
              padding: resolvedPadding,
              child: child,
            ),
        ],
      ),
    );
  }
}

class _AppCardHeader extends StatelessWidget {
  final IconData? icon;
  final String title;
  final Color? titleColor;
  final Widget? trailing;

  const _AppCardHeader({
    this.icon,
    required this.title,
    this.titleColor,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          spacing: AppSpacings.pSm,
          children: [
            if (icon != null)
              Icon(
                icon,
                size: AppFontSize.small,
                color: secondaryColor,
              ),
            Text(
              title,
              style: TextStyle(
                color: titleColor ?? secondaryColor,
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}
