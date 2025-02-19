import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';

class CardModel {
  final String _id;

  final String _title;
  final IconData? _icon;
  final int _order;

  final String _page;

  final List<String> _tiles;
  final List<String> _dataSource;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  CardModel({
    required String id,
    required String title,
    IconData? icon,
    required int order,
    required String page,
    List<String> tiles = const [],
    List<String> dataSource = const [],
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _title = title,
        _icon = icon,
        _order = order,
        _page = UuidUtils.validateUuid(page),
        _tiles = UuidUtils.validateUuidList(dataSource),
        _dataSource = UuidUtils.validateUuidList(dataSource),
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  String get title => _title;

  IconData? get icon => _icon;

  int get order => _order;

  String get page => _page;

  List<String> get tiles => _tiles;

  List<String> get dataSource => _dataSource;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;

  factory CardModel.fromJson(Map<String, dynamic> json) {
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
      tiles: UuidUtils.validateUuidList(List<String>.from(json['tiles'] ?? [])),
      dataSource: UuidUtils.validateUuidList(
          List<String>.from(json['data_source'] ?? [])),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
