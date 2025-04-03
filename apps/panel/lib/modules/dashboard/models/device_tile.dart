import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';

abstract class DevicePreviewTileModel extends TileModel {
  final String _device;

  final IconData? _icon;

  DevicePreviewTileModel({
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
          type: TileType.devicePreview,
        );

  String get device => _device;

  IconData? get icon => _icon;
}

class PageDevicePreviewTileModel extends DevicePreviewTileModel {
  PageDevicePreviewTileModel({
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

  factory PageDevicePreviewTileModel.fromJson(Map<String, dynamic> json) {
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

    return PageDevicePreviewTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['page']),
      dataSource: UuidUtils.validateUuidList(dataSources),
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

class CardDevicePreviewTileModel extends DevicePreviewTileModel {
  CardDevicePreviewTileModel({
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

  factory CardDevicePreviewTileModel.fromJson(Map<String, dynamic> json) {
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

    return CardDevicePreviewTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['card']),
      dataSource: UuidUtils.validateUuidList(dataSources),
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
