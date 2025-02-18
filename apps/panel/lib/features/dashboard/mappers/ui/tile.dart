import 'package:fastybird_smart_panel/features/dashboard/models/ui/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/scene.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/time.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/weather.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/forecast.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/time.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/weather.dart';
import 'package:flutter/material.dart';

Map<String, TileModel Function(Map<String, dynamic>)> pageTileModelMappers = {
  TileType.clock.value: (data) {
    return PageTimeTileModel.fromJson(data);
  },
  TileType.weatherDay.value: (data) {
    return PageDayWeatherTileModel.fromJson(data);
  },
  TileType.weatherForecast.value: (data) {
    return PageForecastWeatherTileModel.fromJson(data);
  },
  TileType.scene.value: (data) {
    return PageSceneTileModel.fromJson(data);
  },
  TileType.device.value: (data) {
    return PageDeviceTileModel.fromJson(data);
  },
};

TileModel buildPageTileModel(TileType type, Map<String, dynamic> data) {
  final builder = pageTileModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Page tile model can not be created. Unsupported tile type: ${data['type']}',
    );
  }
}

Map<String, TileModel Function(Map<String, dynamic>)> cardTileModelMappers = {
  TileType.clock.value: (data) {
    return CardTimeTileModel.fromJson(data);
  },
  TileType.weatherDay.value: (data) {
    return CardDayWeatherTileModel.fromJson(data);
  },
  TileType.weatherForecast.value: (data) {
    return CardForecastWeatherTileModel.fromJson(data);
  },
  TileType.scene.value: (data) {
    return CardSceneTileModel.fromJson(data);
  },
  TileType.device.value: (data) {
    return CardDeviceTileModel.fromJson(data);
  },
};

TileModel buildCardTileModel(TileType type, Map<String, dynamic> data) {
  final builder = cardTileModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Card tile model can not be created. Unsupported tile type: ${data['type']}',
    );
  }
}

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
  TileType.device.value: (model, data) {
    return DeviceTileWidget(model as DeviceTileModel, data);
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
