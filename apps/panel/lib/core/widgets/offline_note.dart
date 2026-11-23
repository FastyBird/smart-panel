import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The offline line used on tiles, heroes and device details
/// (docs/display-ui-design-spec.md §7): "Offline · last seen 21:10", or
/// "Offline" when the last contact is not known.
String offlineLine(AppLocalizations localizations, String? lastSeenText) =>
    lastSeenText == null
    ? localizations.device_status_offline
    : localizations.device_offline_line(lastSeenText);

/// The one offline note: a 36 design px strip on the warning tint with the
/// wifi-off icon, the offline line and, outside Compact, why the controls do
/// nothing. Device heroes and device details show it above their controls.
class OfflineNote extends StatelessWidget {
  const OfflineNote({super.key, this.lastSeenText, this.sizeClass});

  /// When the device was last heard from, already formatted ("5 min ago").
  final String? lastSeenText;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  static const double height = 36;
  static const double iconSize = 14;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final warning = theme.status(AppStatus.warning);
    final localizations = AppLocalizations.of(context)!;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final isCompact = resolvedClass == ScreenSizeClass.compact;
    final fontSize = resolvedClass == ScreenSizeClass.expanded
        ? AppFontSize.small
        : AppFontSize.extraSmall;

    final paused = isCompact
        ? localizations.device_offline_paused_short
        : localizations.device_offline_paused;

    return Semantics(
      liveRegion: true,
      child: Container(
        constraints: BoxConstraints(minHeight: AppSpacings.scale(height)),
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSm,
        ),
        decoration: BoxDecoration(
          color: warning.soft,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: warning.border,
            width: AppSpacings.scale(1),
          ),
        ),
        child: Row(
          spacing: AppSpacings.pSmMd,
          children: [
            Icon(
              MdiIcons.wifiOff,
              size: AppSpacings.scale(iconSize),
              color: warning.text,
            ),
            Expanded(
              child: Text(
                '${offlineLine(localizations, lastSeenText)}. $paused',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: theme.neutrals.textPrimary,
                  fontSize: fontSize,
                  fontWeight: FontWeight.w500,
                  height: 1.3,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
