import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/actions/view.dart';

class SceneView {
  final String _id;
  final ScenesModuleDataSceneCategory _category;
  final String _name;
  final String? _description;
  final String? _primarySpaceId;
  final int _order;
  final bool _enabled;
  final bool _triggerable;
  final bool _editable;
  final DateTime? _lastTriggeredAt;
  final List<ActionView> _actions;

  SceneView({
    required String id,
    required ScenesModuleDataSceneCategory category,
    required String name,
    String? description,
    String? primarySpaceId,
    required int order,
    required bool enabled,
    required bool triggerable,
    required bool editable,
    DateTime? lastTriggeredAt,
    List<ActionView> actions = const [],
  })  : _id = id,
        _category = category,
        _name = name,
        _description = description,
        _primarySpaceId = primarySpaceId,
        _order = order,
        _enabled = enabled,
        _triggerable = triggerable,
        _editable = editable,
        _lastTriggeredAt = lastTriggeredAt,
        _actions = actions;

  String get id => _id;

  ScenesModuleDataSceneCategory get category => _category;

  String get name => _name;

  String? get description => _description;

  String? get primarySpaceId => _primarySpaceId;

  int get order => _order;

  bool get enabled => _enabled;

  bool get triggerable => _triggerable;

  bool get editable => _editable;

  DateTime? get lastTriggeredAt => _lastTriggeredAt;

  List<ActionView> get actions => _actions;

  /// Get only enabled actions sorted by order
  List<ActionView> get enabledActions => _actions
      .where((a) => a.enabled)
      .toList()
    ..sort((a, b) => a.order.compareTo(b.order));
}
