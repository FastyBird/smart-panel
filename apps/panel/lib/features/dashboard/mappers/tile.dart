import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/tiles/device_preview.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/tiles/forecast.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/tiles/time.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/tiles/weather.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/device_preview.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/forecast.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/time.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/weather.dart';
import 'package:flutter/material.dart';

Map<TileType, Widget Function(TileView)> tileWidgetMappers = {
  TileType.clock: (tile) {
    return TimeTileWidget(tile as TimeTileView);
  },
  TileType.weatherDay: (tile) {
    return WeatherTileWidget(tile as DayWeatherTileView);
  },
  TileType.weatherForecast: (tile) {
    return ForecastTileWidget(tile as ForecastWeatherTileView);
  },
  TileType.devicePreview: (tile) {
    return DevicePreviewTileWidget(tile as DevicePreviewTileView);
  },
};

Widget buildTileWidget(TileView tile) {
  final builder = tileWidgetMappers[tile.type];

  if (builder != null) {
    return builder(tile);
  } else {
    throw Exception(
      'Tile widget can not be created. Unsupported tile type: ${tile.type.value}',
    );
  }
}
