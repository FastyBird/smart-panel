import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

/// Generic tile model for unknown/unregistered tile types.
/// Stores the raw configuration from the API for inspection.
class GenericTileModel extends TileModel {
  final Map<String, dynamic> _configuration;

  GenericTileModel({
    required super.id,
    required super.type,
    required super.parentType,
    required super.parentId,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    Map<String, dynamic> configuration = const {},
    super.createdAt,
    super.updatedAt,
  }) : _configuration = configuration;

  Map<String, dynamic> get configuration => _configuration;

  factory GenericTileModel.fromJson(Map<String, dynamic> json) {
    return GenericTileModel(
      id: UuidUtils.validateUuid(json['id']),
      type: TileType.fromValue(json['type']) ?? TileType.clock,
      parentType: json['parent_type'] ?? 'page',
      parentId: UuidUtils.validateUuid(json['parent_id'] ?? json['parent']),
      dataSource: json['data_source'] != null
          ? List<String>.from(json['data_source'])
          : [],
      row: json['row'] ?? 0,
      col: json['col'] ?? 0,
      rowSpan: json['row_span'] ?? 1,
      colSpan: json['col_span'] ?? 1,
      configuration: json['configuration'] is Map<String, dynamic>
          ? json['configuration']
          : {},
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
