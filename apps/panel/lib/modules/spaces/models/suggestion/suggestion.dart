import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';

/// Suggestion type enum
enum SuggestionType {
  lightingRelax,
  lightingNight,
  lightingOff,
}

/// Suggestion feedback enum
enum SuggestionFeedback {
  applied,
  dismissed,
}

/// Parse SuggestionType from string
SuggestionType? parseSuggestionType(String? type) {
  if (type == null) return null;
  switch (type) {
    case 'lighting_relax':
      return SuggestionType.lightingRelax;
    case 'lighting_night':
      return SuggestionType.lightingNight;
    case 'lighting_off':
      return SuggestionType.lightingOff;
    default:
      return null;
  }
}

/// Convert SuggestionType to API string
String suggestionTypeToString(SuggestionType type) {
  switch (type) {
    case SuggestionType.lightingRelax:
      return 'lighting_relax';
    case SuggestionType.lightingNight:
      return 'lighting_night';
    case SuggestionType.lightingOff:
      return 'lighting_off';
  }
}

/// Convert SuggestionFeedback to API string
String suggestionFeedbackToString(SuggestionFeedback feedback) {
  switch (feedback) {
    case SuggestionFeedback.applied:
      return 'applied';
    case SuggestionFeedback.dismissed:
      return 'dismissed';
  }
}

/// Represents a suggestion for a space
class SuggestionModel {
  final SuggestionType type;
  final String title;
  final String? reason;
  final LightingMode? lightingMode;

  SuggestionModel({
    required this.type,
    required this.title,
    this.reason,
    this.lightingMode,
  });

  /// Check if this is a lighting suggestion
  bool get isLightingSuggestion => lightingMode != null;

  factory SuggestionModel.fromJson(Map<String, dynamic> json) {
    return SuggestionModel(
      type: parseSuggestionType(json['type'] as String?) ??
          SuggestionType.lightingOff,
      title: json['title'] as String? ?? '',
      reason: json['reason'] as String?,
      lightingMode: parseLightingMode(json['lighting_mode'] as String?),
    );
  }
}
