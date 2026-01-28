import 'package:fastybird_smart_panel/api/models/spaces_module_data_light_target_role.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/light_targets/light_target.dart';

/// Light target role enum for convenience
enum LightTargetRole {
  main,
  task,
  ambient,
  accent,
  night,
  other,
  hidden;

  static LightTargetRole? fromApiRole(SpacesModuleDataLightTargetRole? role) {
    if (role == null) return null;
    switch (role) {
      case SpacesModuleDataLightTargetRole.main:
        return LightTargetRole.main;
      case SpacesModuleDataLightTargetRole.task:
        return LightTargetRole.task;
      case SpacesModuleDataLightTargetRole.ambient:
        return LightTargetRole.ambient;
      case SpacesModuleDataLightTargetRole.accent:
        return LightTargetRole.accent;
      case SpacesModuleDataLightTargetRole.night:
        return LightTargetRole.night;
      case SpacesModuleDataLightTargetRole.other:
        return LightTargetRole.other;
      case SpacesModuleDataLightTargetRole.hidden:
        return LightTargetRole.hidden;
      case SpacesModuleDataLightTargetRole.$unknown:
        return null;
    }
  }
}

class LightTargetView {
  final LightTargetModel _model;

  LightTargetView({required LightTargetModel model}) : _model = model;

  LightTargetModel get model => _model;

  String get id => _model.id;

  String get deviceId => _model.deviceId;

  String get deviceName => _model.deviceName;

  String get channelId => _model.channelId;

  String get channelName => _model.channelName;

  int get priority => _model.priority;

  bool get hasBrightness => _model.hasBrightness;

  bool get hasColorTemp => _model.hasColorTemp;

  bool get hasColor => _model.hasColor;

  /// Converted role from API enum to local enum
  LightTargetRole? get role => LightTargetRole.fromApiRole(_model.role);

  String get spaceId => _model.spaceId;

  /// Check if this light supports any advanced features
  bool get hasAdvancedFeatures =>
      _model.hasBrightness || _model.hasColorTemp || _model.hasColor;

  /// Display name for the light target
  String get displayName => _model.channelName;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is LightTargetView && other._model == _model;
  }

  @override
  int get hashCode => _model.hashCode;
}
