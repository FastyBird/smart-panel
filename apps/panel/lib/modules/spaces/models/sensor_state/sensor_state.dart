/// Aggregated environment summary from sensors in a space
class SensorEnvironmentModel {
  final double? averageTemperature;
  final double? averageHumidity;
  final double? averagePressure;
  final double? averageIlluminance;

  SensorEnvironmentModel({
    this.averageTemperature,
    this.averageHumidity,
    this.averagePressure,
    this.averageIlluminance,
  });

  factory SensorEnvironmentModel.fromJson(Map<String, dynamic> json) {
    return SensorEnvironmentModel(
      averageTemperature: (json['average_temperature'] as num?)?.toDouble(),
      averageHumidity: (json['average_humidity'] as num?)?.toDouble(),
      averagePressure: (json['average_pressure'] as num?)?.toDouble(),
      averageIlluminance: (json['average_illuminance'] as num?)?.toDouble(),
    );
  }
}

/// Safety alert entry
class SensorSafetyAlertModel {
  final String channelCategory;
  final String deviceId;
  final String deviceName;
  final String channelId;
  final bool triggered;

  SensorSafetyAlertModel({
    required this.channelCategory,
    required this.deviceId,
    required this.deviceName,
    required this.channelId,
    required this.triggered,
  });

  factory SensorSafetyAlertModel.fromJson(Map<String, dynamic> json) {
    return SensorSafetyAlertModel(
      channelCategory: json['channel_category'] as String? ?? '',
      deviceId: json['device_id'] as String? ?? '',
      deviceName: json['device_name'] as String? ?? '',
      channelId: json['channel_id'] as String? ?? '',
      triggered: json['triggered'] as bool? ?? false,
    );
  }
}

/// Individual sensor reading
class SensorReadingModel {
  final String deviceId;
  final String deviceName;
  final String channelId;
  final String channelName;
  final String channelCategory;
  final String? propertyId;
  final dynamic value;
  final String? unit;
  final String? role;
  final DateTime? updatedAt;

  SensorReadingModel({
    required this.deviceId,
    required this.deviceName,
    required this.channelId,
    required this.channelName,
    required this.channelCategory,
    this.propertyId,
    this.value,
    this.unit,
    this.role,
    this.updatedAt,
  });

  factory SensorReadingModel.fromJson(Map<String, dynamic> json) {
    return SensorReadingModel(
      deviceId: json['device_id'] as String? ?? '',
      deviceName: json['device_name'] as String? ?? '',
      channelId: json['channel_id'] as String? ?? '',
      channelName: json['channel_name'] as String? ?? '',
      channelCategory: json['channel_category'] as String? ?? '',
      propertyId: json['property_id'] as String?,
      value: json['value'],
      unit: json['unit'] as String?,
      role: json['role'] as String?,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'] as String)
          : null,
    );
  }
}

/// Readings grouped by sensor role
class SensorRoleReadingsModel {
  final String role;
  final int sensorsCount;
  final List<SensorReadingModel> readings;

  SensorRoleReadingsModel({
    required this.role,
    required this.sensorsCount,
    required this.readings,
  });

  factory SensorRoleReadingsModel.fromJson(Map<String, dynamic> json) {
    final readingsJson = json['readings'] as List<dynamic>? ?? [];
    return SensorRoleReadingsModel(
      role: json['role'] as String? ?? 'other',
      sensorsCount: json['sensors_count'] as int? ?? readingsJson.length,
      readings: readingsJson
          .map((item) => SensorReadingModel.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// Aggregated sensor state for a space
class SensorStateModel {
  final String spaceId;
  final bool hasSensors;
  final int totalSensors;
  final Map<String, int> sensorsByRole;
  final SensorEnvironmentModel? environment;
  final List<SensorSafetyAlertModel> safetyAlerts;
  final bool hasSafetyAlert;
  final bool motionDetected;
  final bool occupancyDetected;
  final List<SensorRoleReadingsModel> readings;

  SensorStateModel({
    required this.spaceId,
    required this.hasSensors,
    required this.totalSensors,
    required this.sensorsByRole,
    this.environment,
    required this.safetyAlerts,
    required this.hasSafetyAlert,
    required this.motionDetected,
    required this.occupancyDetected,
    required this.readings,
  });

  factory SensorStateModel.fromJson(
    Map<String, dynamic> json, {
    required String spaceId,
  }) {
    final sensorsByRoleJson = json['sensors_by_role'] as Map<String, dynamic>? ?? {};
    final readingsJson = json['readings'] as List<dynamic>? ?? [];
    final safetyAlertsJson = json['safety_alerts'] as List<dynamic>? ?? [];

    return SensorStateModel(
      spaceId: spaceId,
      hasSensors: json['has_sensors'] as bool? ?? false,
      totalSensors: json['total_sensors'] as int? ?? 0,
      sensorsByRole: sensorsByRoleJson.map(
        (key, value) => MapEntry(key, (value as num?)?.toInt() ?? 0),
      ),
      environment: json['environment'] != null
          ? SensorEnvironmentModel.fromJson(json['environment'] as Map<String, dynamic>)
          : null,
      safetyAlerts: safetyAlertsJson
          .map((item) => SensorSafetyAlertModel.fromJson(item as Map<String, dynamic>))
          .toList(),
      hasSafetyAlert: json['has_safety_alert'] as bool? ?? false,
      motionDetected: json['motion_detected'] as bool? ?? false,
      occupancyDetected: json['occupancy_detected'] as bool? ?? false,
      readings: readingsJson
          .map((item) => SensorRoleReadingsModel.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }

  factory SensorStateModel.empty(String spaceId) {
    return SensorStateModel(
      spaceId: spaceId,
      hasSensors: false,
      totalSensors: 0,
      sensorsByRole: {},
      environment: null,
      safetyAlerts: const [],
      hasSafetyAlert: false,
      motionDetected: false,
      occupancyDetected: false,
      readings: const [],
    );
  }
}
