import 'package:fastybird_smart_panel/api/models/spaces_module_data_light_target_role.dart';
import 'package:fastybird_smart_panel/core/utils/uuid.dart';

class LightTargetModel {
  final String _deviceId;
  final String _deviceName;
  final String _channelId;
  final String _channelName;
  final int _priority;
  final bool _hasBrightness;
  final bool _hasColorTemp;
  final bool _hasColor;
  final SpacesModuleDataLightTargetRole? _role;
  final String _spaceId;

  LightTargetModel({
    required String deviceId,
    required String deviceName,
    required String channelId,
    required String channelName,
    required int priority,
    required bool hasBrightness,
    required bool hasColorTemp,
    required bool hasColor,
    SpacesModuleDataLightTargetRole? role,
    required String spaceId,
  })  : _deviceId = UuidUtils.validateUuid(deviceId),
        _deviceName = deviceName,
        _channelId = UuidUtils.validateUuid(channelId),
        _channelName = channelName,
        _priority = priority,
        _hasBrightness = hasBrightness,
        _hasColorTemp = hasColorTemp,
        _hasColor = hasColor,
        _role = role,
        _spaceId = UuidUtils.validateUuid(spaceId);

  String get deviceId => _deviceId;

  String get deviceName => _deviceName;

  String get channelId => _channelId;

  String get channelName => _channelName;

  int get priority => _priority;

  bool get hasBrightness => _hasBrightness;

  bool get hasColorTemp => _hasColorTemp;

  bool get hasColor => _hasColor;

  SpacesModuleDataLightTargetRole? get role => _role;

  String get spaceId => _spaceId;

  /// Unique identifier for this light target (combination of device and channel)
  String get id => '$_deviceId:$_channelId';

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is LightTargetModel &&
        other._deviceId == _deviceId &&
        other._channelId == _channelId &&
        other._deviceName == _deviceName &&
        other._channelName == _channelName &&
        other._priority == _priority &&
        other._hasBrightness == _hasBrightness &&
        other._hasColorTemp == _hasColorTemp &&
        other._hasColor == _hasColor &&
        other._role == _role &&
        other._spaceId == _spaceId;
  }

  @override
  int get hashCode => Object.hash(
        _deviceId,
        _channelId,
        _deviceName,
        _channelName,
        _priority,
        _hasBrightness,
        _hasColorTemp,
        _hasColor,
        _role,
        _spaceId,
      );

  factory LightTargetModel.fromJson(
    Map<String, dynamic> json, {
    required String spaceId,
  }) {
    return LightTargetModel(
      deviceId: UuidUtils.validateUuid(json['device_id']),
      deviceName: json['device_name'] ?? '',
      channelId: UuidUtils.validateUuid(json['channel_id']),
      channelName: json['channel_name'] ?? '',
      priority: json['priority'] ?? 0,
      hasBrightness: json['has_brightness'] ?? false,
      hasColorTemp: json['has_color_temp'] ?? false,
      hasColor: json['has_color'] ?? false,
      role: json['role'] != null
          ? SpacesModuleDataLightTargetRole.fromJson(json['role'])
          : null,
      spaceId: spaceId,
    );
  }
}
