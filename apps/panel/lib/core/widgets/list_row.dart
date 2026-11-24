import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// The list row's sizes (design canvas, "Settings" and the overlay sheets).
class AppListRowMetrics {
  AppListRowMetrics._();

  /// The row's height; a two-line subtitle may make it taller.
  static double heightFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 40,
    ScreenSizeClass.regular => 48,
    ScreenSizeClass.expanded => 56,
  };

  /// Space before the title.
  static const double paddingStart = 12;

  /// Space after a trailing control, which brings its own touch zone.
  static const double paddingEndControl = 4;

  /// Space after the title or a trailing text.
  static const double paddingEnd = 12;

  static const double gap = 8;
  static const double icon = 16;

  /// The share a trailing control may take of the width the icon and the
  /// gaps leave; the title keeps the rest and ellipsizes.
  static const double trailingShare = 0.6;
}

/// The one list row (docs/display-ui-design-spec.md §5): a title, an optional
/// subtitle and one trailing control, on `surface.card` with a `border.light`
/// outline and radius 8.
///
/// - The title is 14/500 (spec §3), the subtitle 10 in `text.secondary`.
/// - [selected]: the accent's soft tint with an outline in the accent text.
/// - [danger]: the title and outline take the danger colour.
/// - [enabled] false: the title is `text.disabled`, and neither the row nor
///   its trailing control reacts.
///
/// With [onTap] the whole row is one button. Set [surface] false to lay the
/// row inside a card that draws its own surface.
class AppListRow extends StatelessWidget {
  const AppListRow({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.icon,
    this.onTap,
    this.selected = false,
    this.danger = false,
    this.enabled = true,
    this.surface = true,
    this.sizeClass,
  });

  final String title;
  final String? subtitle;

  /// One control (switch, value with chevron, button) or a short value.
  final Widget? trailing;

  /// A leading icon in `text.secondary` (the accent text when selected).
  final IconData? icon;

  final VoidCallback? onTap;
  final bool selected;
  final bool danger;
  final bool enabled;

  /// Whether the row draws its card surface and outline.
  final bool surface;

  /// The class to size the row for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final accent = theme.accent;
    final dangerColors = theme.status(AppStatus.danger);
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;

    final titleColor = !enabled
        ? neutrals.textDisabled
        : danger
        ? dangerColors.text
        : neutrals.textPrimary;
    final outline = selected
        ? accent.text
        : danger
        ? dangerColors.border
        : neutrals.borderLight;
    final background = selected ? accent.soft : neutrals.surfaceCard;
    final iconColor = !enabled
        ? neutrals.textDisabled
        : selected
        ? accent.text
        : neutrals.textSecondary;

    final radius = BorderRadius.circular(AppBorderRadius.base);
    final hasSubtitle = subtitle != null && subtitle!.isNotEmpty;

    final text = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.scale(1),
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: AppFontSize.base,
            fontWeight: FontWeight.w500,
            color: titleColor,
          ),
        ),
        if (hasSubtitle)
          Text(
            subtitle!,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              color: enabled ? neutrals.textSecondary : neutrals.textDisabled,
            ),
          ),
      ],
    );

    final gap = AppSpacings.scale(AppListRowMetrics.gap);
    final iconSize = AppSpacings.scale(AppListRowMetrics.icon);
    final leading = icon == null
        ? null
        : Icon(icon, size: iconSize, color: iconColor);

    // A disabled row disables its control too: no taps, focus or semantic
    // actions.
    final control = trailing == null
        ? null
        : IgnorePointer(
            ignoring: !enabled,
            child: ExcludeFocus(excluding: !enabled, child: trailing!),
          );

    final row = LayoutBuilder(
      builder: (context, constraints) {
        // Without a width to share (a horizontal scroll), the row takes its
        // natural width.
        if (!constraints.hasBoundedWidth) {
          return Row(
            mainAxisSize: MainAxisSize.min,
            spacing: gap,
            children: [?leading, text, ?control],
          );
        }

        // The control's share is of the width the icon and the gaps leave,
        // so the title always keeps the rest.
        final fixed =
            (leading == null ? 0.0 : iconSize + gap) +
            (control == null ? 0.0 : gap);
        final shared = math.max(0.0, constraints.maxWidth - fixed);

        return Row(
          spacing: gap,
          children: [
            ?leading,
            Expanded(child: text),
            if (control != null)
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: shared * AppListRowMetrics.trailingShare,
                ),
                child: control,
              ),
          ],
        );
      },
    );

    final content = ConstrainedBox(
      constraints: BoxConstraints(
        minHeight: AppSpacings.scale(AppListRowMetrics.heightFor(resolvedClass)),
      ),
      child: Padding(
        padding: EdgeInsetsDirectional.only(
          start: AppSpacings.scale(AppListRowMetrics.paddingStart),
          end: AppSpacings.scale(
            trailing != null
                ? AppListRowMetrics.paddingEndControl
                : AppListRowMetrics.paddingEnd,
          ),
          top: hasSubtitle ? AppSpacings.pSm : 0,
          bottom: hasSubtitle ? AppSpacings.pSm : 0,
        ),
        // Centred in the row's minimum height, never stretched past it.
        child: Align(
          alignment: AlignmentDirectional.centerStart,
          heightFactor: 1,
          child: row,
        ),
      ),
    );

    final tappable = onTap != null && enabled;

    return Semantics(
      container: true,
      button: onTap != null ? true : null,
      selected: selected ? true : null,
      enabled: onTap != null ? enabled : null,
      child: Material(
        color: surface ? background : AppColors.blank,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: surface
              ? BorderSide(color: outline, width: AppSpacings.scale(1))
              : BorderSide.none,
        ),
        clipBehavior: Clip.antiAlias,
        child: tappable
            ? InkWell(onTap: onTap, borderRadius: radius, child: content)
            : content,
      ),
    );
  }
}
