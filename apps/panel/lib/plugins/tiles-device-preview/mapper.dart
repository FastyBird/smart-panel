import 'package:fastybird_smart_panel/plugins/tiles-device-preview/presentation/widget.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

Map<TileType, Widget Function(TileView)> devicePreviewTileWidgetMappers = {
  TileType.devicePreview: (tile) {
    return DevicePreviewTileWidget(tile as DevicePreviewTileView);
  },
};
