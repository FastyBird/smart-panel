import 'package:fastybird_smart_panel/plugins/data-sources-weather/types/weather_data_field.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

class WeatherCurrentDataSourceView extends DataSourceView {
  final String? _locationId;
  final WeatherDataField _field;
  final IconData? _icon;
  final String? _unit;

  WeatherCurrentDataSourceView({
    required super.id,
    required super.type,
    required super.parentType,
    required super.parentId,
    String? locationId,
    required WeatherDataField field,
    IconData? icon,
    String? unit,
  })  : _locationId = locationId,
        _field = field,
        _icon = icon,
        _unit = unit;

  String? get locationId => _locationId;

  WeatherDataField get field => _field;

  IconData? get icon => _icon;

  String? get unit => _unit;
}
