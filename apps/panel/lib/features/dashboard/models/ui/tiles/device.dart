import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';

abstract class DeviceTileModel extends TileModel {
  final String _device;

  final IconData? _icon;

  DeviceTileModel({
    required String device,
    required IconData? icon,
    required super.id,
    required super.parent,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  })  : _device = UuidUtils.validateUuid(device),
        _icon = icon,
        super(
          type: TileType.device,
        );

  String get device => _device;

  IconData? get icon => _icon;
}

class PageDeviceTileModel extends DeviceTileModel {
  PageDeviceTileModel({
    required super.device,
    super.icon,
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

  factory PageDeviceTileModel.fromJson(Map<String, dynamic> json) {
    return PageDeviceTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
      dataSource: UuidUtils.validateUuidList(
        List<String>.from(json['data_source'] ?? []),
      ),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      device: UuidUtils.validateUuid(json['device']),
      icon: json['icon'] != null && json['icon'] is String
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}

class CardDeviceTileModel extends DeviceTileModel {
  CardDeviceTileModel({
    required super.device,
    super.icon,
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

  factory CardDeviceTileModel.fromJson(Map<String, dynamic> json) {
    return CardDeviceTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
      dataSource: UuidUtils.validateUuidList(
        List<String>.from(json['data_source'] ?? []),
      ),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      device: UuidUtils.validateUuid(json['device']),
      icon: json['icon'] != null && json['icon'] is String
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
