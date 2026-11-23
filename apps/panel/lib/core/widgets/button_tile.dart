import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Colours of a dashboard tile (docs/display-ui-design-spec.md §5): the
/// shared tile colours, with a disabled look on `fill.light` for tiles that
/// cannot act.
UniversalTileColors _buttonTileColors(
  ThemeData theme, {
  required bool isOn,
  required bool isDisabled,
  bool isOffline = false,
  ThemeColors? activeColor,
}) {
  if (isDisabled && !isOffline) {
    final neutrals = theme.neutrals;

    return UniversalTileColors(
      background: neutrals.fillLight,
      border: neutrals.borderLight,
      iconBackground: neutrals.fillLight,
      icon: neutrals.textDisabled,
      text: neutrals.textDisabled,
      status: neutrals.textDisabled,
      badge: theme.status(AppStatus.warning).text,
      selection: neutrals.textDisabled,
    );
  }

  return UniversalTile.tileColors(
    theme,
    activeColor: activeColor,
    isActive: isOn,
    isOffline: isOffline,
  );
}

/// Container box for button tiles: `surface.card` with a `border.light`
/// outline, the soft tint of [activeColor] while on, radius 8, no shadow.
/// Its padding follows the cell: 4 under 60 design px, 8 under 90, else 12.
class ButtonTileBox extends StatelessWidget {
  final GestureTapCallback? onTap;
  final bool isOn;
  final bool isDisabled;
  final bool isOffline;

  /// The domain colour while on; `primary` (the default) is the accent.
  final ThemeColors? activeColor;
  final Widget child;

  const ButtonTileBox({
    super.key,
    required this.onTap,
    required this.isOn,
    this.isDisabled = false,
    this.isOffline = false,
    this.activeColor,
    required this.child,
  });

  /// Padding for a tile whose short side is [shortSide] design px.
  static double paddingFor(double shortSide) =>
      shortSide < 60 ? 4 : (shortSide < 90 ? 8 : 12);

  @override
  Widget build(BuildContext context) {
    final colors = _buttonTileColors(
      Theme.of(context),
      isOn: isOn,
      isDisabled: isDisabled,
      isOffline: isOffline,
      activeColor: activeColor,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final shortSide = AppSpacings.unscale(
          constraints.biggest.shortestSide.isFinite
              ? constraints.biggest.shortestSide
              : AppSpacings.scale(90),
        );

        return Container(
          constraints: const BoxConstraints.expand(),
          decoration: BoxDecoration(
            color: colors.background,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            border: Border.all(
              color: colors.border,
              width: AppSpacings.scale(1),
            ),
          ),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: isDisabled ? null : onTap,
            child: Stack(
              children: [
                Positioned.fill(
                  child: Padding(
                    padding: EdgeInsets.all(
                      AppSpacings.scale(paddingFor(shortSide)),
                    ),
                    child: child,
                  ),
                ),
                if (isOffline)
                  Positioned(
                    top: AppSpacings.pSm,
                    right: AppSpacings.pSm,
                    child: Icon(
                      MdiIcons.alert,
                      size: AppSpacings.scale(UniversalTile.badgeSize),
                      color: colors.badge,
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Title text widget for button tiles: 12/500 in `text.primary` (10 when
/// [small]).
class ButtonTileTitle extends StatelessWidget {
  final String title;
  final bool isOn;
  final bool isLoading;
  final bool isDisabled;
  final bool small;

  const ButtonTileTitle({
    super.key,
    required this.title,
    required this.isOn,
    this.isLoading = false,
    this.isDisabled = false,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = _buttonTileColors(
      Theme.of(context),
      isOn: isOn,
      isDisabled: isDisabled,
    );

    return Text(
      title,
      overflow: TextOverflow.ellipsis,
      maxLines: 1,
      style: TextStyle(
        color: colors.text,
        fontSize: small ? AppFontSize.extraSmall : AppFontSize.small,
        fontWeight: FontWeight.w500,
      ),
    );
  }
}

/// Subtitle widget for button tiles (supports custom widget content):
/// 10 px in `text.secondary`, the warning colour while offline.
class ButtonTileSubTitle extends StatelessWidget {
  final Widget? subTitle;
  final bool isOn;
  final bool isLoading;
  final bool isDisabled;
  final bool isOffline;

  const ButtonTileSubTitle({
    super.key,
    required this.subTitle,
    required this.isOn,
    this.isLoading = false,
    this.isDisabled = false,
    this.isOffline = false,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final colors = _buttonTileColors(
      Theme.of(context),
      isOn: isOn,
      isDisabled: isDisabled,
      isOffline: isOffline,
    );

    // Merge, so the theme's font family carries through.
    return DefaultTextStyle.merge(
      style: TextStyle(
        color: colors.status,
        overflow: TextOverflow.ellipsis,
        fontSize: AppFontSize.extraSmall,
      ),
      child: IconTheme.merge(
        data: IconThemeData(size: AppFontSize.extraSmall, color: colors.status),
        child: subTitle ?? Text(localizations.value_not_available),
      ),
    );
  }
}

/// Composite button tile widget with automatic layout based on dimensions:
/// a 1 × 1 tile is the icon alone, a square tile stacks icon, name and state,
/// a wide tile puts the icon beside them.
///
/// The icon toggles the device; the rest of the tile opens it. Offline the
/// tile is one zone that opens the device.
class ButtonTileWidget extends StatelessWidget {
  final GestureTapCallback? onTap;
  final GestureTapCallback? onIconTap;
  final String title;
  final Widget? subTitle;
  final IconData? icon;
  final bool isOn;
  final bool isLoading;
  final bool isDisabled;
  final bool isOffline;

  /// The domain colour while on; `primary` (the default) is the accent.
  final ThemeColors? activeColor;
  final int rowSpan;
  final int colSpan;

  const ButtonTileWidget({
    super.key,
    required this.onTap,
    required this.onIconTap,
    required this.title,
    required this.subTitle,
    this.icon,
    required this.isOn,
    this.isLoading = false,
    this.isDisabled = false,
    this.isOffline = false,
    this.activeColor,
    this.rowSpan = 1,
    this.colSpan = 1,
  });

  @override
  Widget build(BuildContext context) {
    final isSquare = rowSpan == colSpan;
    final isButton = rowSpan == 1 && colSpan == 1;

    final iconWidget = ButtonTileIcon(
      icon: icon,
      onTap: isOffline ? null : onIconTap,
      isOn: isOn,
      isLoading: isLoading,
      isDisabled: isDisabled,
      isOffline: isOffline,
      activeColor: activeColor,
    );

    final texts = [
      ButtonTileTitle(
        title: title,
        isOn: isOn,
        isLoading: isLoading,
        isDisabled: isDisabled,
      ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: ButtonTileSubTitle(
          subTitle: subTitle,
          isOn: isOn,
          isLoading: isLoading,
          isDisabled: isDisabled,
          isOffline: isOffline,
        ),
      ),
    ];

    return ButtonTileBox(
      onTap: onTap,
      isOn: isOn,
      isDisabled: isDisabled,
      isOffline: isOffline,
      activeColor: activeColor,
      child: isSquare
          ? Column(
              mainAxisAlignment: MainAxisAlignment.center,
              spacing: AppSpacings.pSm,
              children: [
                iconWidget,
                if (!isButton)
                  Column(spacing: AppSpacings.scale(1), children: texts),
              ],
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              spacing: AppSpacings.pMd,
              children: [
                iconWidget,
                if (!isButton)
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: AppSpacings.scale(1),
                      children: texts,
                    ),
                  ),
              ],
            ),
    );
  }
}

/// The tile's icon: the domain colour while on, `text.secondary` while off,
/// `text.disabled` while disabled or offline. Its tap zone is never under
/// 36 design px.
class ButtonTileIcon extends StatelessWidget {
  final IconData? icon;
  final GestureTapCallback? onTap;
  final bool isOn;
  final bool isLoading;
  final bool isDisabled;
  final bool isOffline;

  /// The domain colour while on; `primary` (the default) is the accent.
  final ThemeColors? activeColor;

  /// Tap zone in design px; defaults to 40.
  final double? iconSize;

  /// Tap zone in logical px, already scaled.
  final double? rawIconSize;
  final Color? iconColor;
  final bool showAlert;
  final IconData? alertIcon;
  final Color? alertColor;

  const ButtonTileIcon({
    super.key,
    this.icon,
    required this.onTap,
    required this.isOn,
    this.isLoading = false,
    this.isDisabled = false,
    this.isOffline = false,
    this.activeColor,
    this.iconSize,
    this.rawIconSize,
    this.iconColor,
    this.showAlert = false,
    this.alertIcon,
    this.alertColor,
  });

  /// The smallest tap zone, in design px.
  static const double minTapZone = 36;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = _buttonTileColors(
      theme,
      isOn: isOn,
      isDisabled: isDisabled,
      isOffline: isOffline,
      activeColor: activeColor,
    );
    final zone = rawIconSize ?? AppSpacings.scale(iconSize ?? 40);
    final glyphSize = zone * 0.6;
    final tapZone = zone < AppSpacings.scale(minTapZone)
        ? AppSpacings.scale(minTapZone)
        : zone;
    final color = iconColor ?? colors.icon;

    final glyph = isLoading
        ? SizedBox.square(
            dimension: glyphSize,
            child: CircularProgressIndicator(
              strokeWidth: AppSpacings.scale(2),
              color: color,
            ),
          )
        : Icon(icon, size: glyphSize, color: color);

    // An InkWell, so the toggle takes focus and Enter / Space like a button.
    final iconButton = SizedBox.square(
      dimension: tapZone,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: isDisabled ? null : onTap,
          customBorder: const CircleBorder(),
          child: Center(child: glyph),
        ),
      ),
    );

    if (!showAlert) {
      return iconButton;
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        iconButton,
        Positioned(
          right: 0,
          bottom: 0,
          child: Icon(
            alertIcon ?? MdiIcons.alert,
            size: AppSpacings.scale(UniversalTile.badgeSize),
            color: alertColor ?? theme.status(AppStatus.warning).text,
          ),
        ),
      ],
    );
  }
}
