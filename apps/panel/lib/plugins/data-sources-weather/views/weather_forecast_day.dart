import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/models/weather_forecast_day.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/types/weather_data_field.dart';
import 'package:flutter/material.dart';

class WeatherForecastDayDataSourceView extends DataSourceView {
  WeatherForecastDayDataSourceView(
      {required WeatherForecastDayDataSourceModel model})
      : super(model: model);

  WeatherForecastDayDataSourceModel get _typedModel =>
      model as WeatherForecastDayDataSourceModel;

  String? get locationId => _typedModel.locationId;

  int get dayOffset => _typedModel.dayOffset;

  WeatherDataField get field => _typedModel.field;

  IconData? get icon => _typedModel.icon;

  String? get unit => _typedModel.unit;
}
