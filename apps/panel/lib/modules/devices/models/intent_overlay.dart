/// Status of an intent
enum IntentStatus {
  pending,
  completedSuccess,
  completedPartial,
  completedFailed,
  expired,
}

/// Status of a single target in an intent result
enum IntentTargetStatus {
  success,
  failed,
  timeout,
  skipped,
}

/// Parse IntentStatus from string
IntentStatus parseIntentStatus(String status) {
  switch (status) {
    case 'pending':
      return IntentStatus.pending;
    case 'completed_success':
      return IntentStatus.completedSuccess;
    case 'completed_partial':
      return IntentStatus.completedPartial;
    case 'completed_failed':
      return IntentStatus.completedFailed;
    case 'expired':
      return IntentStatus.expired;
    default:
      return IntentStatus.pending;
  }
}

/// Parse IntentTargetStatus from string
IntentTargetStatus parseIntentTargetStatus(String status) {
  switch (status) {
    case 'success':
      return IntentTargetStatus.success;
    case 'failed':
      return IntentTargetStatus.failed;
    case 'timeout':
      return IntentTargetStatus.timeout;
    case 'skipped':
      return IntentTargetStatus.skipped;
    default:
      return IntentTargetStatus.failed;
  }
}

/// Represents a target device/channel/property affected by an intent
class IntentTarget {
  final String deviceId;
  final String? channelId;
  final String? propertyKey;

  IntentTarget({
    required this.deviceId,
    this.channelId,
    this.propertyKey,
  });

  factory IntentTarget.fromJson(Map<String, dynamic> json) {
    return IntentTarget(
      deviceId: json['deviceId'] as String,
      channelId: json['channelId'] as String?,
      propertyKey: json['propertyKey'] as String?,
    );
  }

  /// Create a unique key for indexing
  String get key => '$deviceId:${propertyKey ?? '*'}';
}

/// Represents the result for a specific target after intent completion
class IntentTargetResult {
  final String deviceId;
  final IntentTargetStatus status;
  final String? error;

  IntentTargetResult({
    required this.deviceId,
    required this.status,
    this.error,
  });

  factory IntentTargetResult.fromJson(Map<String, dynamic> json) {
    return IntentTargetResult(
      deviceId: json['deviceId'] as String,
      status: parseIntentTargetStatus(json['status'] as String),
      error: json['error'] as String?,
    );
  }

  bool get isSuccess => status == IntentTargetStatus.success;
  bool get isFailure => status == IntentTargetStatus.failed || status == IntentTargetStatus.timeout;
}

/// Optional scope context for an intent
class IntentScope {
  final String? roomId;
  final String? roleId;
  final String? sceneId;

  IntentScope({
    this.roomId,
    this.roleId,
    this.sceneId,
  });

  factory IntentScope.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return IntentScope();
    }
    return IntentScope(
      roomId: json['roomId'] as String?,
      roleId: json['roleId'] as String?,
      sceneId: json['sceneId'] as String?,
    );
  }
}

/// Represents an active intent from the backend
class IntentOverlay {
  final String intentId;
  final String type;
  final IntentScope scope;
  final List<IntentTarget> targets;
  final dynamic value;
  final IntentStatus status;
  final int ttlMs;
  final DateTime createdAt;
  final DateTime expiresAt;
  final DateTime? completedAt;
  final List<IntentTargetResult>? results;

  IntentOverlay({
    required this.intentId,
    required this.type,
    required this.scope,
    required this.targets,
    required this.value,
    required this.status,
    required this.ttlMs,
    required this.createdAt,
    required this.expiresAt,
    this.completedAt,
    this.results,
  });

  factory IntentOverlay.fromJson(Map<String, dynamic> json) {
    List<IntentTarget> targets = [];
    if (json['targets'] is List) {
      targets = (json['targets'] as List)
          .map((t) => IntentTarget.fromJson(t as Map<String, dynamic>))
          .toList();
    }

    List<IntentTargetResult>? results;
    if (json['results'] is List) {
      results = (json['results'] as List)
          .map((r) => IntentTargetResult.fromJson(r as Map<String, dynamic>))
          .toList();
    }

    return IntentOverlay(
      intentId: json['intentId'] as String,
      type: json['type'] as String,
      scope: IntentScope.fromJson(json['scope'] as Map<String, dynamic>?),
      targets: targets,
      value: json['value'],
      status: parseIntentStatus(json['status'] as String),
      ttlMs: json['ttlMs'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'] as String)
          : null,
      results: results,
    );
  }

  /// Check if this intent is still pending (active)
  bool get isPending => status == IntentStatus.pending;

  /// Check if this intent has any failures
  bool get hasFailures =>
      status == IntentStatus.completedFailed ||
      status == IntentStatus.completedPartial;

  /// Check if this intent fully succeeded
  bool get isFullySuccessful => status == IntentStatus.completedSuccess;
}
