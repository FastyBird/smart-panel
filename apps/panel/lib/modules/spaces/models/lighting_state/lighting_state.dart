/// Lighting mode enum
enum LightingMode {
  work,
  relax,
  night,
}

/// Confidence level for detected lighting mode
enum ModeConfidence {
  exact,
  approximate,
  none,
}

/// Lighting role enum for aggregated state
enum LightingStateRole {
  main,
  task,
  ambient,
  accent,
  night,
  other,
}

/// Parse LightingMode from string
LightingMode? parseLightingMode(String? mode) {
  if (mode == null) return null;
  switch (mode) {
    case 'work':
      return LightingMode.work;
    case 'relax':
      return LightingMode.relax;
    case 'night':
      return LightingMode.night;
    default:
      return null;
  }
}

/// Parse ModeConfidence from string
ModeConfidence parseModeConfidence(String confidence) {
  switch (confidence) {
    case 'exact':
      return ModeConfidence.exact;
    case 'approximate':
      return ModeConfidence.approximate;
    case 'none':
    default:
      return ModeConfidence.none;
  }
}

/// Parse LightingStateRole from string
LightingStateRole? parseLightingStateRole(String? role) {
  if (role == null) return null;
  switch (role) {
    case 'main':
      return LightingStateRole.main;
    case 'task':
      return LightingStateRole.task;
    case 'ambient':
      return LightingStateRole.ambient;
    case 'accent':
      return LightingStateRole.accent;
    case 'night':
      return LightingStateRole.night;
    case 'other':
      return LightingStateRole.other;
    default:
      return null;
  }
}

/// Represents the last intent applied to a role
class RoleLastIntent {
  final LightingMode? mode;
  final int? brightness;
  final DateTime? appliedAt;

  RoleLastIntent({
    this.mode,
    this.brightness,
    this.appliedAt,
  });

  factory RoleLastIntent.fromJson(Map<String, dynamic> json) {
    return RoleLastIntent(
      mode: parseLightingMode(json['mode'] as String?),
      brightness: json['brightness'] as int?,
      appliedAt: json['applied_at'] != null
          ? DateTime.parse(json['applied_at'] as String)
          : null,
    );
  }
}

/// Aggregated state for a single lighting role
class RoleAggregatedState {
  final LightingStateRole role;
  final bool isOn;
  final bool isOnMixed;
  final int? brightness;
  final int? colorTemperature;
  final String? color;
  final int? white;
  final bool isBrightnessMixed;
  final bool isColorTemperatureMixed;
  final bool isColorMixed;
  final bool isWhiteMixed;
  final int devicesCount;
  final int devicesOn;
  final RoleLastIntent? lastIntent;

  RoleAggregatedState({
    required this.role,
    required this.isOn,
    required this.isOnMixed,
    this.brightness,
    this.colorTemperature,
    this.color,
    this.white,
    required this.isBrightnessMixed,
    required this.isColorTemperatureMixed,
    required this.isColorMixed,
    required this.isWhiteMixed,
    required this.devicesCount,
    required this.devicesOn,
    this.lastIntent,
  });

  bool get hasLights => devicesCount > 0;
  bool get anyOn => devicesOn > 0;
  bool get allOn => devicesCount > 0 && devicesOn == devicesCount;
  bool get allOff => devicesOn == 0;

  factory RoleAggregatedState.fromJson(
    Map<String, dynamic> json,
    LightingStateRole role,
  ) {
    return RoleAggregatedState(
      role: role,
      isOn: json['is_on'] as bool? ?? false,
      isOnMixed: json['is_on_mixed'] as bool? ?? false,
      brightness: json['brightness'] as int?,
      colorTemperature: json['color_temperature'] as int?,
      color: json['color'] as String?,
      white: json['white'] as int?,
      isBrightnessMixed: json['is_brightness_mixed'] as bool? ?? false,
      isColorTemperatureMixed: json['is_color_temperature_mixed'] as bool? ?? false,
      isColorMixed: json['is_color_mixed'] as bool? ?? false,
      isWhiteMixed: json['is_white_mixed'] as bool? ?? false,
      devicesCount: json['devices_count'] as int? ?? 0,
      devicesOn: json['devices_on'] as int? ?? 0,
      lastIntent: json['last_intent'] != null
          ? RoleLastIntent.fromJson(json['last_intent'] as Map<String, dynamic>)
          : null,
    );
  }
}

/// State for lights without role assignment
class OtherLightsState {
  final bool isOn;
  final bool isOnMixed;
  final int? brightness;
  final int? colorTemperature;
  final String? color;
  final int? white;
  final bool isBrightnessMixed;
  final bool isColorTemperatureMixed;
  final bool isColorMixed;
  final bool isWhiteMixed;
  final int devicesCount;
  final int devicesOn;

  OtherLightsState({
    required this.isOn,
    required this.isOnMixed,
    this.brightness,
    this.colorTemperature,
    this.color,
    this.white,
    required this.isBrightnessMixed,
    required this.isColorTemperatureMixed,
    required this.isColorMixed,
    required this.isWhiteMixed,
    required this.devicesCount,
    required this.devicesOn,
  });

  bool get hasLights => devicesCount > 0;
  bool get anyOn => devicesOn > 0;

  factory OtherLightsState.fromJson(Map<String, dynamic> json) {
    return OtherLightsState(
      isOn: json['is_on'] as bool? ?? false,
      isOnMixed: json['is_on_mixed'] as bool? ?? false,
      brightness: json['brightness'] as int?,
      colorTemperature: json['color_temperature'] as int?,
      color: json['color'] as String?,
      white: json['white'] as int?,
      isBrightnessMixed: json['is_brightness_mixed'] as bool? ?? false,
      isColorTemperatureMixed: json['is_color_temperature_mixed'] as bool? ?? false,
      isColorMixed: json['is_color_mixed'] as bool? ?? false,
      isWhiteMixed: json['is_white_mixed'] as bool? ?? false,
      devicesCount: json['devices_count'] as int? ?? 0,
      devicesOn: json['devices_on'] as int? ?? 0,
    );
  }
}

/// Aggregated lighting state for a space
class LightingStateModel {
  final String spaceId;
  final LightingMode? detectedMode;
  final ModeConfidence modeConfidence;
  final double? modeMatchPercentage;
  final LightingMode? lastAppliedMode;
  final DateTime? lastAppliedAt;
  final int totalLights;
  final int lightsOn;
  final double? averageBrightness;
  final Map<LightingStateRole, RoleAggregatedState> roles;
  final OtherLightsState other;

  LightingStateModel({
    required this.spaceId,
    this.detectedMode,
    required this.modeConfidence,
    this.modeMatchPercentage,
    this.lastAppliedMode,
    this.lastAppliedAt,
    required this.totalLights,
    required this.lightsOn,
    this.averageBrightness,
    required this.roles,
    required this.other,
  });

  bool get hasLights => totalLights > 0;
  bool get anyOn => lightsOn > 0;
  bool get allOn => totalLights > 0 && lightsOn == totalLights;
  bool get allOff => lightsOn == 0;

  /// Get the state for a specific role
  RoleAggregatedState? getRoleState(LightingStateRole role) => roles[role];

  factory LightingStateModel.fromJson(
    Map<String, dynamic> json, {
    required String spaceId,
  }) {
    // Parse roles map
    Map<LightingStateRole, RoleAggregatedState> rolesMap = {};
    final rolesJson = json['roles'] as Map<String, dynamic>? ?? {};

    for (final entry in rolesJson.entries) {
      final role = parseLightingStateRole(entry.key);
      if (role != null && entry.value != null) {
        rolesMap[role] = RoleAggregatedState.fromJson(
          entry.value as Map<String, dynamic>,
          role,
        );
      }
    }

    return LightingStateModel(
      spaceId: spaceId,
      detectedMode: parseLightingMode(json['detected_mode'] as String?),
      modeConfidence: parseModeConfidence(json['mode_confidence'] as String? ?? 'none'),
      modeMatchPercentage: (json['mode_match_percentage'] as num?)?.toDouble(),
      lastAppliedMode: parseLightingMode(json['last_applied_mode'] as String?),
      lastAppliedAt: json['last_applied_at'] != null
          ? DateTime.parse(json['last_applied_at'] as String)
          : null,
      totalLights: json['total_lights'] as int? ?? 0,
      lightsOn: json['lights_on'] as int? ?? 0,
      averageBrightness: (json['average_brightness'] as num?)?.toDouble(),
      roles: rolesMap,
      other: OtherLightsState.fromJson(
        json['other'] as Map<String, dynamic>? ?? {},
      ),
    );
  }

  /// Create an empty state
  factory LightingStateModel.empty(String spaceId) {
    return LightingStateModel(
      spaceId: spaceId,
      modeConfidence: ModeConfidence.none,
      totalLights: 0,
      lightsOn: 0,
      roles: {},
      other: OtherLightsState(
        isOn: false,
        isOnMixed: false,
        isBrightnessMixed: false,
        isColorTemperatureMixed: false,
        isColorMixed: false,
        isWhiteMixed: false,
        devicesCount: 0,
        devicesOn: 0,
      ),
    );
  }
}
