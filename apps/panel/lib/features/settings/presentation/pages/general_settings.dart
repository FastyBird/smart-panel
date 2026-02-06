import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class GeneralSettingsPage extends StatelessWidget {
  final DisplayRepository _displayRepository = locator<DisplayRepository>();

  GeneralSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final hasAudioSupport = _displayRepository.audioOutputSupported ||
        _displayRepository.audioInputSupported;

    List<SettingsButton> buttons = [
      SettingsButton(
        icon: MdiIcons.monitorDashboard,
        label: localizations.settings_general_settings_button_display_settings,
        route: 'display-settings',
      ),
      SettingsButton(
        icon: MdiIcons.translate,
        label: localizations.settings_general_settings_button_language_settings,
        route: 'language-settings',
      ),
      if (hasAudioSupport)
        SettingsButton(
          icon: MdiIcons.volumeHigh,
          label: localizations.settings_general_settings_button_audio_settings,
          route: 'audio-settings',
        ),
      SettingsButton(
        icon: MdiIcons.weatherPartlyCloudy,
        label: localizations.settings_general_settings_button_weather_settings,
        route: 'weather-settings',
      ),
      SettingsButton(
        icon: MdiIcons.informationOutline,
        label: localizations.settings_general_settings_button_about,
        route: 'about',
      ),
      SettingsButton(
        icon: MdiIcons.wrenchClock,
        label: localizations.settings_general_settings_button_maintenance,
        route: 'maintenance',
      ),
    ];

    return Scaffold(
      appBar: AppTopBar(
        title: localizations.settings_general_settings_title,
        icon: MdiIcons.cog,
        actions: [
          Theme(
            data: ThemeData(
              iconButtonTheme: Theme.of(context).brightness == Brightness.light
                  ? AppIconButtonsLightThemes.primary
                  : AppIconButtonsDarkThemes.primary,
            ),
            child: IconButton(
              onPressed: () => Navigator.of(context, rootNavigator: true).pop(),
              style: IconButton.styleFrom(
                padding: AppSpacings.paddingSm,
              ),
              icon: Icon(
                MdiIcons.close,
                size: AppSpacings.scale(14),
              ),
            ),
          )
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
            return Theme(
              data: ThemeData(
                outlinedButtonTheme:
                    Theme.of(context).brightness == Brightness.light
                        ? AppOutlinedButtonsLightThemes.primary
                        : AppOutlinedButtonsDarkThemes.primary,
              ),
              child: OutlinedButton(
                onPressed: () {
                  Navigator.of(context).pushNamed(buttons[index].route);
                },
                style: OutlinedButton.styleFrom(
                  padding: AppSpacings.paddingSm,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  spacing: AppSpacings.pMd,
                  children: [
                    Icon(
                      buttons[index].icon,
                      size: AppSpacings.scale(28),
                    ),
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
                            fontSize: AppFontSize.extraSmall,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class SettingsButton {
  final IconData _icon;
  final String _label;
  final String _route;

  SettingsButton({
    required IconData icon,
    required String label,
    required String route,
  })  : _icon = icon,
        _label = label,
        _route = route;

  IconData get icon => _icon;

  String get label => _label;

  String get route => _route;
}
