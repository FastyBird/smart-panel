import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/weather_current_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/weather_data_field.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

class WeatherCurrentDataSourceView
    extends DataSourceView<WeatherCurrentDataSourceModel> {
  WeatherCurrentDataSourceView({
    required super.dataSourceModel,
  });

  String? get locationId => dataSourceModel.locationId;

  WeatherDataField get field => dataSourceModel.field;

  IconData? get icon => dataSourceModel.icon;

  String? get unit => dataSourceModel.unit;
}
