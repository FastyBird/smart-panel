import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/actions/action.dart';

/// Generic action model for unknown/unregistered action types.
/// Stores the raw configuration from the API for inspection.
class GenericActionModel extends ActionModel {
  GenericActionModel({
    required super.id,
    required super.type,
    required super.scene,
    required super.order,
    required super.enabled,
    super.configuration,
    super.createdAt,
    super.updatedAt,
  });

  factory GenericActionModel.fromJson(Map<String, dynamic> json) {
    return GenericActionModel(
      id: UuidUtils.validateUuid(json['id']),
      type: json['type'] ?? 'unknown',
      scene: UuidUtils.validateUuid(json['scene']),
      order: json['order'] ?? 0,
      enabled: json['enabled'] ?? true,
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
