import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/setting_row.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/weather/models/location.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class WeatherSettingsPage extends StatefulWidget {
  const WeatherSettingsPage({super.key});

  @override
  State<WeatherSettingsPage> createState() => _WeatherSettingsPageState();
}

class _WeatherSettingsPageState extends State<WeatherSettingsPage> {
  final WeatherService _weatherService = locator<WeatherService>();

  String? _selectedLocationId;
  List<WeatherLocationModel> _locations = [];

  @override
  void initState() {
    super.initState();

    _syncLocations();

    _weatherService.addListener(_syncLocations);
  }

  @override
  void dispose() {
    _weatherService.removeListener(_syncLocations);

    super.dispose();
  }

  void _syncLocations() {
    setState(() {
      _locations = _weatherService.locations;
      _selectedLocationId = _weatherService.selectedLocationId;
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
                    fontSize: AppSpacings.scale(8),
                  ),
                ),
                trailing: _locations.length > 1
                    ? DropdownButtonHideUnderline(
                        child: DropdownButton2<String>(
                          isExpanded: false,
                          isDense: true,
                          items: _getLocationItems(),
                          value: _selectedLocationId,
                          onChanged: (String? value) {
                            _handleLocationChange(value);
                          },
                          selectedItemBuilder: (BuildContext context) {
                            return _locations.map<Widget>((location) {
                              return Container(
                                alignment: Alignment.centerRight,
                                width: AppSpacings.scale(80),
                                child: Text(
                                  location.name,
                                  textAlign: TextAlign.end,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: AppFontSize.extraSmall,
                                  ),
                                ),
                              );
                            }).toList();
                          },
                          menuItemStyleData: MenuItemStyleData(
                            padding: EdgeInsets.symmetric(
                              vertical: 0,
                              horizontal: AppSpacings.pLg,
                            ),
                            height: AppSpacings.scale(35),
                          ),
                          dropdownStyleData: DropdownStyleData(
                            padding: EdgeInsets.all(0),
                            maxHeight: AppSpacings.scale(250),
                          ),
                          iconStyleData: IconStyleData(
                            openMenuIcon: Icon(MdiIcons.menuUp),
                          ),
                        ),
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<DropdownMenuItem<String>> _getLocationItems() {
    return _locations.map((location) {
      return DropdownMenuItem<String>(
        value: location.id,
        child: Text(
          location.name,
          style: TextStyle(fontSize: AppFontSize.extraSmall),
        ),
      );
    }).toList();
  }

  void _handleLocationChange(String? locationId) {
    if (locationId == null) return;

    HapticFeedback.lightImpact();

    _weatherService.selectLocation(locationId);
  }
}
