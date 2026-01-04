import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/model.dart';

class SceneModel extends Model {
  final ScenesModuleDataSceneCategory _category;
  final String _name;
  final String? _description;
  final String? _primarySpaceId;
  final int _order;
  final bool _enabled;
  final bool _triggerable;
  final bool _editable;
  final DateTime? _lastTriggeredAt;
  final List<String> _actions;

  SceneModel({
    required super.id,
    required ScenesModuleDataSceneCategory category,
    required String name,
    String? description,
    String? primarySpaceId,
    required int order,
    required bool enabled,
    required bool triggerable,
    required bool editable,
    DateTime? lastTriggeredAt,
    List<String> actions = const [],
    super.createdAt,
    super.updatedAt,
  })  : _category = category,
        _name = name,
        _description = description,
        _primarySpaceId =
            primarySpaceId != null ? UuidUtils.validateUuid(primarySpaceId) : null,
        _order = order,
        _enabled = enabled,
        _triggerable = triggerable,
        _editable = editable,
        _lastTriggeredAt = lastTriggeredAt,
        _actions = UuidUtils.validateUuidList(actions);

  ScenesModuleDataSceneCategory get category => _category;

  String get name => _name;

  String? get description => _description;

  String? get primarySpaceId => _primarySpaceId;

  int get order => _order;

  bool get enabled => _enabled;

  bool get triggerable => _triggerable;

  bool get editable => _editable;

  DateTime? get lastTriggeredAt => _lastTriggeredAt;

  List<String> get actions => _actions;

  factory SceneModel.fromJson(Map<String, dynamic> json) {
    List<String> actionIds = [];

    if (json['actions'] is List) {
      for (var action in json['actions']) {
        if (action is String) {
          actionIds.add(action);
        } else if (action is Map<String, dynamic> && action.containsKey('id')) {
          actionIds.add(action['id']);
        }
      }
    }

    return SceneModel(
      id: UuidUtils.validateUuid(json['id']),
      category: ScenesModuleDataSceneCategory.fromJson(json['category']),
      name: json['name'],
      description: json['description'],
      primarySpaceId: json['primary_space_id'],
      order: json['order'] ?? 0,
      enabled: json['enabled'] ?? true,
      triggerable: json['triggerable'] ?? true,
      editable: json['editable'] ?? true,
      lastTriggeredAt: json['last_triggered_at'] != null
          ? DateTime.parse(json['last_triggered_at'])
          : null,
      actions: actionIds,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
