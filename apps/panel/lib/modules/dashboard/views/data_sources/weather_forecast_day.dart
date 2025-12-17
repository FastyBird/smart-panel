import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/weather_forecast_day_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/weather_data_field.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

class WeatherForecastDayDataSourceView
    extends DataSourceView<WeatherForecastDayDataSourceModel> {
  WeatherForecastDayDataSourceView({
    required super.dataSourceModel,
  });

  String? get locationId => dataSourceModel.locationId;

  int get dayOffset => dataSourceModel.dayOffset;

  WeatherDataField get field => dataSourceModel.field;

  IconData? get icon => dataSourceModel.icon;

  String? get unit => dataSourceModel.unit;
}
