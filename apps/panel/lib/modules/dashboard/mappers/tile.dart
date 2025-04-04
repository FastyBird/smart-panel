import 'package:fastybird_smart_panel/modules/dashboard/models/device_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/scene_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/time_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/weather_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

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
  TileType.devicePreview.value: (data) {
    return PageDevicePreviewTileModel.fromJson(data);
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
  TileType.devicePreview.value: (data) {
    return CardDevicePreviewTileModel.fromJson(data);
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
