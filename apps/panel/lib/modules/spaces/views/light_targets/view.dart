import 'package:fastybird_smart_panel/api/models/spaces_module_data_light_target_role.dart';

/// Light target role enum for convenience
enum LightTargetRole {
  main,
  task,
  ambient,
  accent,
  night,
  other;

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
      case SpacesModuleDataLightTargetRole.$unknown:
        return null;
    }
  }
}

class LightTargetView {
  final String _id;
  final String _deviceId;
  final String _deviceName;
  final String _channelId;
  final String _channelName;
  final int _priority;
  final bool _hasBrightness;
  final bool _hasColorTemp;
  final bool _hasColor;
  final LightTargetRole? _role;
  final String _spaceId;

  LightTargetView({
    required String id,
    required String deviceId,
    required String deviceName,
    required String channelId,
    required String channelName,
    required int priority,
    required bool hasBrightness,
    required bool hasColorTemp,
    required bool hasColor,
    LightTargetRole? role,
    required String spaceId,
  })  : _id = id,
        _deviceId = deviceId,
        _deviceName = deviceName,
        _channelId = channelId,
        _channelName = channelName,
        _priority = priority,
        _hasBrightness = hasBrightness,
        _hasColorTemp = hasColorTemp,
        _hasColor = hasColor,
        _role = role,
        _spaceId = spaceId;

  String get id => _id;

  String get deviceId => _deviceId;

  String get deviceName => _deviceName;

  String get channelId => _channelId;

  String get channelName => _channelName;

  int get priority => _priority;

  bool get hasBrightness => _hasBrightness;

  bool get hasColorTemp => _hasColorTemp;

  bool get hasColor => _hasColor;

  LightTargetRole? get role => _role;

  String get spaceId => _spaceId;

  /// Check if this light supports any advanced features
  bool get hasAdvancedFeatures => _hasBrightness || _hasColorTemp || _hasColor;

  /// Display name for the light target
  String get displayName =>
      _channelName.isNotEmpty ? _channelName : _deviceName;
}
