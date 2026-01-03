import 'package:fastybird_smart_panel/plugins/tiles-weather/presentation/forecast.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/presentation/weather.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/views/forecast.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/views/weather.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

Map<TileType, Widget Function(TileView)> weatherTileWidgetMappers = {
  TileType.weatherDay: (tile) {
    return WeatherTileWidget(tile as DayWeatherTileView);
  },
  TileType.weatherForecast: (tile) {
    return ForecastTileWidget(tile as ForecastWeatherTileView);
  },
};
