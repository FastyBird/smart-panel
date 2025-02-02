import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/overlay/power_off.dart';
import 'package:fastybird_smart_panel/features/overlay/reboot.dart';
import 'package:fastybird_smart_panel/features/overlay/reset.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class MaintenancePage extends StatelessWidget {
  final ScreenScalerService _scaler = locator<ScreenScalerService>();

  MaintenancePage({super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: ScreenAppBar(
        title: localizations.settings_maintenance_title,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ListTile(
                contentPadding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                ),
                dense: true,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  side: BorderSide(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppBorderColorLight.base
                        : AppBorderColorDark.base,
                    width: _scaler.scale(1),
                  ),
                ),
                textColor: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
                leading: Icon(
                  Icons.restart_alt,
                  size: AppFontSize.large,
                ),
                title: Text(
                  localizations.settings_maintenance_restart_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  localizations.settings_maintenance_restart_description,
                  style: TextStyle(
                    fontSize: _scaler.scale(8),
                  ),
                ),
                trailing: Theme(
                  data: ThemeData(
                    outlinedButtonTheme:
                        Theme.of(context).brightness == Brightness.light
                            ? AppOutlinedButtonsLightThemes.primary
                            : AppOutlinedButtonsDarkThemes.primary,
                  ),
                  child: OutlinedButton(
                    onPressed: () {
                      _showConfirmationDialog(
                        context: context,
                        title: localizations
                            .settings_maintenance_restart_confirm_title,
                        content: localizations
                            .settings_maintenance_restart_confirm_description,
                        onConfirm: () {
                          Navigator.of(context, rootNavigator: true).push(
                            MaterialPageRoute(
                              builder: (context) => const RebootScreen(),
                              settings: RouteSettings(
                                name: 'reboot',
                              ),
                            ),
                          );
                        },
                      );
                    },
                    style: OutlinedButton.styleFrom(
                      padding: AppSpacings.paddingSm,
                    ),
                    child: Icon(Icons.restart_alt),
                  ),
                ),
              ),
              AppSpacings.spacingMdVertical,
              ListTile(
                contentPadding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                ),
                dense: true,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  side: BorderSide(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppBorderColorLight.base
                        : AppBorderColorDark.base,
                    width: _scaler.scale(1),
                  ),
                ),
                textColor: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
                leading: Icon(
                  Icons.power_settings_new,
                  size: AppFontSize.large,
                ),
                title: Text(
                  localizations.settings_maintenance_power_off_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  localizations.settings_maintenance_power_off_description,
                  style: TextStyle(
                    fontSize: _scaler.scale(8),
                  ),
                ),
                trailing: Theme(
                  data: ThemeData(
                    outlinedButtonTheme:
                        Theme.of(context).brightness == Brightness.light
                            ? AppOutlinedButtonsLightThemes.primary
                            : AppOutlinedButtonsDarkThemes.primary,
                  ),
                  child: OutlinedButton(
                    onPressed: () {
                      _showConfirmationDialog(
                        context: context,
                        title: localizations
                            .settings_maintenance_power_off_confirm_title,
                        content: localizations
                            .settings_maintenance_power_off_confirm_description,
                        onConfirm: () {
                          Navigator.of(context, rootNavigator: true).push(
                            MaterialPageRoute(
                              builder: (context) => const PowerOffScreen(),
                              settings: RouteSettings(
                                name: 'power_off',
                              ),
                            ),
                          );
                        },
                      );
                    },
                    style: OutlinedButton.styleFrom(
                      padding: AppSpacings.paddingSm,
                    ),
                    child: Icon(Icons.power_settings_new),
                  ),
                ),
              ),
              AppSpacings.spacingMdVertical,
              ListTile(
                contentPadding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                ),
                dense: true,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  side: BorderSide(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppBorderColorLight.base
                        : AppBorderColorDark.base,
                    width: _scaler.scale(1),
                  ),
                ),
                textColor: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
                leading: Icon(
                  Icons.cleaning_services_rounded,
                  size: AppFontSize.large,
                ),
                title: Text(
                  localizations.settings_maintenance_factory_reset_title,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  localizations.settings_maintenance_factory_reset_description,
                  style: TextStyle(
                    fontSize: _scaler.scale(8),
                  ),
                ),
                trailing: Theme(
                  data: ThemeData(
                    outlinedButtonTheme:
                        Theme.of(context).brightness == Brightness.light
                            ? AppOutlinedButtonsLightThemes.primary
                            : AppOutlinedButtonsDarkThemes.primary,
                  ),
                  child: OutlinedButton(
                    onPressed: () {
                      _showConfirmationDialog(
                        context: context,
                        title: localizations
                            .settings_maintenance_factory_reset_confirm_title,
                        content: localizations
                            .settings_maintenance_factory_reset_confirm_description,
                        onConfirm: () {
                          Navigator.of(context, rootNavigator: true).push(
                            MaterialPageRoute(
                              builder: (context) => const ResetScreen(),
                              settings: RouteSettings(
                                name: 'reset',
                              ),
                            ),
                          );
                        },
                      );
                    },
                    style: OutlinedButton.styleFrom(
                      padding: AppSpacings.paddingSm,
                    ),
                    child: Icon(Icons.cleaning_services_rounded),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showConfirmationDialog({
    required BuildContext context,
    required String title,
    required String content,
    required VoidCallback onConfirm,
  }) {
    final localizations = AppLocalizations.of(context)!;

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(title),
          content: Text(
            content,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
            ),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(localizations.button_cancel),
            ),
            Theme(
              data: ThemeData(
                filledButtonTheme:
                    Theme.of(context).brightness == Brightness.light
                        ? AppFilledButtonsLightThemes.primary
                        : AppFilledButtonsDarkThemes.primary,
              ),
              child: FilledButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  onConfirm();
                },
                style: OutlinedButton.styleFrom(
                  padding: EdgeInsets.symmetric(
                    vertical: AppSpacings.pSm,
                    horizontal: AppSpacings.pMd,
                  ),
                ),
                child: Text(localizations.button_confirm.toUpperCase()),
              ),
            ),
          ],
        );
      },
    );
  }
}
