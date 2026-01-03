import 'package:fastybird_smart_panel/plugins/tiles-device-preview/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-time/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/mapper.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

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
