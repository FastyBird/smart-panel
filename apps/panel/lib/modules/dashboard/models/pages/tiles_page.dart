import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class TilesPageModel extends PageModel {
  final List<String> _tiles;

  final List<String> _dataSource;

  final double? _tileSize;

  final int? _rows;

  final int? _cols;

  TilesPageModel({
    List<String> tiles = const [],
    List<String> dataSource = const [],
    double? tileSize,
    int? rows,
    int? cols,
    required super.id,
    required super.title,
    required super.icon,
    super.order,
    super.showTopBar,
    super.displays,
    super.createdAt,
    super.updatedAt,
  })  : _tiles = UuidUtils.validateUuidList(tiles),
        _dataSource = UuidUtils.validateUuidList(dataSource),
        _tileSize = tileSize,
        _rows = rows,
        _cols = cols,
        super(
          type: PageType.tiles,
        );

  List<String> get tiles => _tiles;

  List<String> get dataSource => _dataSource;

  double? get tileSize => _tileSize;

  int? get rows => _rows;

  int? get cols => _cols;

  factory TilesPageModel.fromJson(Map<String, dynamic> json) {
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

    return TilesPageModel(
      id: UuidUtils.validateUuid(json['id']),
      title: json['title'],
      icon: json['icon'] != null && json['icon'] is String
          ? MdiIcons.fromString(json['icon'])
          : null,
      order: json['order'],
      showTopBar: json['show_top_bar'],
      displays: json['displays'] != null && json['displays'] is List
          ? (json['displays'] as List).map((e) => e.toString()).toList()
          : null,
      tileSize: json['tile_size']?.toDouble(),
      rows: json['rows'],
      cols: json['cols'],
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
