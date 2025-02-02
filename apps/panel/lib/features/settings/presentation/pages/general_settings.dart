import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class GeneralSettingsPage extends StatelessWidget {
  final ScreenScalerService _scaler = locator<ScreenScalerService>();

  GeneralSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    List<SettingsButton> buttons = [
      SettingsButton(
        icon: Icons.display_settings,
        label: localizations.settings_general_settings_button_display_settings,
        route: 'display-settings',
      ),
      SettingsButton(
        icon: Icons.translate,
        label: localizations.settings_general_settings_button_language_settings,
        route: 'language-settings',
      ),
      SettingsButton(
        icon: Icons.volume_up,
        label: localizations.settings_general_settings_button_audio_settings,
        route: 'audio-settings',
      ),
      SettingsButton(
        icon: Icons.sunny,
        label: localizations.settings_general_settings_button_weather_settings,
        route: 'weather-settings',
      ),
      SettingsButton(
        icon: Icons.info,
        label: localizations.settings_general_settings_button_about,
        route: 'about',
      ),
      SettingsButton(
        icon: Icons.engineering,
        label: localizations.settings_general_settings_button_maintenance,
        route: 'maintenance',
      ),
    ];

    return Scaffold(
      appBar: ScreenAppBar(
        title: localizations.settings_general_settings_title,
        icon: Icons.settings,
        actions: [
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pSm,
            ),
            child: Theme(
              data: ThemeData(
                iconButtonTheme:
                    Theme.of(context).brightness == Brightness.light
                        ? AppIconButtonsLightThemes.primary
                        : AppIconButtonsDarkThemes.primary,
              ),
              child: IconButton(
                onPressed: () =>
                    Navigator.of(context, rootNavigator: true).pop(),
                style: IconButton.styleFrom(
                  padding: AppSpacings.paddingSm,
                ),
                icon: Icon(
                  Icons.close,
                  size: _scaler.scale(14),
                ),
              ),
            ),
          ),
        ],
      ),
      body: Padding(
        padding: AppSpacings.paddingLg,
        child: GridView.builder(
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: AppSpacings.pMd,
            mainAxisSpacing: AppSpacings.pMd,
            childAspectRatio: 1, // Ensures a square shape for each button
          ),
          itemCount: buttons.length,
          itemBuilder: (context, index) {
            return OutlinedButton(
              onPressed: () {
                Navigator.of(context).pushNamed(buttons[index].route);
              },
              style: OutlinedButton.styleFrom(
                padding: AppSpacings.paddingSm,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppBorderRadius.medium),
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    buttons[index].icon,
                    size: _scaler.scale(28),
                  ),
                  AppSpacings.spacingMdVertical,
                  SizedBox(
                    height: AppFontSize.small * 2 + AppSpacings.pSm * 2,
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        vertical: 0,
                        horizontal: AppSpacings.pMd,
                      ),
                      child: Text(
                        buttons[index].label,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: AppFontSize.small,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class SettingsButton {
  final IconData icon;
  final String label;
  final String route;

  SettingsButton({
    required this.icon,
    required this.label,
    required this.route,
  });
}
