/// Climate mode enum
enum ClimateMode {
  heat,
  cool,
  auto,
  off,
}

/// Parse ClimateMode from string
ClimateMode? parseClimateMode(String? mode) {
  if (mode == null) return null;
  switch (mode) {
    case 'heat':
      return ClimateMode.heat;
    case 'cool':
      return ClimateMode.cool;
    case 'auto':
      return ClimateMode.auto;
    case 'off':
      return ClimateMode.off;
    default:
      return null;
  }
}

/// Convert ClimateMode to API string
String climateModeToString(ClimateMode mode) {
  switch (mode) {
    case ClimateMode.heat:
      return 'heat';
    case ClimateMode.cool:
      return 'cool';
    case ClimateMode.auto:
      return 'auto';
    case ClimateMode.off:
      return 'off';
  }
}

/// Aggregated climate state for a space
class ClimateStateModel {
  final String spaceId;
  final bool hasClimate;
  final ClimateMode? mode;
  final double? currentTemperature;
  final double? currentHumidity;

  /// Heating setpoint - target temperature for heating (used in HEAT and AUTO modes)
  final double? heatingSetpoint;

  /// Cooling setpoint - target temperature for cooling (used in COOL and AUTO modes)
  final double? coolingSetpoint;
  final double minSetpoint;
  final double maxSetpoint;
  final bool supportsHeating;
  final bool supportsCooling;

  /// Whether any heater device is actively heating (heater.on=true AND heater.status=true)
  final bool isHeating;

  /// Whether any cooler device is actively cooling (cooler.on=true AND cooler.status=true)
  final bool isCooling;

  /// Whether devices have different setpoints or modes (out of sync)
  final bool isMixed;
  final int devicesCount;
  final ClimateMode? lastAppliedMode;
  final DateTime? lastAppliedAt;

  ClimateStateModel({
    required this.spaceId,
    required this.hasClimate,
    this.mode,
    this.currentTemperature,
    this.currentHumidity,
    this.heatingSetpoint,
    this.coolingSetpoint,
    required this.minSetpoint,
    required this.maxSetpoint,
    required this.supportsHeating,
    required this.supportsCooling,
    required this.isHeating,
    required this.isCooling,
    required this.isMixed,
    required this.devicesCount,
    this.lastAppliedMode,
    this.lastAppliedAt,
  });

  /// Check if in heating mode (mode selection, not actual device activity)
  bool get isInHeatingMode => mode == ClimateMode.heat;

  /// Check if in cooling mode (mode selection, not actual device activity)
  bool get isInCoolingMode => mode == ClimateMode.cool;

  /// Check if in auto mode
  bool get isAuto => mode == ClimateMode.auto;

  /// Check if climate is off
  bool get isOff => mode == ClimateMode.off;

  /// Check if temperature can be adjusted
  bool get canAdjustTemperature => hasClimate && (supportsHeating || supportsCooling);

  /// Get the effective target temperature based on mode
  double? get effectiveTargetTemperature {
    switch (mode) {
      case ClimateMode.heat:
        return heatingSetpoint;
      case ClimateMode.cool:
        return coolingSetpoint;
      case ClimateMode.auto:
        // For auto mode, return midpoint between heating and cooling setpoints
        if (heatingSetpoint != null && coolingSetpoint != null) {
          return (heatingSetpoint! + coolingSetpoint!) / 2;
        }
        return heatingSetpoint ?? coolingSetpoint;
      case ClimateMode.off:
      case null:
        return heatingSetpoint ?? coolingSetpoint;
    }
  }

  factory ClimateStateModel.fromJson(
    Map<String, dynamic> json, {
    required String spaceId,
  }) {
    return ClimateStateModel(
      spaceId: spaceId,
      hasClimate: json['has_climate'] as bool? ?? false,
      mode: parseClimateMode(json['mode'] as String?),
      currentTemperature: (json['current_temperature'] as num?)?.toDouble(),
      currentHumidity: (json['current_humidity'] as num?)?.toDouble(),
      heatingSetpoint: (json['heating_setpoint'] as num?)?.toDouble(),
      coolingSetpoint: (json['cooling_setpoint'] as num?)?.toDouble(),
      minSetpoint: (json['min_setpoint'] as num?)?.toDouble() ?? 5.0,
      maxSetpoint: (json['max_setpoint'] as num?)?.toDouble() ?? 35.0,
      supportsHeating: json['supports_heating'] as bool? ?? false,
      supportsCooling: json['supports_cooling'] as bool? ?? false,
      isHeating: json['is_heating'] as bool? ?? false,
      isCooling: json['is_cooling'] as bool? ?? false,
      isMixed: json['is_mixed'] as bool? ?? false,
      devicesCount: json['devices_count'] as int? ?? 0,
      lastAppliedMode: parseClimateMode(json['last_applied_mode'] as String?),
      lastAppliedAt: json['last_applied_at'] != null
          ? DateTime.parse(json['last_applied_at'] as String)
          : null,
    );
  }

  /// Create an empty state (no climate devices)
  factory ClimateStateModel.empty(String spaceId) {
    return ClimateStateModel(
      spaceId: spaceId,
      hasClimate: false,
      minSetpoint: 5.0,
      maxSetpoint: 35.0,
      supportsHeating: false,
      supportsCooling: false,
      isHeating: false,
      isCooling: false,
      isMixed: false,
      devicesCount: 0,
    );
  }
}
