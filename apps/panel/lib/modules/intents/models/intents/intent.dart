import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/intents/models/model.dart';

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

/// Type of intent action
enum IntentType {
  deviceSetProperty,
  sceneRun,
}

/// Origin of the intent (where it was initiated from)
enum IntentOrigin {
  panel,
  admin,
  api,
  system,
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

/// Parse IntentType from string
IntentType parseIntentType(String type) {
  switch (type) {
    case 'device.setProperty':
      return IntentType.deviceSetProperty;
    case 'scene.run':
      return IntentType.sceneRun;
    default:
      return IntentType.deviceSetProperty;
  }
}

/// Parse IntentOrigin from string
IntentOrigin? parseIntentOrigin(String? origin) {
  if (origin == null) return null;
  switch (origin) {
    case 'panel':
      return IntentOrigin.panel;
    case 'admin':
      return IntentOrigin.admin;
    case 'api':
      return IntentOrigin.api;
    case 'system':
      return IntentOrigin.system;
    default:
      return null;
  }
}

/// Represents a target affected by an intent.
/// Can be either a device target (deviceId/channelId/propertyId) or a scene target (sceneId).
class IntentTarget {
  final String? _deviceId;
  final String? _channelId;
  final String? _propertyId;
  final String? _sceneId;

  IntentTarget({
    String? deviceId,
    String? channelId,
    String? propertyId,
    String? sceneId,
  })  : _deviceId = deviceId != null ? UuidUtils.validateUuid(deviceId) : null,
        _channelId =
            channelId != null ? UuidUtils.validateUuid(channelId) : null,
        _propertyId =
            propertyId != null ? UuidUtils.validateUuid(propertyId) : null,
        _sceneId = sceneId != null ? UuidUtils.validateUuid(sceneId) : null;

  String? get deviceId => _deviceId;
  String? get channelId => _channelId;
  String? get propertyId => _propertyId;
  String? get sceneId => _sceneId;

  /// Check if this is a device target
  bool get isDeviceTarget => _deviceId != null;

  /// Check if this is a scene target
  bool get isSceneTarget => _sceneId != null;

  /// Create a unique key for indexing.
  /// For device targets: "device:deviceId:channelId:propertyId" (using * for null values)
  /// For scene targets: "scene:sceneId"
  String get key {
    if (_sceneId != null) {
      return 'scene:$_sceneId';
    }
    return 'device:${_deviceId ?? '*'}:${_channelId ?? '*'}:${_propertyId ?? '*'}';
  }

  factory IntentTarget.fromJson(Map<String, dynamic> json) {
    return IntentTarget(
      deviceId: json['device_id'] as String?,
      channelId: json['channel_id'] as String?,
      propertyId: json['property_id'] as String?,
      sceneId: json['scene_id'] as String?,
    );
  }
}

/// Represents the result for a specific target after intent completion.
/// Mirrors IntentTarget structure - either device target or scene target.
class IntentTargetResult {
  final String? _deviceId;
  final String? _channelId;
  final String? _propertyId;
  final String? _sceneId;
  final IntentTargetStatus _status;
  final String? _error;

  IntentTargetResult({
    String? deviceId,
    String? channelId,
    String? propertyId,
    String? sceneId,
    required IntentTargetStatus status,
    String? error,
  })  : _deviceId = deviceId != null ? UuidUtils.validateUuid(deviceId) : null,
        _channelId =
            channelId != null ? UuidUtils.validateUuid(channelId) : null,
        _propertyId =
            propertyId != null ? UuidUtils.validateUuid(propertyId) : null,
        _sceneId = sceneId != null ? UuidUtils.validateUuid(sceneId) : null,
        _status = status,
        _error = error;

  String? get deviceId => _deviceId;
  String? get channelId => _channelId;
  String? get propertyId => _propertyId;
  String? get sceneId => _sceneId;
  IntentTargetStatus get status => _status;
  String? get error => _error;

  /// Check if this is a device target result
  bool get isDeviceTarget => _deviceId != null;

  /// Check if this is a scene target result
  bool get isSceneTarget => _sceneId != null;

  bool get isSuccess => _status == IntentTargetStatus.success;

  bool get isFailure =>
      _status == IntentTargetStatus.failed ||
      _status == IntentTargetStatus.timeout;

  /// Create a unique key for indexing (mirrors IntentTarget.key)
  String get key {
    if (_sceneId != null) {
      return 'scene:$_sceneId';
    }
    return 'device:${_deviceId ?? '*'}:${_channelId ?? '*'}:${_propertyId ?? '*'}';
  }

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
}

/// Optional scope context for an intent.
/// This represents "where it applies" - in SmartPanel this is always a Space.
class IntentScope {
  final String? _spaceId;

  IntentScope({
    String? spaceId,
  }) : _spaceId = spaceId != null ? UuidUtils.validateUuid(spaceId) : null;

  String? get spaceId => _spaceId;

  factory IntentScope.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return IntentScope();
    }
    return IntentScope(
      spaceId: json['space_id'] as String?,
    );
  }
}

/// Context information about where and how the intent was initiated.
/// This is NOT authoritative business logic; it is metadata for UI/overlay/debugging.
class IntentContext {
  final IntentOrigin? _origin;
  final String? _displayId;
  final String? _spaceId;
  final String? _roleKey;
  final Map<String, dynamic>? _extra;

  IntentContext({
    IntentOrigin? origin,
    String? displayId,
    String? spaceId,
    String? roleKey,
    Map<String, dynamic>? extra,
  })  : _origin = origin,
        _displayId =
            displayId != null ? UuidUtils.validateUuid(displayId) : null,
        _spaceId = spaceId != null ? UuidUtils.validateUuid(spaceId) : null,
        _roleKey = roleKey,
        _extra = extra;

  IntentOrigin? get origin => _origin;
  String? get displayId => _displayId;
  String? get spaceId => _spaceId;
  String? get roleKey => _roleKey;
  Map<String, dynamic>? get extra => _extra;

  factory IntentContext.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return IntentContext();
    }
    return IntentContext(
      origin: parseIntentOrigin(json['origin'] as String?),
      displayId: json['display_id'] as String?,
      spaceId: json['space_id'] as String?,
      roleKey: json['role_key'] as String?,
      extra: json['extra'] as Map<String, dynamic>?,
    );
  }
}

/// Represents an active intent from the backend
class IntentModel extends Model {
  final String? _requestId;
  final IntentType _type;
  final IntentScope _scope;
  final IntentContext _context;
  final List<IntentTarget> _targets;
  final dynamic _value;
  final IntentStatus _status;
  final int _ttlMs;
  final DateTime _expiresAt;
  final DateTime? _completedAt;
  final List<IntentTargetResult>? _results;

  IntentModel({
    required super.id,
    String? requestId,
    required IntentType type,
    required IntentScope scope,
    required IntentContext context,
    required List<IntentTarget> targets,
    required dynamic value,
    required IntentStatus status,
    required int ttlMs,
    required super.createdAt,
    required DateTime expiresAt,
    DateTime? completedAt,
    List<IntentTargetResult>? results,
  })  : _requestId =
            requestId != null ? UuidUtils.validateUuid(requestId) : null,
        _type = type,
        _scope = scope,
        _context = context,
        _targets = targets,
        _value = value,
        _status = status,
        _ttlMs = ttlMs,
        _expiresAt = expiresAt,
        _completedAt = completedAt,
        _results = results;

  String? get requestId => _requestId;
  IntentType get type => _type;
  IntentScope get scope => _scope;
  IntentContext get context => _context;
  List<IntentTarget> get targets => _targets;
  dynamic get value => _value;
  IntentStatus get status => _status;
  int get ttlMs => _ttlMs;
  DateTime get expiresAt => _expiresAt;
  DateTime? get completedAt => _completedAt;
  List<IntentTargetResult>? get results => _results;

  /// Check if this intent is still pending (active)
  bool get isPending => _status == IntentStatus.pending;

  /// Check if this intent has any failures
  bool get hasFailures =>
      _status == IntentStatus.completedFailed ||
      _status == IntentStatus.completedPartial;

  /// Check if this intent fully succeeded
  bool get isFullySuccessful => _status == IntentStatus.completedSuccess;

  /// Check if this intent has expired
  bool get isExpired => DateTime.now().isAfter(_expiresAt);

  /// Get the value for a specific device, channel, and property ID.
  /// If value is a Map, looks up by "device:deviceId:channelId:propertyId" composite key.
  /// Falls back to wildcard key (device:deviceId:*:propertyId) for local overlays.
  /// Otherwise returns the raw value.
  dynamic getValueForProperty(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    if (_value is Map<String, dynamic> && propertyId != null) {
      final valueMap = _value;

      // Try full composite key with device: prefix
      if (channelId != null) {
        final fullKey = 'device:$deviceId:$channelId:$propertyId';
        if (valueMap.containsKey(fullKey)) {
          return valueMap[fullKey];
        }
      }

      // Try key with wildcard placeholder
      final wildcardKey = 'device:$deviceId:*:$propertyId';
      if (valueMap.containsKey(wildcardKey)) {
        return valueMap[wildcardKey];
      }

      // Fall back to propertyId-only for backwards compatibility
      return valueMap[propertyId];
    }
    return _value;
  }

  factory IntentModel.fromJson(Map<String, dynamic> json) {
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

    return IntentModel(
      id: json['intent_id'] as String,
      requestId: json['request_id'] as String?,
      type: parseIntentType(json['type'] as String),
      scope: IntentScope.fromJson(json['scope'] as Map<String, dynamic>?),
      context: IntentContext.fromJson(json['context'] as Map<String, dynamic>?),
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

  /// Create a local optimistic intent (before backend confirmation)
  factory IntentModel.createLocal({
    required String deviceId,
    required String? channelId,
    required String? propertyId,
    required dynamic value,
    int ttlMs = 3000,
  }) {
    final now = DateTime.now();
    final localIntentId = 'local_${deviceId}_${now.millisecondsSinceEpoch}';

    // Build value map for consistency with backend format
    final valueMap = propertyId != null
        ? {'device:$deviceId:${channelId ?? '*'}:$propertyId': value}
        : value;

    return IntentModel(
      id: localIntentId,
      type: IntentType.deviceSetProperty,
      scope: IntentScope(),
      context: IntentContext(origin: IntentOrigin.panel),
      targets: [
        IntentTarget(
          deviceId: deviceId,
          channelId: channelId,
          propertyId: propertyId,
        ),
      ],
      value: valueMap,
      status: IntentStatus.pending,
      ttlMs: ttlMs,
      createdAt: now,
      expiresAt: now.add(Duration(milliseconds: ttlMs)),
    );
  }

  /// Check if this is a local (optimistic) intent
  bool get isLocal => id.startsWith('local_');
}
