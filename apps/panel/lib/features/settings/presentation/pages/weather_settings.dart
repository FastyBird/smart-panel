import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/weather_configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/types/weather.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class WeatherSettingsPage extends StatefulWidget {
  const WeatherSettingsPage({super.key});

  @override
  State<WeatherSettingsPage> createState() => _WeatherSettingsPageState();
}

class _WeatherSettingsPageState extends State<WeatherSettingsPage> {
  final ScreenScalerService _scaler = locator<ScreenScalerService>();
  final ConfigurationRepository _configurationRepository =
      locator<ConfigurationRepository>();

  late bool _isDarkMode;

  @override
  void initState() {
    super.initState();

    _isDarkMode = _configurationRepository.displayConfiguration.hasDarkMode;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return AnimatedTheme(
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeInOut,
      data: _isDarkMode ? AppTheme.darkTheme : AppTheme.lightTheme,
      child: Scaffold(
        appBar: ScreenAppBar(
          title: localizations.settings_weather_settings_title,
        ),
        body: Consumer<ConfigurationRepository>(builder: (
          context,
          configurationRepository,
          _,
        ) {
          WeatherConfigurationModel configuration =
              configurationRepository.weatherConfiguration;

          return SingleChildScrollView(
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
                      Icons.thermostat,
                      size: AppFontSize.large,
                    ),
                    title: Text(
                      localizations
                          .settings_weather_settings_temperature_unit_title,
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      localizations
                          .settings_weather_settings_temperature_unit_description,
                      style: TextStyle(
                        fontSize: _scaler.scale(8),
                      ),
                    ),
                    trailing: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: configuration.unit.value,
                        items: {
                          UnitType.celsius.value: localizations.unit_celsius,
                          UnitType.fahrenheit.value:
                              localizations.unit_fahrenheit,
                        }.entries.map((entry) {
                          return DropdownMenuItem<String>(
                            value: entry.key,
                            child: Text(
                              entry.value,
                              style: TextStyle(
                                fontSize: AppFontSize.extraSmall,
                              ),
                            ),
                          );
                        }).toList(),
                        onChanged: (String? value) {
                          if (value != null) {
                            UnitType? setUnit = UnitType.fromValue(value);

                            if (setUnit != null) {
                              configurationRepository.setWeatherUnit(setUnit);
                            }
                          }
                        },
                        style: TextStyle(
                          fontSize: AppFontSize.extraSmall,
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.regular
                                  : AppTextColorDark.regular,
                        ),
                        borderRadius:
                            BorderRadius.circular(AppBorderRadius.base),
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
                      Icons.place,
                      size: AppFontSize.large,
                    ),
                    title: Text(
                      localizations
                          .settings_weather_settings_temperature_location_title,
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      localizations
                          .settings_weather_settings_temperature_location_description,
                      style: TextStyle(
                        fontSize: _scaler.scale(8),
                      ),
                    ),
                    trailing: Tooltip(
                      message:
                          configuration.location ?? localizations.value_not_set,
                      child: Text(
                        configuration.location ?? localizations.value_not_set,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                        style: TextStyle(
                          color: AppTextColorLight.placeholder,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}
