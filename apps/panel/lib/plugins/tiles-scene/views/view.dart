import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

class SceneTileView extends TileView {
  final String _scene;
  final IconData? _icon;
  final String _label;
  final String _status;
  final bool _isOn;

  SceneTileView({
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
    required String scene,
    IconData? icon,
    required String label,
    required String status,
    required bool isOn,
  })  : _scene = scene,
        _icon = icon,
        _label = label,
        _status = status,
        _isOn = isOn;

  String get scene => _scene;

  IconData? get icon => _icon;

  String get label => _label;

  String get status => _status;

  bool get isOn => _isOn;
}
