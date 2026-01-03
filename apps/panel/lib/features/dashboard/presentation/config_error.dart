import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Screen shown when display configuration is invalid.
///
/// This is displayed when the display cannot be used due to
/// configuration issues (e.g., Room display without spaceId).
class ConfigErrorScreen extends StatelessWidget {
  final String errorMessage;
  final VoidCallback? onRetry;

  const ConfigErrorScreen({
    super.key,
    required this.errorMessage,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: AppSpacings.paddingLg,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  MdiIcons.cogOff,
                  size: screenService.scale(
                    80,
                    density: visualDensityService.density,
                  ),
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.warning
                      : AppColorsDark.warning,
                ),
                AppSpacings.spacingLgVertical,
                Text(
                  localizations?.config_error_title ?? 'Configuration Required',
                  style: TextStyle(
                    fontSize: AppFontSize.extraLarge,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.primary
                        : AppTextColorDark.primary,
                  ),
                  textAlign: TextAlign.center,
                ),
                AppSpacings.spacingMdVertical,
                Text(
                  errorMessage,
                  style: TextStyle(
                    fontSize: AppFontSize.base,
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
                  ),
                  textAlign: TextAlign.center,
                ),
                AppSpacings.spacingLgVertical,
                Container(
                  padding: AppSpacings.paddingMd,
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.infoLight9
                        : AppColorsDark.infoLight7,
                    borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        MdiIcons.informationOutline,
                        size: screenService.scale(
                          24,
                          density: visualDensityService.density,
                        ),
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppColorsLight.info
                            : AppColorsDark.info,
                      ),
                      AppSpacings.spacingSmHorizontal,
                      Flexible(
                        child: Text(
                          localizations?.config_error_hint ??
                              'Configure this display in Admin > Displays',
                          style: TextStyle(
                            fontSize: AppFontSize.small,
                            color: Theme.of(context).brightness == Brightness.light
                                ? AppColorsLight.infoDark2
                                : AppColorsDark.infoDark2,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (onRetry != null) ...[
                  AppSpacings.spacingLgVertical,
                  FilledButton.icon(
                    onPressed: onRetry,
                    icon: Icon(MdiIcons.refresh),
                    label: Text(localizations?.retry ?? 'Retry'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
