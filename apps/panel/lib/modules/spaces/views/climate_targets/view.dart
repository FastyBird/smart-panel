import 'package:fastybird_smart_panel/api/models/spaces_module_data_climate_target_device_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_climate_target_role.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_targets/climate_target.dart';

/// Climate target role enum for convenience
enum ClimateTargetRole {
  heatingOnly,
  coolingOnly,
  auto,
  auxiliary,
  sensor,
  hidden;

  static ClimateTargetRole? fromApiRole(SpacesModuleDataClimateTargetRole? role) {
    if (role == null) return null;
    switch (role) {
      case SpacesModuleDataClimateTargetRole.heatingOnly:
        return ClimateTargetRole.heatingOnly;
      case SpacesModuleDataClimateTargetRole.coolingOnly:
        return ClimateTargetRole.coolingOnly;
      case SpacesModuleDataClimateTargetRole.auto:
        return ClimateTargetRole.auto;
      case SpacesModuleDataClimateTargetRole.auxiliary:
        return ClimateTargetRole.auxiliary;
      case SpacesModuleDataClimateTargetRole.sensor:
        return ClimateTargetRole.sensor;
      case SpacesModuleDataClimateTargetRole.hidden:
        return ClimateTargetRole.hidden;
      case SpacesModuleDataClimateTargetRole.$unknown:
        return null;
    }
  }

  /// Check if this role is a sensor role
  bool get isSensor => this == ClimateTargetRole.sensor;

  /// Check if this role is an actuator/control role
  bool get isActuator => !isSensor && this != ClimateTargetRole.hidden;
}

class ClimateTargetView {
  final ClimateTargetModel _model;

  ClimateTargetView({required ClimateTargetModel model}) : _model = model;

  ClimateTargetModel get model => _model;

  String get id => _model.id;

  String get deviceId => _model.deviceId;

  String get deviceName => _model.deviceName;

  SpacesModuleDataClimateTargetDeviceCategory get deviceCategory =>
      _model.deviceCategory;

  String? get channelId => _model.channelId;

  String? get channelName => _model.channelName;

  int get priority => _model.priority;

  bool get hasTemperature => _model.hasTemperature;

  bool get hasHumidity => _model.hasHumidity;

  bool get hasMode => _model.hasMode;

  /// Converted role from API enum to local enum
  ClimateTargetRole? get role => ClimateTargetRole.fromApiRole(_model.role);

  String get spaceId => _model.spaceId;

  /// Check if this is a sensor target (has channel ID)
  bool get isSensor => _model.channelId != null;

  /// Check if this is an actuator target (no channel ID)
  bool get isActuator => _model.channelId == null;

  /// Check if this target supports any climate control features
  bool get hasClimateControl =>
      _model.hasTemperature || _model.hasHumidity || _model.hasMode;

  /// Display name for the climate target
  String get displayName {
    if (_model.channelName != null && _model.channelName!.isNotEmpty) {
      return _model.channelName!;
    }
    return _model.deviceName;
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ClimateTargetView && other._model == _model;
  }

  @override
  int get hashCode => _model.hashCode;
}
