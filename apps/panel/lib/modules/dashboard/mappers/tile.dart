import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/generic_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/generic_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/models/model.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/views/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/models/model.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/views/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-time/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-time/models/model.dart';
import 'package:fastybird_smart_panel/plugins/tiles-time/views/view.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/models/model.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/views/forecast.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/views/weather.dart';
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
  TileType.devicePreview.value: (data) {
    return DevicePreviewTileModel.fromJson(data);
  },
};

void registerTileModelMapper(
  String type,
  TileModel Function(Map<String, dynamic>) mapper,
) {
  tileModelMappers[type] = mapper;
}

TileModel buildTileModel(TileType type, Map<String, dynamic> data) {
  final builder = tileModelMappers[data['type']];

  if (builder != null) {
    return builder(data);
  } else {
    return GenericTileModel.fromJson(data);
  }
}

Map<TileType, TileView Function(TileModel, List<DataSourceView>)>
    tileViewsMappers = {
  TileType.devicePreview: (tile, dataSources) {
    if (tile is! DevicePreviewTileModel) {
      throw ArgumentError(
        'Tile model is not valid for Device preview tile view.',
      );
    }

    return DevicePreviewTileView(
      id: tile.id,
      type: tile.type,
      parentType: tile.parentType,
      parentId: tile.parentId,
      dataSource: tile.dataSource,
      row: tile.row,
      col: tile.col,
      rowSpan: tile.rowSpan,
      colSpan: tile.colSpan,
      dataSources: dataSources,
      device: tile.device,
      icon: tile.icon,
    );
  },
  TileType.clock: (tile, dataSources) {
    if (tile is! TimeTileModel) {
      throw ArgumentError(
        'Tile model is not valid for Time tile view.',
      );
    }

    return TimeTileView(
      id: tile.id,
      type: tile.type,
      parentType: tile.parentType,
      parentId: tile.parentId,
      dataSource: tile.dataSource,
      row: tile.row,
      col: tile.col,
      rowSpan: tile.rowSpan,
      colSpan: tile.colSpan,
      dataSources: dataSources,
    );
  },
  TileType.weatherDay: (tile, dataSources) {
    if (tile is! DayWeatherTileModel) {
      throw ArgumentError(
        'Tile model is not valid for Day weather tile view.',
      );
    }

    return DayWeatherTileView(
      id: tile.id,
      type: tile.type,
      parentType: tile.parentType,
      parentId: tile.parentId,
      dataSource: tile.dataSource,
      row: tile.row,
      col: tile.col,
      rowSpan: tile.rowSpan,
      colSpan: tile.colSpan,
      dataSources: dataSources,
      locationId: tile.locationId,
    );
  },
  TileType.weatherForecast: (tile, dataSources) {
    if (tile is! ForecastWeatherTileModel) {
      throw ArgumentError(
        'Tile model is not valid for Forecast weather tile view.',
      );
    }

    return ForecastWeatherTileView(
      id: tile.id,
      type: tile.type,
      parentType: tile.parentType,
      parentId: tile.parentId,
      dataSource: tile.dataSource,
      row: tile.row,
      col: tile.col,
      rowSpan: tile.rowSpan,
      colSpan: tile.colSpan,
      dataSources: dataSources,
      locationId: tile.locationId,
    );
  },
  TileType.scene: (tile, dataSources) {
    if (tile is! SceneTileModel) {
      throw ArgumentError(
        'Tile model is not valid for Scene tile view.',
      );
    }

    return SceneTileView(
      id: tile.id,
      type: tile.type,
      parentType: tile.parentType,
      parentId: tile.parentId,
      dataSource: tile.dataSource,
      row: tile.row,
      col: tile.col,
      rowSpan: tile.rowSpan,
      colSpan: tile.colSpan,
      dataSources: dataSources,
      scene: tile.scene,
      icon: tile.icon,
      label: tile.label,
      status: tile.status,
      isOn: tile.isOn,
    );
  },
};

void registerTileViewMapper(
  TileType type,
  TileView Function(TileModel, List<DataSourceView>) mapper,
) {
  tileViewsMappers[type] = mapper;
}

TileView buildTileView(
  TileModel tile, {
  List<DataSourceView> dataSources = const [],
}) {
  final builder = tileViewsMappers[tile.type];

  if (builder != null) {
    return builder(tile, dataSources);
  } else {
    final Map<String, dynamic> configuration = tile is GenericTileModel
        ? tile.configuration
        : <String, dynamic>{};

    return GenericTileView(
      id: tile.id,
      type: tile.type,
      parentType: tile.parentType,
      parentId: tile.parentId,
      dataSource: tile.dataSource,
      row: tile.row,
      col: tile.col,
      rowSpan: tile.rowSpan,
      colSpan: tile.colSpan,
      dataSources: dataSources,
      configuration: configuration,
    );
  }
}

/// Combines all tile widget mappers from plugins
final Map<TileType, Widget Function(TileView)> tileWidgetMappers = {
  ...timeTileWidgetMappers,
  ...weatherTileWidgetMappers,
  ...devicePreviewTileWidgetMappers,
  ...sceneTileWidgetMappers,
};

Widget buildTileWidget(TileView tile) {
  final builder = tileWidgetMappers[tile.type];

  if (builder != null) {
    return builder(tile);
  } else {
    throw ArgumentError(
      'Tile widget can not be created. Unsupported tile type: ${tile.type.value}',
    );
  }
}
