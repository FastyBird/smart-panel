import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart';

/// Result of a lighting intent execution
class LightingIntentResult {
  final bool success;
  final int affectedDevices;
  final int failedDevices;

  LightingIntentResult({
    required this.success,
    required this.affectedDevices,
    required this.failedDevices,
  });

  factory LightingIntentResult.fromJson(Map<String, dynamic> json) {
    return LightingIntentResult(
      success: json['success'] as bool? ?? false,
      affectedDevices: json['affected_devices'] as int? ?? 0,
      failedDevices: json['failed_devices'] as int? ?? 0,
    );
  }
}

/// Result of a climate intent execution
class ClimateIntentResult {
  final bool success;
  final int affectedDevices;
  final int failedDevices;
  final ClimateMode? mode;
  final double? newSetpoint;
  final double? heatingSetpoint;
  final double? coolingSetpoint;

  ClimateIntentResult({
    required this.success,
    required this.affectedDevices,
    required this.failedDevices,
    this.mode,
    this.newSetpoint,
    this.heatingSetpoint,
    this.coolingSetpoint,
  });

  factory ClimateIntentResult.fromJson(Map<String, dynamic> json) {
    return ClimateIntentResult(
      success: json['success'] as bool? ?? false,
      affectedDevices: json['affected_devices'] as int? ?? 0,
      failedDevices: json['failed_devices'] as int? ?? 0,
      mode: parseClimateMode(json['mode'] as String?),
      newSetpoint: (json['new_setpoint'] as num?)?.toDouble(),
      heatingSetpoint: (json['heating_setpoint'] as num?)?.toDouble(),
      coolingSetpoint: (json['cooling_setpoint'] as num?)?.toDouble(),
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
