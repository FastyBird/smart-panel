import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:material_symbols_icons/get.dart';

class TilesPageModel extends PageModel {
  final List<String> _tiles;

  final List<String> _dataSource;

  TilesPageModel({
    List<String> tiles = const [],
    List<String> dataSource = const [],
    required super.id,
    required super.title,
    required super.icon,
    super.order,
    super.createdAt,
    super.updatedAt,
  })  : _tiles = UuidUtils.validateUuidList(tiles),
        _dataSource = UuidUtils.validateUuidList(dataSource),
        super(
          type: PageType.tiles,
        );

  List<String> get tiles => _tiles;

  List<String> get dataSource => _dataSource;

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
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      order: json['order'],
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
