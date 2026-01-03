import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/weather_data_field.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class WeatherForecastDayDataSourceModel extends DataSourceModel {
  final String? _locationId;
  final int _dayOffset;
  final WeatherDataField _field;
  final IconData? _icon;
  final String? _unit;

  WeatherForecastDayDataSourceModel({
    String? locationId,
    required int dayOffset,
    required WeatherDataField field,
    IconData? icon,
    String? unit,
    required super.id,
    required super.parentType,
    required super.parentId,
    super.createdAt,
    super.updatedAt,
  })  : _locationId =
            locationId != null ? UuidUtils.validateUuid(locationId) : null,
        _dayOffset = dayOffset,
        _field = field,
        _icon = icon,
        _unit = unit,
        super(
          type: DataSourceType.weatherForecastDay,
        );

  String? get locationId => _locationId;

  int get dayOffset => _dayOffset;

  WeatherDataField get field => _field;

  IconData? get icon => _icon;

  String? get unit => _unit;

  factory WeatherForecastDayDataSourceModel.fromJson(Map<String, dynamic> json) {
    return WeatherForecastDayDataSourceModel(
      id: UuidUtils.validateUuid(json['id']),
      parentType: json['parent']['type'],
      parentId: UuidUtils.validateUuid(json['parent']['id']),
      locationId: json['location_id'],
      dayOffset: json['day_offset'] ?? 1,
      field: WeatherDataField.fromValue(json['field']) ??
          WeatherDataField.temperatureMax,
      icon: json['icon'] != null && json['icon'] is String
          ? MdiIcons.fromString(json['icon'])
          : null,
      unit: json['unit'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
