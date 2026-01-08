import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/scenes/scene.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/actions/view.dart';

class SceneView {
  final SceneModel _model;
  final List<ActionView> _actions;

  SceneView({
    required SceneModel model,
    List<ActionView> actions = const [],
  })  : _model = model,
        _actions = actions;

  SceneModel get model => _model;

  String get id => _model.id;

  ScenesModuleDataSceneCategory get category => _model.category;

  String get name => _model.name;

  String? get description => _model.description;

  String? get primarySpaceId => _model.primarySpaceId;

  int get order => _model.order;

  bool get enabled => _model.enabled;

  bool get triggerable => _model.triggerable;

  bool get editable => _model.editable;

  DateTime? get lastTriggeredAt => _model.lastTriggeredAt;

  List<ActionView> get actions => _actions;

  /// Get only enabled actions sorted by order
  List<ActionView> get enabledActions => _actions
      .where((a) => a.enabled)
      .toList()
    ..sort((a, b) => a.order.compareTo(b.order));
}
