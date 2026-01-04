import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/light_targets/view.dart';

class SpaceView {
  final String _id;
  final SpacesModuleDataSpaceType _type;
  final String _name;
  final String? _description;
  final SpacesModuleDataSpaceCategory? _category;
  final String? _parentId;
  final int _displayOrder;
  final bool _suggestionsEnabled;
  final String? _icon;
  final String? _primaryThermostatId;
  final String? _primaryTemperatureSensorId;
  final DateTime? _lastActivityAt;
  final List<SpaceView> _children;
  final List<LightTargetView> _lightTargets;

  SpaceView({
    required String id,
    required SpacesModuleDataSpaceType type,
    required String name,
    String? description,
    SpacesModuleDataSpaceCategory? category,
    String? parentId,
    required int displayOrder,
    required bool suggestionsEnabled,
    String? icon,
    String? primaryThermostatId,
    String? primaryTemperatureSensorId,
    DateTime? lastActivityAt,
    List<SpaceView> children = const [],
    List<LightTargetView> lightTargets = const [],
  })  : _id = id,
        _type = type,
        _name = name,
        _description = description,
        _category = category,
        _parentId = parentId,
        _displayOrder = displayOrder,
        _suggestionsEnabled = suggestionsEnabled,
        _icon = icon,
        _primaryThermostatId = primaryThermostatId,
        _primaryTemperatureSensorId = primaryTemperatureSensorId,
        _lastActivityAt = lastActivityAt,
        _children = children,
        _lightTargets = lightTargets;

  String get id => _id;

  SpacesModuleDataSpaceType get type => _type;

  String get name => _name;

  String? get description => _description;

  SpacesModuleDataSpaceCategory? get category => _category;

  String? get parentId => _parentId;

  int get displayOrder => _displayOrder;

  bool get suggestionsEnabled => _suggestionsEnabled;

  String? get icon => _icon;

  String? get primaryThermostatId => _primaryThermostatId;

  String? get primaryTemperatureSensorId => _primaryTemperatureSensorId;

  DateTime? get lastActivityAt => _lastActivityAt;

  List<SpaceView> get children => _children;

  List<LightTargetView> get lightTargets => _lightTargets;

  bool get isRoom => _type == SpacesModuleDataSpaceType.room;

  bool get isZone => _type == SpacesModuleDataSpaceType.zone;

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
