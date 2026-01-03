import 'package:fastybird_smart_panel/plugins/tiles-time/presentation/widget.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/plugins/tiles-time/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

Map<TileType, Widget Function(TileView)> timeTileWidgetMappers = {
  TileType.clock: (tile) {
    return TimeTileWidget(tile as TimeTileView);
  },
};
