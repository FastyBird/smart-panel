import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/types/weather.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class WeatherSettingsPage extends StatefulWidget {
  const WeatherSettingsPage({super.key});

  @override
  State<WeatherSettingsPage> createState() => _WeatherSettingsPageState();
}

class _WeatherSettingsPageState extends State<WeatherSettingsPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final ConfigurationRepository _configurationRepository =
      locator<ConfigurationRepository>();

  late WeatherUnitType _unit;
  late WeatherUnitType? _unitBackup;
  late bool _savingUnit = false;
  late String? _location;

  @override
  void initState() {
    super.initState();

    _syncStateWithRepository();

    _configurationRepository.addListener(_syncStateWithRepository);
  }

  @override
  void dispose() {
    _configurationRepository.removeListener(_syncStateWithRepository);
    super.dispose();
  }

  void _syncStateWithRepository() {
    setState(() {
      _unit = _configurationRepository.weatherConfiguration.unit;
      _location = _configurationRepository.weatherConfiguration.location;
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

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
                  width: _screenService.scale(1),
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
                localizations.settings_weather_settings_temperature_unit_title,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w600,
                ),
              ),
              subtitle: Text(
                localizations
                    .settings_weather_settings_temperature_unit_description,
                style: TextStyle(
                  fontSize: _screenService.scale(8),
                ),
              ),
              trailing: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _unit.value,
                  items: {
                    WeatherUnitType.celsius.value: localizations.unit_celsius,
                    WeatherUnitType.fahrenheit.value:
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
                  onChanged: (String? value) async {
                    if (value == null) return;

                    final unit = WeatherUnitType.fromValue(value);

                    if (unit == null) return;

                    HapticFeedback.lightImpact();

                    setState(() {
                      _unitBackup = _savingUnit ? _unitBackup : _unit;
                      _savingUnit = true;
                      _unit = unit;
                    });

                    final success =
                        await _configurationRepository.setWeatherUnit(_unit);

                    Future.microtask(() async {
                      await Future.delayed(
                        const Duration(milliseconds: 500),
                      );

                      if (!context.mounted) return;

                      if (success) {
                        setState(() {
                          _unitBackup = null;
                          _savingUnit = false;
                        });
                      } else {
                        setState(() {
                          _unit = _unitBackup ?? _unit;
                          _unitBackup = null;
                          _savingUnit = false;
                        });

                        AlertBar.showError(
                          context,
                          message: 'Save settings failed.',
                        );
                      }
                    });

                    _configurationRepository.setWeatherUnit(
                      WeatherUnitType.fromValue(value) ??
                          WeatherUnitType.celsius,
                    );
                  },
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
                  ),
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
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
                  width: _screenService.scale(1),
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
                  fontSize: _screenService.scale(8),
                ),
              ),
              trailing: Tooltip(
                message: _location ?? localizations.value_not_set,
                child: Text(
                  _location ?? localizations.value_not_set,
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
  }
}
