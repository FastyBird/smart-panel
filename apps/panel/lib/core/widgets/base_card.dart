import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// The card (docs/display-ui-design-spec.md §3, §5): `surface.card` with a
/// 1 px `border.light` outline in both themes, radius 8, no shadow, and the
/// page padding of its class inside (6 Compact, 8 Regular, 12 Expanded).
///
/// Use this widget wherever a card-like container is needed instead of manually
/// building Container + BoxDecoration with fill color, border, and borderRadius.
///
/// Optionally includes a built-in header row with [headerIcon], [headerTitle],
/// and [headerTrailing]. When a header is provided, the card body ([child]) is
/// rendered below it.
class BaseCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double? width;
  final double? height;

  /// Optional card background color. When null, uses `surface.card`.
  final Color? color;

  /// Optional card border color. When null, uses `border.light`.
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

  /// The class whose padding the card uses; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  const BaseCard({
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
    this.sizeClass,
  });

  /// Padding inside a card, in design px: the page padding of [sizeClass].
  static double paddingFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 6,
    ScreenSizeClass.regular => 8,
    ScreenSizeClass.expanded => 12,
  };

  bool get _hasHeader => headerTitle != null;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;

    final resolvedColor = color ?? neutrals.surfaceCard;
    final resolvedBorderColor = borderColor ?? neutrals.borderLight;
    final finalBorderWidth = borderWidth ?? AppSpacings.scale(1);

    final resolvedPadding =
        padding ??
        EdgeInsets.all(
          AppSpacings.scale(
            paddingFor(sizeClass ?? locator<ScreenService>().sizeClass),
          ),
        );

    if (!_hasHeader) {
      return Container(
        width: width,
        height: height,
        padding: resolvedPadding,
        decoration: BoxDecoration(
          color: resolvedColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: finalBorderWidth > 0
              ? Border.all(color: resolvedBorderColor, width: finalBorderWidth)
              : null,
        ),
        child: child,
      );
    }

    final resolvedEdgeInsets = resolvedPadding.resolve(
      Directionality.of(context),
    );

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: resolvedColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: finalBorderWidth > 0
            ? Border.all(color: resolvedBorderColor, width: finalBorderWidth)
            : null,
      ),
      child: Column(
        mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(
              left: resolvedEdgeInsets.left,
              right: resolvedEdgeInsets.right,
            ),
            child: _BaseCardHeader(
              icon: headerIcon,
              title: headerTitle!,
              titleColor: headerTitleColor,
              trailing: headerTrailing,
              padding: EdgeInsets.only(
                top: resolvedEdgeInsets.top,
                bottom: resolvedEdgeInsets.bottom,
              ),
            ),
          ),
          if (headerLine) ...[
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
              padding: headerLine
                  ? resolvedPadding
                  : EdgeInsets.only(
                      left: resolvedEdgeInsets.left,
                      right: resolvedEdgeInsets.right,
                      bottom: resolvedEdgeInsets.bottom,
                    ),
              child: child,
            ),
        ],
      ),
    );
  }
}

class _BaseCardHeader extends StatelessWidget {
  final IconData? icon;
  final String title;
  final Color? titleColor;
  final Widget? trailing;
  final EdgeInsetsGeometry? padding;

  const _BaseCardHeader({
    this.icon,
    required this.title,
    this.titleColor,
    this.trailing,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final secondaryColor = Theme.of(context).neutrals.textSecondary;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Padding(
          padding: padding ?? EdgeInsets.zero,
          child: Row(
            spacing: AppSpacings.pSm,
            children: [
              if (icon != null)
                Icon(icon, size: AppFontSize.small, color: secondaryColor),
              Text(
                title.toUpperCase(),
                style: TextStyle(
                  color: titleColor ?? secondaryColor,
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}
