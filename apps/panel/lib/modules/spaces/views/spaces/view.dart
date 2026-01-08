import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/spaces/space.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/light_targets/view.dart';

class SpaceView {
  final SpaceModel _model;
  final List<SpaceView> _children;
  final List<LightTargetView> _lightTargets;

  SpaceView({
    required SpaceModel model,
    List<SpaceView> children = const [],
    List<LightTargetView> lightTargets = const [],
  })  : _model = model,
        _children = children,
        _lightTargets = lightTargets;

  SpaceModel get model => _model;

  String get id => _model.id;

  SpacesModuleDataSpaceType get type => _model.type;

  String get name => _model.name;

  String? get description => _model.description;

  SpacesModuleDataSpaceCategory? get category => _model.category;

  String? get parentId => _model.parentId;

  int get displayOrder => _model.displayOrder;

  bool get suggestionsEnabled => _model.suggestionsEnabled;

  String? get icon => _model.icon;

  String? get primaryThermostatId => _model.primaryThermostatId;

  String? get primaryTemperatureSensorId => _model.primaryTemperatureSensorId;

  DateTime? get lastActivityAt => _model.lastActivityAt;

  List<SpaceView> get children => _children;

  List<LightTargetView> get lightTargets => _lightTargets;

  bool get isRoom => _model.isRoom;

  bool get isZone => _model.isZone;

  /// Get light targets by role
  List<LightTargetView> getLightTargetsByRole(LightTargetRole role) {
    return _lightTargets.where((t) => t.role == role).toList()
      ..sort((a, b) => a.priority.compareTo(b.priority));
  }

  /// Get the primary light target for a specific role
  LightTargetView? getPrimaryLightTarget(LightTargetRole role) {
    final targets = getLightTargetsByRole(role);
    return targets.isNotEmpty ? targets.first : null;
  }

  /// Get all assigned light targets (those with a role)
  List<LightTargetView> get assignedLightTargets =>
      _lightTargets.where((t) => t.role != null).toList();

  /// Get all unassigned light targets
  List<LightTargetView> get unassignedLightTargets =>
      _lightTargets.where((t) => t.role == null).toList();
}
