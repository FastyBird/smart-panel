import 'package:fastybird_smart_panel/api/models/spaces_module_data_climate_target_device_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_climate_target_role.dart';
import 'package:fastybird_smart_panel/core/utils/uuid.dart';

class ClimateTargetModel {
  final String _deviceId;
  final String _deviceName;
  final SpacesModuleDataClimateTargetDeviceCategory _deviceCategory;
  final String? _channelId;
  final String? _channelName;
  final int _priority;
  final bool _hasTemperature;
  final bool _hasHumidity;
  final bool _hasAirQuality;
  final bool _hasAirParticulate;
  final bool _hasCarbonDioxide;
  final bool _hasVolatileOrganicCompounds;
  final bool _hasPressure;
  final bool _hasMode;
  final SpacesModuleDataClimateTargetRole? _role;
  final String _spaceId;

  ClimateTargetModel({
    required String deviceId,
    required String deviceName,
    required SpacesModuleDataClimateTargetDeviceCategory deviceCategory,
    String? channelId,
    String? channelName,
    required int priority,
    required bool hasTemperature,
    required bool hasHumidity,
    required bool hasAirQuality,
    required bool hasAirParticulate,
    required bool hasCarbonDioxide,
    required bool hasVolatileOrganicCompounds,
    required bool hasPressure,
    required bool hasMode,
    SpacesModuleDataClimateTargetRole? role,
    required String spaceId,
  })  : _deviceId = UuidUtils.validateUuid(deviceId),
        _deviceName = deviceName,
        _deviceCategory = deviceCategory,
        _channelId = channelId != null ? UuidUtils.validateUuid(channelId) : null,
        _channelName = channelName,
        _priority = priority,
        _hasTemperature = hasTemperature,
        _hasHumidity = hasHumidity,
        _hasAirQuality = hasAirQuality,
        _hasAirParticulate = hasAirParticulate,
        _hasCarbonDioxide = hasCarbonDioxide,
        _hasVolatileOrganicCompounds = hasVolatileOrganicCompounds,
        _hasPressure = hasPressure,
        _hasMode = hasMode,
        _role = role,
        _spaceId = UuidUtils.validateUuid(spaceId);

  String get deviceId => _deviceId;

  String get deviceName => _deviceName;

  SpacesModuleDataClimateTargetDeviceCategory get deviceCategory => _deviceCategory;

  String? get channelId => _channelId;

  String? get channelName => _channelName;

  int get priority => _priority;

  bool get hasTemperature => _hasTemperature;

  bool get hasHumidity => _hasHumidity;

  bool get hasAirQuality => _hasAirQuality;

  bool get hasAirParticulate => _hasAirParticulate;

  bool get hasCarbonDioxide => _hasCarbonDioxide;

  bool get hasVolatileOrganicCompounds => _hasVolatileOrganicCompounds;

  bool get hasPressure => _hasPressure;

  bool get hasMode => _hasMode;

  SpacesModuleDataClimateTargetRole? get role => _role;

  String get spaceId => _spaceId;

  /// Unique identifier for this climate target
  /// For actuators (thermostats, heaters, etc.): device ID only
  /// For sensors: device ID + channel ID
  String get id => _channelId != null ? '$_deviceId:$_channelId' : _deviceId;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ClimateTargetModel &&
        other._deviceId == _deviceId &&
        other._channelId == _channelId &&
        other._deviceName == _deviceName &&
        other._deviceCategory == _deviceCategory &&
        other._channelName == _channelName &&
        other._priority == _priority &&
        other._hasTemperature == _hasTemperature &&
        other._hasHumidity == _hasHumidity &&
        other._hasAirQuality == _hasAirQuality &&
        other._hasAirParticulate == _hasAirParticulate &&
        other._hasCarbonDioxide == _hasCarbonDioxide &&
        other._hasVolatileOrganicCompounds == _hasVolatileOrganicCompounds &&
        other._hasPressure == _hasPressure &&
        other._hasMode == _hasMode &&
        other._role == _role &&
        other._spaceId == _spaceId;
  }

  @override
  int get hashCode => Object.hash(
        _deviceId,
        _channelId,
        _deviceName,
        _deviceCategory,
        _channelName,
        _priority,
        _hasTemperature,
        _hasHumidity,
        _hasAirQuality,
        _hasAirParticulate,
        _hasCarbonDioxide,
        _hasVolatileOrganicCompounds,
        _hasPressure,
        _hasMode,
        _role,
        _spaceId,
      );

  factory ClimateTargetModel.fromJson(
    Map<String, dynamic> json, {
    required String spaceId,
  }) {
    return ClimateTargetModel(
      deviceId: UuidUtils.validateUuid(json['device_id']),
      deviceName: json['device_name'] ?? '',
      deviceCategory: SpacesModuleDataClimateTargetDeviceCategory.fromJson(
        json['device_category'],
      ),
      channelId: json['channel_id'],
      channelName: json['channel_name'],
      priority: json['priority'] ?? 0,
      hasTemperature: json['has_temperature'] ?? false,
      hasHumidity: json['has_humidity'] ?? false,
      hasAirQuality: json['has_air_quality'] ?? false,
      hasAirParticulate: json['has_air_particulate'] ?? false,
      hasCarbonDioxide: json['has_carbon_dioxide'] ?? false,
      hasVolatileOrganicCompounds: json['has_volatile_organic_compounds'] ?? false,
      hasPressure: json['has_pressure'] ?? false,
      hasMode: json['has_mode'] ?? false,
      role: json['role'] != null
          ? SpacesModuleDataClimateTargetRole.fromJson(json['role'])
          : null,
      spaceId: spaceId,
    );
  }
}
