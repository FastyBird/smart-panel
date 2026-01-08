import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/models/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/types/weather_data_field.dart';
import 'package:flutter/material.dart';

class WeatherCurrentDataSourceView extends DataSourceView {
  WeatherCurrentDataSourceView({required WeatherCurrentDataSourceModel model})
      : super(model: model);

  WeatherCurrentDataSourceModel get _typedModel =>
      model as WeatherCurrentDataSourceModel;

  String? get locationId => _typedModel.locationId;

  WeatherDataField get field => _typedModel.field;

  IconData? get icon => _typedModel.icon;

  String? get unit => _typedModel.unit;
}
