import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/device_preview.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/forecast.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/time.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/weather.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/device_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/time_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/weather_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/material.dart';

Map<String, Widget Function(TileModel, List<DataSourceModel>)>
    tileWidgetMappers = {
  TileType.clock.value: (model, data) {
    return TimeTileWidget(model as TimeTileModel, data);
  },
  TileType.weatherDay.value: (model, data) {
    return WeatherTileWidget(model as DayWeatherTileModel, data);
  },
  TileType.weatherForecast.value: (model, data) {
    return ForecastTileWidget(model as ForecastWeatherTileModel, data);
  },
  TileType.devicePreview.value: (model, data) {
    return DevicePreviewTileWidget(model as DevicePreviewTileModel, data);
  },
};

Widget buildTileWidget(TileModel model, List<DataSourceModel> data) {
  final builder = tileWidgetMappers[model.type.value];

  if (builder != null) {
    return builder(model, data);
  } else {
    throw Exception(
      'Tile widget can not be created. Unsupported tile type: ${model.type}',
    );
  }
}
