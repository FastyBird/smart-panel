import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/setting_row.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/export.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_symbols_icons/symbols.dart';

class WeatherSettingsPage extends StatefulWidget {
  const WeatherSettingsPage({super.key});

  @override
  State<WeatherSettingsPage> createState() => _WeatherSettingsPageState();
}

class _WeatherSettingsPageState extends State<WeatherSettingsPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final WeatherConfigRepository _repository =
      locator<WeatherConfigRepository>();

  late WeatherUnit _unit;
  late String? _location;

  @override
  void initState() {
    super.initState();

    _syncStateWithRepository();

    _repository.addListener(_syncStateWithRepository);
  }

  @override
  void dispose() {
    super.dispose();

    _repository.removeListener(_syncStateWithRepository);
  }

  void _syncStateWithRepository() {
    setState(() {
      _unit = _repository.unit;
      _location = _repository.location;
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: ScreenAppBar(
        title: localizations.settings_weather_settings_title,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SettingRow(
                icon: Symbols.device_thermostat,
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
                    fontSize: _screenService.scale(8),
                  ),
                ),
                trailing: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _unit.value,
                    items: _getUnitItems(context),
                    onChanged: (String? value) async {
                      _handleWeatherUnitChange(context, value);
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
              SettingRow(
                icon: Symbols.place,
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
      ),
    );
  }

  List<DropdownMenuItem<String>> _getUnitItems(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return {
      WeatherUnit.celsius.value: localizations.unit_celsius,
      WeatherUnit.fahrenheit.value: localizations.unit_fahrenheit,
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
    }).toList();
  }

  Future<void> _handleWeatherUnitChange(
    BuildContext context,
    String? value,
  ) async {
    if (value == null) return;

    final unit = WeatherUnit.fromValue(value);

    if (unit == null) return;

    HapticFeedback.lightImpact();

    final WeatherUnit backup = _unit;

    setState(() {
      _unit = unit;
    });

    final success = await _repository.setWeatherUnit(_unit);

    Future.microtask(
      () async {
        await Future.delayed(
          const Duration(milliseconds: 500),
        );

        if (!context.mounted) return;

        if (!success) {
          setState(() {
            _unit = backup;
          });

          AlertBar.showError(
            context,
            message: 'Save settings failed.',
          );
        }
      },
    );
  }
}
