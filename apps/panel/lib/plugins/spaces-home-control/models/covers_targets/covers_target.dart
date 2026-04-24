import 'package:fastybird_smart_panel/api/models/spaces_module_data_covers_target_role.dart';
import 'package:fastybird_smart_panel/core/utils/uuid.dart';

class CoversTargetModel {
  final String _deviceId;
  final String _deviceName;
  final String _channelId;
  final String _channelName;
  final int _priority;
  final bool _hasPosition;
  final bool _hasCommand;
  final bool _hasTilt;
  final String? _coverType;
  final SpacesModuleDataCoversTargetRole? _role;
  final String _spaceId;

  CoversTargetModel({
    required String deviceId,
    required String deviceName,
    required String channelId,
    required String channelName,
    required int priority,
    required bool hasPosition,
    required bool hasCommand,
    required bool hasTilt,
    String? coverType,
    SpacesModuleDataCoversTargetRole? role,
    required String spaceId,
  })  : _deviceId = UuidUtils.validateUuid(deviceId),
        _deviceName = deviceName,
        _channelId = UuidUtils.validateUuid(channelId),
        _channelName = channelName,
        _priority = priority,
        _hasPosition = hasPosition,
        _hasCommand = hasCommand,
        _hasTilt = hasTilt,
        _coverType = coverType,
        _role = role,
        _spaceId = UuidUtils.validateUuid(spaceId);

  String get deviceId => _deviceId;

  String get deviceName => _deviceName;

  String get channelId => _channelId;

  String get channelName => _channelName;

  int get priority => _priority;

  bool get hasPosition => _hasPosition;

  bool get hasCommand => _hasCommand;

  bool get hasTilt => _hasTilt;

  String? get coverType => _coverType;

  SpacesModuleDataCoversTargetRole? get role => _role;

  String get spaceId => _spaceId;

  /// Unique identifier for this covers target (combination of device and channel)
  String get id => '$_deviceId:$_channelId';

  /// Create a copy with updated fields
  CoversTargetModel copyWith({
    String? deviceName,
    String? channelName,
  }) {
    return CoversTargetModel(
      deviceId: _deviceId,
      deviceName: deviceName ?? _deviceName,
      channelId: _channelId,
      channelName: channelName ?? _channelName,
      priority: _priority,
      hasPosition: _hasPosition,
      hasCommand: _hasCommand,
      hasTilt: _hasTilt,
      coverType: _coverType,
      role: _role,
      spaceId: _spaceId,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is CoversTargetModel &&
        other._deviceId == _deviceId &&
        other._channelId == _channelId &&
        other._deviceName == _deviceName &&
        other._channelName == _channelName &&
        other._priority == _priority &&
        other._hasPosition == _hasPosition &&
        other._hasCommand == _hasCommand &&
        other._hasTilt == _hasTilt &&
        other._coverType == _coverType &&
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
        _hasPosition,
        _hasCommand,
        _hasTilt,
        _coverType,
        _role,
        _spaceId,
      );

  factory CoversTargetModel.fromJson(
    Map<String, dynamic> json, {
    required String spaceId,
  }) {
    return CoversTargetModel(
      deviceId: UuidUtils.validateUuid(json['device_id']),
      deviceName: json['device_name'] ?? '',
      channelId: UuidUtils.validateUuid(json['channel_id']),
      channelName: json['channel_name'] ?? '',
      priority: json['priority'] ?? 0,
      hasPosition: json['has_position'] ?? false,
      hasCommand: json['has_command'] ?? false,
      hasTilt: json['has_tilt'] ?? false,
      coverType: json['cover_type'] as String?,
      role: json['role'] != null
          ? SpacesModuleDataCoversTargetRole.fromJson(json['role'])
          : null,
      spaceId: spaceId,
    );
  }
}
