import 'package:fastybird_smart_panel/modules/dashboard/models/device_preview_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/scene_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/time_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/weather_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

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
  TileType.devicePreview.value: (data) {
    return DevicePreviewTileModel.fromJson(data);
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
