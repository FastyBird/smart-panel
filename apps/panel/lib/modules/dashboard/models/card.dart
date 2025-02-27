import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/model.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';

class CardModel extends Model {
  final String _title;
  final IconData? _icon;
  final int _order;

  final String _page;

  final List<String> _tiles;
  final List<String> _dataSource;

  CardModel({
    required super.id,
    required String title,
    IconData? icon,
    required int order,
    required String page,
    List<String> tiles = const [],
    List<String> dataSource = const [],
    super.createdAt,
    super.updatedAt,
  })  : _title = title,
        _icon = icon,
        _order = order,
        _page = UuidUtils.validateUuid(page),
        _tiles = UuidUtils.validateUuidList(dataSource),
        _dataSource = UuidUtils.validateUuidList(dataSource);

  String get title => _title;

  IconData? get icon => _icon;

  int get order => _order;

  String get page => _page;

  List<String> get tiles => _tiles;

  List<String> get dataSource => _dataSource;

  factory CardModel.fromJson(Map<String, dynamic> json) {
    List<String> tiles = [];

    if (json['tiles'] is List) {
      for (var tile in json['tiles']) {
        if (tile is String) {
          tiles.add(tile);
        } else if (tile is Map<String, dynamic> && tile.containsKey('id')) {
          tiles.add(tile['id']);
        }
      }
    }

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

    return CardModel(
      id: UuidUtils.validateUuid(json['id']),
      title: json['title'],
      icon: json['icon'] != null && json['icon'] is String
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      order: json['order'],
      page: UuidUtils.validateUuid(json['page']),
      tiles: UuidUtils.validateUuidList(tiles),
      dataSource: UuidUtils.validateUuidList(dataSources),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
