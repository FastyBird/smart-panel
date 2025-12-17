import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/device_preview_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/scene_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/time_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/weather_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/service.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/device_preview.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/forecast.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/time.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/weather.dart';

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

Map<TileType, TileView Function(TileModel)> tileViewsMappers = {
  TileType.devicePreview: (tile) {
    if (tile is! DevicePreviewTileModel) {
      throw ArgumentError(
        'Tile model is not valid for Device preview tile view.',
      );
    }

    final DashboardService dashboardService = locator<DashboardService>();

    // Query data sources by parentId to include newly created ones
    final List<DataSourceView> dataSources = dashboardService
        .dataSources.entries
        .where((entry) =>
            entry.value.parentId == tile.id && entry.value.parentType == 'tile')
        .map((entry) => entry.value)
        .toList();

    return DevicePreviewTileView(
      tileModel: tile,
      dataSources: dataSources,
    );
  },
  TileType.clock: (tile) {
    if (tile is! TimeTileModel) {
      throw ArgumentError(
        'Tile model is not valid for Time tile view.',
      );
    }

    return TimeTileView(
      tileModel: tile,
    );
  },
  TileType.weatherDay: (tile) {
    if (tile is! DayWeatherTileModel) {
      throw ArgumentError(
        'Tile model is not valid for Day weather tile view.',
      );
    }

    return DayWeatherTileView(
      tileModel: tile,
    );
  },
  TileType.weatherForecast: (tile) {
    if (tile is! ForecastWeatherTileModel) {
      throw ArgumentError(
        'Tile model is not valid for Forecast weather tile view.',
      );
    }

    return ForecastWeatherTileView(
      tileModel: tile,
    );
  },
};

TileView buildTileView(
  TileModel tile,
) {
  final builder = tileViewsMappers[tile.type];

  if (builder != null) {
    return builder(tile);
  } else {
    throw ArgumentError(
      'Tile view can not be created. Unsupported tile type: ${tile.type.value}',
    );
  }
}
