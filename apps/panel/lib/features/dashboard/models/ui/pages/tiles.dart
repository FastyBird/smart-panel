import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
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
