import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

class DevicePreviewTileView extends TileView {
  final String _device;
  final IconData? _icon;

  DevicePreviewTileView({
    required super.id,
    required super.type,
    required super.parentType,
    required super.parentId,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.dataSources,
    required String device,
    IconData? icon,
  })  : _device = device,
        _icon = icon;

  String get device => _device;

  IconData? get icon => _icon;
}
