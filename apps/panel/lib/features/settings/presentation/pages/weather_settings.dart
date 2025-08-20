import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/setting_row.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/export.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class WeatherSettingsPage extends StatefulWidget {
  const WeatherSettingsPage({super.key});

  @override
  State<WeatherSettingsPage> createState() => _WeatherSettingsPageState();
}

class _WeatherSettingsPageState extends State<WeatherSettingsPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final WeatherConfigRepository _repository =
      locator<WeatherConfigRepository>();

  late WeatherUnit _unit;

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
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppTopBar(title: localizations.settings_weather_settings_title),
      body: SingleChildScrollView(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SettingRow(
                icon: MdiIcons.sunThermometer,
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
                    fontSize: _screenService.scale(
                      8,
                      density: _visualDensityService.density,
                    ),
                  ),
                ),
                trailing: DropdownButtonHideUnderline(
                  child: DropdownButton2<String>(
                    isExpanded: false,
                    isDense: true,
                    items: _getUnitItems(context),
                    value: _unit.value,
                    onChanged: (String? value) async {
                      _handleWeatherUnitChange(context, value);
                    },
                    selectedItemBuilder: (BuildContext context) {
                      return [
                        localizations.unit_celsius,
                        localizations.unit_fahrenheit,
                      ].map<Widget>((String item) {
                        return Container(
                          alignment: Alignment.centerRight,
                          width: _screenService.scale(
                            50,
                            density: _visualDensityService.density,
                          ),
                          child: Text(
                            item,
                            textAlign: TextAlign.end,
                            style: TextStyle(fontSize: AppFontSize.extraSmall),
                          ),
                        );
                      }).toList();
                    },
                    menuItemStyleData: MenuItemStyleData(
                      padding: EdgeInsets.symmetric(
                        vertical: 0,
                        horizontal: AppSpacings.pLg,
                      ),
                      height: _screenService.scale(
                        35,
                        density: _visualDensityService.density,
                      ),
                    ),
                    dropdownStyleData: DropdownStyleData(
                      padding: EdgeInsets.all(0),
                      maxHeight: _screenService.scale(
                        250,
                        density: _visualDensityService.density,
                      ),
                    ),
                    iconStyleData: const IconStyleData(
                      openMenuIcon: Icon(Icons.arrow_drop_up),
                    ),
                  ),
                ),
              ),
              AppSpacings.spacingMdVertical,
              SettingRow(
                icon: MdiIcons.mapMarker,
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
                    fontSize: _screenService.scale(
                      8,
                      density: _visualDensityService.density,
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
          style: TextStyle(fontSize: AppFontSize.extraSmall),
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

    Future.microtask(() async {
      await Future.delayed(const Duration(milliseconds: 500));

      if (!context.mounted) return;

      if (!success) {
        setState(() {
          _unit = backup;
        });

        AlertBar.showError(context, message: 'Save settings failed.');
      }
    });
  }
}
