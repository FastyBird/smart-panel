import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart';

/// Result of a lighting intent execution
class LightingIntentResult {
  final bool success;
  final int affectedDevices;
  final int failedDevices;
  final int? skippedOfflineDevices;
  final List<String>? offlineDeviceIds;
  final List<String>? failedTargets;

  LightingIntentResult({
    required this.success,
    required this.affectedDevices,
    required this.failedDevices,
    this.skippedOfflineDevices,
    this.offlineDeviceIds,
    this.failedTargets,
  });

  factory LightingIntentResult.fromJson(Map<String, dynamic> json) {
    return LightingIntentResult(
      success: json['success'] as bool? ?? false,
      affectedDevices: json['affected_devices'] as int? ?? 0,
      failedDevices: json['failed_devices'] as int? ?? 0,
      skippedOfflineDevices: json['skipped_offline_devices'] as int?,
      offlineDeviceIds: (json['offline_device_ids'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      failedTargets: (json['failed_targets'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );
  }
}

/// Result of a climate intent execution
class ClimateIntentResult {
  final bool success;
  final int affectedDevices;
  final int failedDevices;
  final int? skippedOfflineDevices;
  final List<String>? offlineDeviceIds;
  final List<String>? failedTargets;
  final ClimateMode? mode;
  /// Heating setpoint (used in HEAT and AUTO modes)
  final double? heatingSetpoint;
  /// Cooling setpoint (used in COOL and AUTO modes)
  final double? coolingSetpoint;

  ClimateIntentResult({
    required this.success,
    required this.affectedDevices,
    required this.failedDevices,
    this.skippedOfflineDevices,
    this.offlineDeviceIds,
    this.failedTargets,
    this.mode,
    this.heatingSetpoint,
    this.coolingSetpoint,
  });

  factory ClimateIntentResult.fromJson(Map<String, dynamic> json) {
    return ClimateIntentResult(
      success: json['success'] as bool? ?? false,
      affectedDevices: json['affected_devices'] as int? ?? 0,
      failedDevices: json['failed_devices'] as int? ?? 0,
      skippedOfflineDevices: json['skipped_offline_devices'] as int?,
      offlineDeviceIds: (json['offline_device_ids'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      failedTargets: (json['failed_targets'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      mode: parseClimateMode(json['mode'] as String?),
      heatingSetpoint: (json['heating_setpoint'] as num?)?.toDouble(),
      coolingSetpoint: (json['cooling_setpoint'] as num?)?.toDouble(),
    );
  }
}

/// Result of a covers intent execution
class CoversIntentResult {
  final bool success;
  final int affectedDevices;
  final int failedDevices;
  final int? skippedOfflineDevices;
  final List<String>? offlineDeviceIds;
  final List<String>? failedTargets;
  final int? newPosition;

  CoversIntentResult({
    required this.success,
    required this.affectedDevices,
    required this.failedDevices,
    this.skippedOfflineDevices,
    this.offlineDeviceIds,
    this.failedTargets,
    this.newPosition,
  });

  factory CoversIntentResult.fromJson(Map<String, dynamic> json) {
    return CoversIntentResult(
      success: json['success'] as bool? ?? false,
      affectedDevices: json['affected_devices'] as int? ?? 0,
      failedDevices: json['failed_devices'] as int? ?? 0,
      skippedOfflineDevices: json['skipped_offline_devices'] as int?,
      offlineDeviceIds: (json['offline_device_ids'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      failedTargets: (json['failed_targets'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      newPosition: json['new_position'] as int?,
    );
  }
}

/// Result of a media intent execution
class MediaIntentResult {
  final bool success;
  final int affectedDevices;
  final int failedDevices;
  final int? skippedOfflineDevices;
  final List<String>? offlineDeviceIds;
  final List<String>? failedTargets;
  final int? newVolume;
  final bool? isMuted;

  MediaIntentResult({
    required this.success,
    required this.affectedDevices,
    required this.failedDevices,
    this.skippedOfflineDevices,
    this.offlineDeviceIds,
    this.failedTargets,
    this.newVolume,
    this.isMuted,
  });

  factory MediaIntentResult.fromJson(Map<String, dynamic> json) {
    return MediaIntentResult(
      success: json['success'] as bool? ?? false,
      affectedDevices: json['affected_devices'] as int? ?? 0,
      failedDevices: json['failed_devices'] as int? ?? 0,
      skippedOfflineDevices: json['skipped_offline_devices'] as int?,
      offlineDeviceIds: (json['offline_device_ids'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      failedTargets: (json['failed_targets'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      newVolume: (json['new_volume'] as num?)?.toInt(),
      isMuted: json['is_muted'] as bool?,
    );
  }
}

/// Result of a suggestion feedback
class SuggestionFeedbackResult {
  final bool success;
  final bool intentExecuted;

  SuggestionFeedbackResult({
    required this.success,
    required this.intentExecuted,
  });

  factory SuggestionFeedbackResult.fromJson(Map<String, dynamic> json) {
    return SuggestionFeedbackResult(
      success: json['success'] as bool? ?? false,
      intentExecuted: json['intent_executed'] as bool? ?? false,
    );
  }
}
