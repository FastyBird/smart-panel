import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/material.dart';

class SceneTileModel extends TileModel {
  final String _scene;
  final IconData _icon;
  final String _label;
  final String _status;
  final bool _isOn;

  SceneTileModel({
    required String scene,
    required IconData icon,
    required String label,
    required String status,
    required bool isOn,
    required super.id,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  })  : _scene = UuidUtils.validateUuid(scene),
        _icon = icon,
        _label = label,
        _status = status,
        _isOn = isOn,
        super(
          type: TileType.scene,
        );

  String get scene => _scene;

  IconData get icon => _icon;

  String get label => _label;

  String get status => _status;

  bool get isOn => _isOn;

  factory SceneTileModel.fromJson(Map<String, dynamic> json) {
    return SceneTileModel(
      scene: UuidUtils.validateUuid(json['scene']),
      label: json['label'],
      dataSource: UuidUtils.validateUuidList(
          List<String>.from(json['data_source'] ?? [])),
      icon: IconData(json['icon'], fontFamily: 'MaterialIcons'),
      status: json['status'],
      isOn: json['is_on'],
      id: UuidUtils.validateUuid(json['id']),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
    );
  }
}
