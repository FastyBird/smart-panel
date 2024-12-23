import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/scene.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/time.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/weather.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/forecast.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/scene.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/time.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/weather.dart';
import 'package:flutter/material.dart';

Map<String, TileModel Function(Map<String, dynamic>)> tileModelMappers = {
  TileType.clock.value: (data) {
    return TimeTileModel.fromJson(data);
  },
  TileType.weatherDay.value: (data) {
    return DayWeatherTileModel.fromJson(data);
  },
  TileType.weatherForecast.value: (data) {
    return ForecastWeatherTileModel.fromJson(data);
  },
  TileType.scene.value: (data) {
    return SceneTileModel.fromJson(data);
  },
  TileType.device.value: (data) {
    return DeviceTileModel.fromJson(data);
  },
};

TileModel buildTileModel(TileType type, Map<String, dynamic> data) {
  final builder = tileModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Tile model can not be created. Unsupported tile type: ${data['type']}',
    );
  }
}

Map<String, TileDataSourceModel Function(Map<String, dynamic>)>
    tileDataModelMappers = {
  TileDataSourceType.deviceChannel.value: (data) {
    return DeviceTileDataSourceModel.fromJson(data);
  },
};

TileDataSourceModel buildTileDataModel(
    TileDataSourceType type, Map<String, dynamic> data) {
  final builder = tileDataModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Tile data model can not be created. Unsupported tile data type: ${data['type']}',
    );
  }
}

Map<String, Widget Function(TileModel, List<TileDataSourceModel>)>
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
  TileType.scene.value: (model, data) {
    return SceneTileWidget(model as SceneTileModel, data);
  },
  TileType.device.value: (model, data) {
    return DeviceTileWidget(model as DeviceTileModel, data);
  },
};

Widget buildTileWidget(TileModel model, List<TileDataSourceModel> data) {
  final builder = tileWidgetMappers[model.type.value];

  if (builder != null) {
    return builder(model, data);
  } else {
    throw Exception(
      'Tile widget can not be created. Unsupported tile type: ${model.type}',
    );
  }
}
