import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';

abstract class SceneTileModel extends TileModel {
  final String _scene;
  final IconData? _icon;
  final String _label;
  final String _status;
  final bool _isOn;

  SceneTileModel({
    required String scene,
    IconData? icon,
    required String label,
    required String status,
    required bool isOn,
    required super.id,
    required super.parent,
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

  IconData? get icon => _icon;

  String get label => _label;

  String get status => _status;

  bool get isOn => _isOn;
}

class PageSceneTileModel extends SceneTileModel {
  PageSceneTileModel({
    required super.scene,
    required super.icon,
    required super.label,
    required super.status,
    required super.isOn,
    required super.id,
    required super.parent,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  });

  factory PageSceneTileModel.fromJson(Map<String, dynamic> json) {
    List<String> dataSources = [];

    if (json['data_source'] is List) {
      for (var dataSource in json['data_source']) {
        if (dataSource is String) {
          dataSources.add(dataSource);
        } else if (dataSource is Map<String, dynamic> &&
            dataSource.containsKey('id')) {
          dataSources.add(dataSource['id']);
        }
      }
    }

    return PageSceneTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['page']),
      dataSource: UuidUtils.validateUuidList(dataSources),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      scene: UuidUtils.validateUuid(json['scene']),
      label: json['label'],
      icon: json['icon'] != null && json['icon'] is String
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      status: json['status'],
      isOn: json['is_on'],
      colSpan: json['col_span'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}

class CardSceneTileModel extends SceneTileModel {
  CardSceneTileModel({
    required super.scene,
    required super.icon,
    required super.label,
    required super.status,
    required super.isOn,
    required super.id,
    required super.parent,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  });

  factory CardSceneTileModel.fromJson(Map<String, dynamic> json) {
    List<String> dataSources = [];

    if (json['data_source'] is List) {
      for (var dataSource in json['data_source']) {
        if (dataSource is String) {
          dataSources.add(dataSource);
        } else if (dataSource is Map<String, dynamic> &&
            dataSource.containsKey('id')) {
          dataSources.add(dataSource['id']);
        }
      }
    }

    return CardSceneTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['card']),
      dataSource: UuidUtils.validateUuidList(dataSources),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      scene: UuidUtils.validateUuid(json['scene']),
      label: json['label'],
      icon: json['icon'] != null && json['icon'] is String
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      status: json['status'],
      isOn: json['is_on'],
      colSpan: json['col_span'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
