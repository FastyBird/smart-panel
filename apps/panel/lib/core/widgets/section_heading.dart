import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// The section label's sizes (design canvas, "Settings" and the mode popup).
class SectionLabelMetrics {
  SectionLabelMetrics._();

  /// Letter spacing, 0.06 em of the 10 px label.
  static const double letterSpacing = 0.6;

  static const double paddingTop = 4;
  static const double paddingSide = 2;

  /// An icon beside a coloured label.
  static const double icon = 12;
}

/// The one section label (docs/display-ui-design-spec.md §5): 10/700,
/// uppercase, 0.06 em apart, in `text.secondary`, with an optional trailing
/// action. Screen readers hear it as a heading.
///
/// A [color] other than the default is a status or domain colour, so the
/// label then shows its [icon] beside it (spec §2: a colour never stands
/// alone).
class SectionLabel extends StatelessWidget {
  const SectionLabel({
    super.key,
    required this.label,
    this.icon,
    this.color,
    this.trailing,
  });

  final String label;

  /// Shown only with a [color].
  final IconData? icon;

  final Color? color;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? Theme.of(context).neutrals.textSecondary;

    return Padding(
      padding: EdgeInsets.only(
        top: AppSpacings.scale(SectionLabelMetrics.paddingTop),
        left: AppSpacings.scale(SectionLabelMetrics.paddingSide),
        right: AppSpacings.scale(SectionLabelMetrics.paddingSide),
      ),
      child: Row(
        spacing: AppSpacings.pSm,
        children: [
          if (color != null && icon != null)
            Icon(
              icon,
              color: effectiveColor,
              size: AppSpacings.scale(SectionLabelMetrics.icon),
            ),
          Expanded(
            child: Semantics(
              header: true,
              child: Text(
                label.toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: effectiveColor,
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w700,
                  letterSpacing: AppSpacings.scale(
                    SectionLabelMetrics.letterSpacing,
                  ),
                ),
              ),
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// A section label with an icon parameter; draws the one [SectionLabel].
///
/// The icon shows only with a [color] (see [SectionLabel]).
///
/// ```dart
/// SectionTitle(
///   title: 'Other Lights',
///   icon: MdiIcons.lightbulbOutline,
///   trailing: SectionTitleButton(label: 'All Off', onTap: toggleAll),
/// )
/// ```
class SectionTitle extends StatelessWidget {
  /// The title text to display
  final String title;

  /// Shown beside a coloured title.
  final IconData icon;

  /// A status or domain colour for the title and its icon.
  final Color? color;

  /// Optional trailing widget (e.g., action button)
  final Widget? trailing;

  const SectionTitle({
    super.key,
    required this.title,
    required this.icon,
    this.color,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) => SectionLabel(
    label: title,
    icon: icon,
    color: color,
    trailing: trailing,
  );
}

/// A small action beside a section label: 36 high (the touch floor),
/// `fill.light` with a `border.light` outline and radius 6, a 12/500 label.
class SectionTitleButton extends StatelessWidget {
  /// Button label text
  final String label;

  /// Optional leading icon
  final IconData? icon;

  /// Callback when button is tapped; null disables the button.
  final VoidCallback? onTap;

  const SectionTitleButton({
    super.key,
    required this.label,
    this.icon,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final enabled = onTap != null;
    final foreground = enabled ? neutrals.textPrimary : neutrals.textDisabled;
    final radius = BorderRadius.circular(AppBorderRadius.inner);

    return Semantics(
      button: true,
      enabled: enabled,
      child: Material(
        color: neutrals.fillLight,
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
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: AppSpacings.scale(36),
              minWidth: AppSpacings.scale(36),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                spacing: AppSpacings.pSm,
                children: [
                  if (icon != null)
                    Icon(icon, size: AppSpacings.scale(14), color: foreground),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: AppFontSize.small,
                      fontWeight: FontWeight.w500,
                      color: foreground,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A column header: the section label with an optional count badge, 36
/// high. The borders and tinted background are gone; [showTopBorder] is
/// kept so callers compile and draws nothing.
class SectionHeader extends StatelessWidget {
  /// The title text to display
  final String title;

  /// Shown beside a coloured title.
  final IconData icon;

  /// No longer draws anything.
  final bool showTopBorder;

  /// Optional count to display in a badge
  final int? count;

  /// A status or domain colour for the title and its icon.
  final Color? accentColor;

  const SectionHeader({
    super.key,
    required this.title,
    required this.icon,
    this.showTopBorder = true,
    this.count,
    this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;

    return Container(
      constraints: BoxConstraints(minHeight: AppSpacings.scale(36)),
      padding: EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
      alignment: AlignmentDirectional.centerStart,
      child: SectionLabel(
        label: title,
        icon: icon,
        color: accentColor,
        trailing: count == null
            ? null
            : Container(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pSm,
                  vertical: AppSpacings.scale(2),
                ),
                decoration: BoxDecoration(
                  color: neutrals.fillBase,
                  borderRadius: BorderRadius.circular(AppBorderRadius.small),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    color: neutrals.textSecondary,
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
      ),
    );
  }
}
