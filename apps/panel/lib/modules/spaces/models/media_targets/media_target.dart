import 'package:fastybird_smart_panel/api/models/spaces_module_data_media_target_device_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_media_target_role.dart';
import 'package:fastybird_smart_panel/core/utils/uuid.dart';

class MediaTargetModel {
  final String _deviceId;
  final String _deviceName;
  final SpacesModuleDataMediaTargetDeviceCategory _deviceCategory;
  final int _priority;
  final bool _hasOn;
  final bool _hasVolume;
  final bool _hasMute;
  final SpacesModuleDataMediaTargetRole? _role;
  final String _spaceId;

  MediaTargetModel({
    required String deviceId,
    required String deviceName,
    required SpacesModuleDataMediaTargetDeviceCategory deviceCategory,
    required int priority,
    required bool hasOn,
    required bool hasVolume,
    required bool hasMute,
    SpacesModuleDataMediaTargetRole? role,
    required String spaceId,
  })  : _deviceId = UuidUtils.validateUuid(deviceId),
        _deviceName = deviceName,
        _deviceCategory = deviceCategory,
        _priority = priority,
        _hasOn = hasOn,
        _hasVolume = hasVolume,
        _hasMute = hasMute,
        _role = role,
        _spaceId = UuidUtils.validateUuid(spaceId);

  String get deviceId => _deviceId;

  String get deviceName => _deviceName;

  SpacesModuleDataMediaTargetDeviceCategory get deviceCategory =>
      _deviceCategory;

  int get priority => _priority;

  bool get hasOn => _hasOn;

  bool get hasVolume => _hasVolume;

  bool get hasMute => _hasMute;

  SpacesModuleDataMediaTargetRole? get role => _role;

  String get spaceId => _spaceId;

  /// Unique identifier for this media target (device only).
  String get id => _deviceId;

  /// Create a copy with updated fields.
  MediaTargetModel copyWith({
    String? deviceName,
  }) {
    return MediaTargetModel(
      deviceId: _deviceId,
      deviceName: deviceName ?? _deviceName,
      deviceCategory: _deviceCategory,
      priority: _priority,
      hasOn: _hasOn,
      hasVolume: _hasVolume,
      hasMute: _hasMute,
      role: _role,
      spaceId: _spaceId,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is MediaTargetModel &&
        other._deviceId == _deviceId &&
        other._deviceName == _deviceName &&
        other._deviceCategory == _deviceCategory &&
        other._priority == _priority &&
        other._hasOn == _hasOn &&
        other._hasVolume == _hasVolume &&
        other._hasMute == _hasMute &&
        other._role == _role &&
        other._spaceId == _spaceId;
  }

  @override
  int get hashCode => Object.hash(
        _deviceId,
        _deviceName,
        _deviceCategory,
        _priority,
        _hasOn,
        _hasVolume,
        _hasMute,
        _role,
        _spaceId,
      );

  factory MediaTargetModel.fromJson(
    Map<String, dynamic> json, {
    required String spaceId,
  }) {
    return MediaTargetModel(
      deviceId: UuidUtils.validateUuid(json['device_id']),
      deviceName: json['device_name'] ?? '',
      deviceCategory: SpacesModuleDataMediaTargetDeviceCategory.fromJson(
        json['device_category'],
      ),
      priority: json['priority'] ?? 0,
      hasOn: json['has_on'] ?? false,
      hasVolume: json['has_volume'] ?? false,
      hasMute: json['has_mute'] ?? false,
      role: json['role'] != null
          ? SpacesModuleDataMediaTargetRole.fromJson(json['role'])
          : null,
      spaceId: spaceId,
    );
  }
}
