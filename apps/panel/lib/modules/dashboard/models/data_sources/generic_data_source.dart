import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';

/// Generic data source model for unknown/unregistered data source types.
/// Stores the raw configuration from the API for inspection.
class GenericDataSourceModel extends DataSourceModel {
  final Map<String, dynamic> _configuration;

  GenericDataSourceModel({
    required super.id,
    required super.type,
    required super.parentType,
    required super.parentId,
    Map<String, dynamic> configuration = const {},
    super.createdAt,
    super.updatedAt,
  }) : _configuration = configuration;

  Map<String, dynamic> get configuration => _configuration;

  factory GenericDataSourceModel.fromJson(Map<String, dynamic> json) {
    return GenericDataSourceModel(
      id: UuidUtils.validateUuid(json['id']),
      type: json['type'] ?? 'unknown',
      parentType: json['parent_type'] ?? 'tile',
      parentId: UuidUtils.validateUuid(json['parent_id'] ?? json['parent']),
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
