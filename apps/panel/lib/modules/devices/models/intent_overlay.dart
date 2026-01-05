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
  final String? propertyId;

  IntentTarget({
    required this.deviceId,
    this.channelId,
    this.propertyId,
  });

  factory IntentTarget.fromJson(Map<String, dynamic> json) {
    return IntentTarget(
      deviceId: json['device_id'] as String,
      channelId: json['channel_id'] as String?,
      propertyId: json['property_id'] as String?,
    );
  }

  /// Create a unique key for indexing (deviceId:channelId:propertyId)
  String get key => '$deviceId:${channelId ?? '*'}:${propertyId ?? '*'}';
}

/// Represents the result for a specific target after intent completion
class IntentTargetResult {
  final String deviceId;
  final String? channelId;
  final String? propertyId;
  final IntentTargetStatus status;
  final String? error;

  IntentTargetResult({
    required this.deviceId,
    this.channelId,
    this.propertyId,
    required this.status,
    this.error,
  });

  factory IntentTargetResult.fromJson(Map<String, dynamic> json) {
    return IntentTargetResult(
      deviceId: json['device_id'] as String,
      channelId: json['channel_id'] as String?,
      propertyId: json['property_id'] as String?,
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
      roomId: json['room_id'] as String?,
      roleId: json['role_id'] as String?,
      sceneId: json['scene_id'] as String?,
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
  /// If value is a Map, looks up by "deviceId:channelId:propertyId" composite key.
  /// Falls back to wildcard key (deviceId:*:propertyId) for local overlays with null channelId.
  /// Otherwise returns the raw value.
  dynamic getValueForProperty(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    if (value is Map<String, dynamic> && propertyId != null) {
      final valueMap = value as Map<String, dynamic>;

      // Try three-part composite key (deviceId:channelId:propertyId)
      if (channelId != null) {
        final threePartKey = '$deviceId:$channelId:$propertyId';
        if (valueMap.containsKey(threePartKey)) {
          return valueMap[threePartKey];
        }
      }

      // Try three-part key with wildcard placeholder (deviceId:*:propertyId)
      // This matches the format used by createLocalOverlay when channelId is null
      final wildcardKey = '$deviceId:*:$propertyId';
      if (valueMap.containsKey(wildcardKey)) {
        return valueMap[wildcardKey];
      }

      // Fall back to propertyId-only for backwards compatibility
      return valueMap[propertyId];
    }
    return value;
  }
}
