import 'package:fastybird_smart_panel/plugins/tiles-scene/presentation/widget.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

Map<TileType, Widget Function(TileView)> sceneTileWidgetMappers = {
  TileType.scene: (tile) {
    return SceneTileWidget(tile as SceneTileView);
  },
};
