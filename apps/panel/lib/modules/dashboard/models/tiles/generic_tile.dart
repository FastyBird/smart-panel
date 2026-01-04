import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';

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
    List<String> dataSources = [];

    if (json['data_source'] is List) {
      for (var dataSource in json['data_source']) {
        if (dataSource is String) {
          dataSources.add(dataSource);
        } else if (dataSource is Map<String, dynamic> &&
            dataSource['id'] is String) {
          dataSources.add(dataSource['id'] as String);
        }
      }
    }

    // Extract parent type and id with proper type checking
    String parentType = 'page';
    String parentId;

    if (json['parent'] is Map<String, dynamic>) {
      final parent = json['parent'] as Map<String, dynamic>;
      if (parent['type'] is String) {
        parentType = parent['type'] as String;
      }
      if (parent['id'] is String) {
        parentId = parent['id'] as String;
      } else {
        throw ArgumentError('Missing or invalid parent id in tile JSON');
      }
    } else {
      if (json['parent_type'] is String) {
        parentType = json['parent_type'] as String;
      }
      if (json['parent_id'] is String) {
        parentId = json['parent_id'] as String;
      } else {
        throw ArgumentError('Missing or invalid parent_id in tile JSON');
      }
    }

    return GenericTileModel(
      id: UuidUtils.validateUuid(json['id']),
      type: json['type'] ?? 'unknown',
      parentType: parentType,
      parentId: UuidUtils.validateUuid(parentId),
      dataSource: UuidUtils.validateUuidList(dataSources),
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
