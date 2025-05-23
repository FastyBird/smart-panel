import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/device_preview_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

class DevicePreviewTileView extends TileView<DevicePreviewTileModel> {
  final List<DataSourceView> _dataSources;

  DevicePreviewTileView({
    required List<DataSourceView> dataSources,
    required super.tileModel,
  }) : _dataSources = dataSources;

  String get device => tileModel.device;

  List<DataSourceView> get dataSources => _dataSources;

  IconData? get icon => tileModel.icon;
}
