import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/generic_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/generic_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

Map<String, TileModel Function(Map<String, dynamic>)> tileModelMappers = {};

void registerTileModelMapper(
  String type,
  TileModel Function(Map<String, dynamic>) mapper,
) {
  tileModelMappers[type] = mapper;
}

TileModel buildTileModel(String type, Map<String, dynamic> data) {
  final builder = tileModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    return GenericTileModel.fromJson(data);
  }
}

Map<String, TileView Function(TileModel, List<DataSourceView>)>
    tileViewsMappers = {};

void registerTileViewMapper(
  String type,
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
    if (tile is! GenericTileModel) {
      throw ArgumentError(
        'Cannot create generic view for non-generic model type: ${tile.type}',
      );
    }

    return GenericTileView(
      model: tile,
      dataSources: dataSources,
    );
  }
}

Map<String, Widget Function(TileView)> tileWidgetMappers = {};

void registerTileWidgetMapper(
  String type,
  Widget Function(TileView) mapper,
) {
  tileWidgetMappers[type] = mapper;
}

Widget buildTileWidget(TileView tile) {
  final builder = tileWidgetMappers[tile.type];

  if (builder != null) {
    return builder(tile);
  } else {
    throw ArgumentError(
      'Tile widget can not be created. Unsupported tile type: ${tile.type}',
    );
  }
}
