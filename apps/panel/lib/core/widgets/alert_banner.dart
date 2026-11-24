import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The alert banner's sizes (design canvas, "Navigation and overlays").
class AlertBannerMetrics {
  AlertBannerMetrics._();

  /// The banner's height; a wrapped message makes it taller.
  static double heightFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 28,
    ScreenSizeClass.regular => 32,
    ScreenSizeClass.expanded => 40,
  };

  /// The message: 12, 14 on Expanded.
  static double textFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.expanded ? 14 : 12;

  static const double icon = 14;
  static const double gap = 6;
  static const double paddingSide = 10;

  /// The action's touch zone.
  static const double action = 36;
}

/// The status an alert banner in [color] shows. Status colours never come
/// from a domain (spec §2), so a domain colour maps to its nearest status:
/// red to danger, amber to warning, green to ok and the rest to info.
AppStatus alertBannerStatus(ThemeColors color) => switch (color) {
  ThemeColors.danger || ThemeColors.error => AppStatus.danger,
  ThemeColors.warning || ThemeColors.lights => AppStatus.warning,
  ThemeColors.success || ThemeColors.energy => AppStatus.ok,
  _ => AppStatus.info,
};

/// The alert banner (docs/display-ui-design-spec.md §5): the status fill with
/// white text, an icon and the message, radius 8, 28 / 32 / 40 high. An
/// optional [title] leads the message in bold; with [onTap] a "View" action
/// ends the banner. Screen readers hear it as it appears.
///
/// ```dart
/// AlertBanner(
///   title: 'High temperature',
///   text: 'Living room sensor exceeded threshold',
///   color: ThemeColors.danger,
///   onTap: () => openDetail(),
/// )
/// ```
class AlertBanner extends StatelessWidget {
  /// Optional title, shown in bold before [text].
  final String? title;

  /// Required body text.
  final String text;

  /// When non-null, a "View" action is shown that calls this callback.
  final VoidCallback? onTap;

  /// The banner's status, as a colour (see [alertBannerStatus]).
  final ThemeColors color;

  /// Optional icon. Defaults to [MdiIcons.alertOutline].
  final IconData? icon;

  /// The class to size the banner for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  const AlertBanner({
    super.key,
    this.title,
    required this.text,
    this.onTap,
    required this.color,
    this.icon,
    this.sizeClass,
  });

  @override
  Widget build(BuildContext context) {
    final status = Theme.of(context).status(alertBannerStatus(color));
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final fontSize = AppSpacings.scale(
      AlertBannerMetrics.textFor(resolvedClass),
    );
    final hasTitle = title != null && title!.isNotEmpty;
    const foreground = AppColors.white;

    final message = Text.rich(
      TextSpan(
        children: [
          if (hasTitle)
            TextSpan(
              text: '${title!}  ',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          TextSpan(text: text),
        ],
      ),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: foreground,
        fontSize: fontSize,
        fontWeight: FontWeight.w500,
        height: 1.25,
      ),
    );

    return Semantics(
      container: true,
      liveRegion: true,
      child: Material(
        color: status.fill,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: AppSpacings.scale(
              AlertBannerMetrics.heightFor(resolvedClass),
            ),
          ),
          child: Padding(
            padding: EdgeInsetsDirectional.only(
              start: AppSpacings.scale(AlertBannerMetrics.paddingSide),
              end: onTap != null
                  ? 0
                  : AppSpacings.scale(AlertBannerMetrics.paddingSide),
            ),
            child: Row(
              spacing: AppSpacings.scale(AlertBannerMetrics.gap),
              children: [
                Icon(
                  icon ?? MdiIcons.alertOutline,
                  color: foreground,
                  size: AppSpacings.scale(AlertBannerMetrics.icon),
                ),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
                    child: message,
                  ),
                ),
                if (onTap != null)
                  Semantics(
                    button: true,
                    child: InkWell(
                      onTap: onTap,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          minHeight: AppSpacings.scale(
                            AlertBannerMetrics.action,
                          ),
                          minWidth: AppSpacings.scale(
                            AlertBannerMetrics.action,
                          ),
                        ),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: AppSpacings.scale(
                              AlertBannerMetrics.paddingSide,
                            ),
                          ),
                          child: Center(
                            widthFactor: 1,
                            child: Text(
                              AppLocalizations.of(
                                context,
                              )!.alert_banner_view_button,
                              style: TextStyle(
                                color: foreground,
                                fontSize: fontSize,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
