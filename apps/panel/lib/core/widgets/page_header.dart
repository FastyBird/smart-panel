import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The page header's sizes per size class, in design px
/// (docs/display-ui-design-spec.md §4, "Header").
@immutable
class PageHeaderMetrics {
  const PageHeaderMetrics._({
    required this.sizeClass,
    required this.height,
    required this.padding,
    required this.iconTile,
    required this.iconSize,
  });

  static const compact = PageHeaderMetrics._(
    sizeClass: ScreenSizeClass.compact,
    height: 36,
    padding: 6,
    iconTile: 28,
    iconSize: 16,
  );

  static const regular = PageHeaderMetrics._(
    sizeClass: ScreenSizeClass.regular,
    height: 40,
    padding: 8,
    iconTile: 32,
    iconSize: 18,
  );

  static const expanded = PageHeaderMetrics._(
    sizeClass: ScreenSizeClass.expanded,
    height: 48,
    padding: 12,
    iconTile: 40,
    iconSize: 22,
  );

  /// Header buttons are one touch target at every class.
  static const double buttonSize = 36;

  static const double buttonIconSize = 18;

  /// Between the back button, icon tile, title and actions.
  static const double gap = 8;

  static const double stateIconSize = 11;

  final ScreenSizeClass sizeClass;

  /// Height of the header row.
  final double height;

  /// Page padding around the header, the same as the page's.
  final double padding;

  /// Side of the icon tile.
  final double iconTile;

  /// Icon inside the icon tile.
  final double iconSize;

  static PageHeaderMetrics of(ScreenSizeClass sizeClass) => switch (sizeClass) {
        ScreenSizeClass.compact => compact,
        ScreenSizeClass.regular => regular,
        ScreenSizeClass.expanded => expanded,
      };

  /// Title: 14 Compact, 16 Regular, 18 Expanded.
  double get titleFontSize => switch (sizeClass) {
        ScreenSizeClass.compact => AppFontSize.base,
        ScreenSizeClass.regular => AppFontSize.large,
        ScreenSizeClass.expanded => AppFontSize.extraLarge,
      };

  /// Live-state line: 10, or 12 on Expanded.
  double get stateFontSize => sizeClass == ScreenSizeClass.expanded
      ? AppFontSize.small
      : AppFontSize.extraSmall;
}

/// The size class a [PageHeader] and its parts render at.
class _PageHeaderScope extends InheritedWidget {
  const _PageHeaderScope({required this.sizeClass, required super.child});

  final ScreenSizeClass sizeClass;

  @override
  bool updateShouldNotify(_PageHeaderScope oldWidget) =>
      sizeClass != oldWidget.sizeClass;
}

/// The one header for every screen: an optional back button, the icon tile,
/// the title, the live-state line and the actions
/// (docs/display-ui-design-spec.md §4, §5).
///
/// It is 36, 40 or 48 design px high with a 14, 16 or 18 title on Compact,
/// Regular and Expanded, padded like the page. Every button in it is at least
/// 36 design px.
///
/// The size class comes from [sizeClass], else from the [ScreenService];
/// [HeaderMainIcon], [HeaderIconButton] and [HeaderBackButton] inside it
/// follow the header's class.
class PageHeader extends StatelessWidget {
  /// Title text displayed in header
  final String title;

  /// The live-state line under the title.
  final String? subtitle;

  /// Icon before the live-state line, for example an alert when offline.
  final IconData? subtitleIcon;

  /// Icon tile shown after the back button (ignored when [leading] is set).
  final IconData? icon;

  /// Colour of the [icon] tile.
  final ThemeColors iconColor;

  /// Custom leading widget, usually a [HeaderMainIcon], optionally after a
  /// [HeaderBackButton].
  final Widget? leading;

  /// Shows a back button that calls this (ignored when [leading] is set).
  final VoidCallback? onBack;

  /// Actions, usually [HeaderIconButton]s.
  final Widget? trailing;

  /// Extra widget shown only in landscape, placed after [trailing] (rightmost).
  ///
  /// Useful for domain-level actions (e.g. mode chip) that should only
  /// appear when the header has room in landscape orientation. The widget
  /// adds its own leading margin, so an empty one leaves no gap.
  final Widget? landscapeAction;

  /// Optional colored border at bottom (for error/warning states)
  final Color? borderColor;

  /// Background color override (use Colors.transparent for no background)
  final Color? backgroundColor;

  /// Colour of the live-state line, for a warning or an active state.
  final Color? subtitleColor;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  const PageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.subtitleIcon,
    this.icon,
    this.iconColor = ThemeColors.primary,
    this.leading,
    this.onBack,
    this.trailing,
    this.landscapeAction,
    this.borderColor,
    this.backgroundColor,
    this.subtitleColor,
    this.sizeClass,
  });

  /// The class a header part renders at: [explicit], else the enclosing
  /// header's, else the screen's.
  static ScreenSizeClass sizeClassOf(
    BuildContext context, [
    ScreenSizeClass? explicit,
  ]) =>
      explicit ??
      context
          .dependOnInheritedWidgetOfExactType<_PageHeaderScope>()
          ?.sizeClass ??
      locator<ScreenService>().sizeClass;

  @override
  Widget build(BuildContext context) {
    final resolvedClass = sizeClassOf(context, sizeClass);
    final metrics = PageHeaderMetrics.of(resolvedClass);
    final neutrals = Theme.of(context).neutrals;
    final isLandscape = (MediaQuery.maybeOrientationOf(context) ??
            locator<ScreenService>().orientation) ==
        Orientation.landscape;
    final gap = AppSpacings.scale(PageHeaderMetrics.gap);
    final padding = AppSpacings.scale(metrics.padding);
    final leadingWidget = _buildLeading(context, gap);

    return _PageHeaderScope(
      sizeClass: resolvedClass,
      child: Container(
        // The spec's 36/40/48 is the row (header buttons are 36 at every
        // class); the page padding sits around it.
        padding: EdgeInsets.all(padding),
        decoration: BoxDecoration(
          color: backgroundColor ?? neutrals.surfacePage,
          border: borderColor != null
              ? Border(
                  bottom: BorderSide(
                    color: borderColor!,
                    width: AppSpacings.scale(1),
                  ),
                )
              : null,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: AppSpacings.scale(metrics.height),
          ),
          child: Row(
            children: [
              if (leadingWidget != null) ...[
                leadingWidget,
                SizedBox(width: gap),
              ],
              Expanded(child: _buildTitle(metrics, neutrals)),
              if (trailing != null) ...[
                SizedBox(width: gap),
                trailing!,
              ],
              if (landscapeAction != null && isLandscape) landscapeAction!,
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTitle(PageHeaderMetrics metrics, AppNeutralPalette neutrals) {
    final stateColor = subtitleColor ?? neutrals.textSecondary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          title,
          style: TextStyle(
            color: neutrals.textPrimary,
            fontSize: metrics.titleFontSize,
            fontWeight: FontWeight.w500,
            height: 1.15,
          ),
          overflow: TextOverflow.ellipsis,
          maxLines: 1,
        ),
        if (subtitle != null) ...[
          SizedBox(height: AppSpacings.scale(1)),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (subtitleIcon != null) ...[
                Icon(
                  subtitleIcon,
                  size: AppSpacings.scale(PageHeaderMetrics.stateIconSize),
                  color: stateColor,
                ),
                SizedBox(width: AppSpacings.pSm),
              ],
              Flexible(
                child: Text(
                  subtitle!,
                  style: TextStyle(
                    color: stateColor,
                    fontSize: metrics.stateFontSize,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget? _buildLeading(BuildContext context, double gap) {
    if (leading != null) {
      return leading!;
    }

    final tile = icon != null ? HeaderMainIcon(icon: icon!, color: iconColor) : null;

    if (onBack != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        spacing: gap,
        children: [
          HeaderBackButton(onTap: onBack),
          if (tile != null) tile,
        ],
      );
    }

    return tile;
  }
}

/// A 36 design px square header action.
///
/// [color] sets its state: [ThemeColors.neutral] is the plain action (card
/// surface, light outline); any other colour is the active state, tinted with
/// that colour ([ThemeColors.primary] takes the panel accent). Without
/// [onTap] it is disabled.
class HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  /// The button's state colour; see the class comment.
  final ThemeColors color;

  /// Read by screen readers; the icon alone says nothing.
  final String? semanticLabel;

  const HeaderIconButton({
    super.key,
    required this.icon,
    this.onTap,
    this.color = ThemeColors.neutral,
    this.semanticLabel,
  });

  /// Background, outline and icon colour for [color] in [theme].
  static ({Color background, Color border, Color foreground}) colorsFor(
    ThemeData theme,
    ThemeColors color, {
    required bool enabled,
  }) {
    final neutrals = theme.neutrals;

    if (!enabled) {
      return (
        background: neutrals.fillLight,
        border: neutrals.borderLight,
        foreground: neutrals.textDisabled,
      );
    }

    if (color == ThemeColors.neutral) {
      return (
        background: neutrals.surfaceCard,
        border: neutrals.borderLight,
        foreground: neutrals.textPrimary,
      );
    }

    // Primary header buttons follow the panel accent.
    if (color == ThemeColors.primary) {
      final accent = theme.accent;

      return (
        background: accent.soft,
        border: accent.text,
        foreground: accent.text,
      );
    }

    final family = ThemeColorFamily.get(theme.brightness, color);

    return (
      background: family.soft,
      border: family.base,
      foreground: family.base,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = colorsFor(
      Theme.of(context),
      color,
      enabled: onTap != null,
    );
    final size = AppSpacings.scale(PageHeaderMetrics.buttonSize);
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
      side: BorderSide(color: colors.border, width: AppSpacings.scale(1)),
    );

    return Semantics(
      button: true,
      enabled: onTap != null,
      selected: onTap != null && color != ThemeColors.neutral,
      label: semanticLabel,
      // The label replaces the InkWell's semantics, so the tap moves up here.
      onTap: semanticLabel != null ? onTap : null,
      excludeSemantics: semanticLabel != null,
      child: SizedBox.square(
        dimension: size,
        child: Material(
          color: colors.background,
          shape: shape,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            customBorder: shape,
            child: Center(
              child: Icon(
                icon,
                size: AppSpacings.scale(PageHeaderMetrics.buttonIconSize),
                color: colors.foreground,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The back button of a pushed page: a [HeaderIconButton] with a chevron.
///
/// Without [onTap] it pops the current route.
class HeaderBackButton extends StatelessWidget {
  final VoidCallback? onTap;

  const HeaderBackButton({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    return HeaderIconButton(
      icon: MdiIcons.chevronLeft,
      onTap: onTap ?? () => Navigator.maybePop(context),
      semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
    );
  }
}

/// The header's icon tile: the icon on its colour's tint, 28, 32 or 40 design
/// px by class.
class HeaderMainIcon extends StatelessWidget {
  final IconData icon;
  final ThemeColors color;

  /// The class to render at; defaults to the enclosing header's.
  final ScreenSizeClass? sizeClass;

  const HeaderMainIcon({
    super.key,
    required this.icon,
    this.color = ThemeColors.primary,
    this.sizeClass,
  });

  @override
  Widget build(BuildContext context) {
    final family = ThemeColorFamily.get(Theme.of(context).brightness, color);
    final metrics = PageHeaderMetrics.of(
      PageHeader.sizeClassOf(context, sizeClass),
    );
    final side = AppSpacings.scale(metrics.iconTile);

    return Container(
      width: side,
      height: side,
      decoration: BoxDecoration(
        color: family.soft,
        borderRadius: BorderRadius.circular(AppBorderRadius.inner),
      ),
      child: Icon(
        icon,
        color: family.base,
        size: AppSpacings.scale(metrics.iconSize),
      ),
    );
  }
}

/// Home button for navigation back to home.
class HeaderHomeButton extends StatelessWidget {
  final VoidCallback? onTap;

  const HeaderHomeButton({
    super.key,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return HeaderIconButton(icon: MdiIcons.homeOutline, onTap: onTap);
  }
}
