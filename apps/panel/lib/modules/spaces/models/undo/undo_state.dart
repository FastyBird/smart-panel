/// Intent category for undo
enum IntentCategory {
  lighting,
  climate,
}

/// Parse IntentCategory from string
IntentCategory? parseIntentCategory(String? category) {
  if (category == null) return null;
  switch (category) {
    case 'lighting':
      return IntentCategory.lighting;
    case 'climate':
      return IntentCategory.climate;
    default:
      return null;
  }
}

/// Represents the current undo state for a space
class UndoStateModel {
  final bool canUndo;
  final String? actionDescription;
  final IntentCategory? intentCategory;
  final DateTime? capturedAt;
  final int? expiresInSeconds;

  UndoStateModel({
    required this.canUndo,
    this.actionDescription,
    this.intentCategory,
    this.capturedAt,
    this.expiresInSeconds,
  });

  /// Check if undo is for lighting
  bool get isLightingUndo => intentCategory == IntentCategory.lighting;

  /// Check if undo is for climate
  bool get isClimateUndo => intentCategory == IntentCategory.climate;

  /// Get remaining time for undo in seconds
  int? get remainingSeconds {
    if (expiresInSeconds == null || capturedAt == null) return null;
    final elapsed = DateTime.now().difference(capturedAt!).inSeconds;
    final remaining = expiresInSeconds! - elapsed;
    return remaining > 0 ? remaining : 0;
  }

  /// Check if undo is still valid (not expired)
  bool get isValid {
    final remaining = remainingSeconds;
    return canUndo && (remaining == null || remaining > 0);
  }

  factory UndoStateModel.fromJson(Map<String, dynamic> json) {
    return UndoStateModel(
      canUndo: json['can_undo'] as bool? ?? false,
      actionDescription: json['action_description'] as String?,
      intentCategory: parseIntentCategory(json['intent_category'] as String?),
      capturedAt: json['captured_at'] != null
          ? DateTime.parse(json['captured_at'] as String)
          : null,
      expiresInSeconds: json['expires_in_seconds'] as int?,
    );
  }

  /// Create an empty state (no undo available)
  factory UndoStateModel.empty() {
    return UndoStateModel(canUndo: false);
  }
}

/// Result of an undo operation
class UndoResultModel {
  final bool success;
  final int restoredDevices;
  final int failedDevices;
  final String message;

  UndoResultModel({
    required this.success,
    required this.restoredDevices,
    required this.failedDevices,
    required this.message,
  });

  factory UndoResultModel.fromJson(Map<String, dynamic> json) {
    return UndoResultModel(
      success: json['success'] as bool? ?? false,
      restoredDevices: json['restored_devices'] as int? ?? 0,
      failedDevices: json['failed_devices'] as int? ?? 0,
      message: json['message'] as String? ?? '',
    );
  }
}
