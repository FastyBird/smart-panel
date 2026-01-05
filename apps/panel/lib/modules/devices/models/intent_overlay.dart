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

/// Represents a target affected by an intent.
/// Can be either a device target (deviceId/channelId/propertyId) or a scene target (sceneId).
class IntentTarget {
  final String? deviceId;
  final String? channelId;
  final String? propertyId;
  final String? sceneId;

  IntentTarget({
    this.deviceId,
    this.channelId,
    this.propertyId,
    this.sceneId,
  });

  factory IntentTarget.fromJson(Map<String, dynamic> json) {
    return IntentTarget(
      deviceId: json['device_id'] as String?,
      channelId: json['channel_id'] as String?,
      propertyId: json['property_id'] as String?,
      sceneId: json['scene_id'] as String?,
    );
  }

  /// Check if this is a device target
  bool get isDeviceTarget => deviceId != null;

  /// Check if this is a scene target
  bool get isSceneTarget => sceneId != null;

  /// Create a unique key for indexing.
  /// For device targets: "device:deviceId:channelId:propertyId"
  /// For scene targets: "scene:sceneId"
  String get key {
    if (sceneId != null) {
      return 'scene:$sceneId';
    }
    return 'device:${deviceId ?? '*'}:${channelId ?? '*'}:${propertyId ?? '*'}';
  }
}

/// Represents the result for a specific target after intent completion.
/// Mirrors IntentTarget structure - either device target or scene target.
class IntentTargetResult {
  final String? deviceId;
  final String? channelId;
  final String? propertyId;
  final String? sceneId;
  final IntentTargetStatus status;
  final String? error;

  IntentTargetResult({
    this.deviceId,
    this.channelId,
    this.propertyId,
    this.sceneId,
    required this.status,
    this.error,
  });

  factory IntentTargetResult.fromJson(Map<String, dynamic> json) {
    return IntentTargetResult(
      deviceId: json['device_id'] as String?,
      channelId: json['channel_id'] as String?,
      propertyId: json['property_id'] as String?,
      sceneId: json['scene_id'] as String?,
      status: parseIntentTargetStatus(json['status'] as String),
      error: json['error'] as String?,
    );
  }

  /// Check if this is a device target result
  bool get isDeviceTarget => deviceId != null;

  /// Check if this is a scene target result
  bool get isSceneTarget => sceneId != null;

  bool get isSuccess => status == IntentTargetStatus.success;
  bool get isFailure => status == IntentTargetStatus.failed || status == IntentTargetStatus.timeout;

  /// Create a unique key for indexing (mirrors IntentTarget.key)
  String get key {
    if (sceneId != null) {
      return 'scene:$sceneId';
    }
    return 'device:${deviceId ?? '*'}:${channelId ?? '*'}:${propertyId ?? '*'}';
  }
}

/// Optional scope context for an intent.
/// This represents "where it applies" - in SmartPanel this is always a Space.
class IntentScope {
  final String? spaceId;

  IntentScope({
    this.spaceId,
  });

  factory IntentScope.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return IntentScope();
    }
    return IntentScope(
      spaceId: json['space_id'] as String?,
    );
  }
}

/// Represents an active intent from the backend
class IntentOverlay {
  final String intentId;
  final String? requestId;
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
    this.requestId,
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
      intentId: json['intent_id'] as String,
      requestId: json['request_id'] as String?,
      type: json['type'] as String,
      scope: IntentScope.fromJson(json['scope'] as Map<String, dynamic>?),
      targets: targets,
      value: json['value'],
      status: parseIntentStatus(json['status'] as String),
      ttlMs: json['ttl_ms'] as int,
      createdAt: DateTime.parse(json['created_at'] as String),
      expiresAt: DateTime.parse(json['expires_at'] as String),
      completedAt: json['completed_at'] != null
          ? DateTime.parse(json['completed_at'] as String)
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

  /// Get the value for a specific device, channel, and property ID.
  /// If value is a Map, looks up by "device:deviceId:channelId:propertyId" composite key.
  /// Falls back to wildcard key (device:deviceId:*:propertyId) for local overlays with null channelId.
  /// Otherwise returns the raw value.
  dynamic getValueForProperty(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    if (value is Map<String, dynamic> && propertyId != null) {
      final valueMap = value as Map<String, dynamic>;

      // Try full composite key with device: prefix (device:deviceId:channelId:propertyId)
      if (channelId != null) {
        final fullKey = 'device:$deviceId:$channelId:$propertyId';
        if (valueMap.containsKey(fullKey)) {
          return valueMap[fullKey];
        }
      }

      // Try key with wildcard placeholder (device:deviceId:*:propertyId)
      // This matches the format used by createLocalOverlay when channelId is null
      final wildcardKey = 'device:$deviceId:*:$propertyId';
      if (valueMap.containsKey(wildcardKey)) {
        return valueMap[wildcardKey];
      }

      // Fall back to propertyId-only for backwards compatibility
      return valueMap[propertyId];
    }
    return value;
  }
}
