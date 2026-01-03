import 'package:fastybird_smart_panel/plugins/data-sources-weather/presentation/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/presentation/weather_forecast_day.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/views/weather_current.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/views/weather_forecast_day.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

Map<DataSourceType, Widget Function(DataSourceView)>
    weatherDataSourceWidgetMappers = {
  DataSourceType.weatherCurrent: (dataSource) {
    return WeatherCurrentDataSourceWidget(
      dataSource as WeatherCurrentDataSourceView,
    );
  },
  DataSourceType.weatherForecastDay: (dataSource) {
    return WeatherForecastDayDataSourceWidget(
      dataSource as WeatherForecastDayDataSourceView,
    );
  },
};
