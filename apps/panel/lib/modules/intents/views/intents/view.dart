import 'package:fastybird_smart_panel/modules/intents/models/intents/intent.dart';

/// View representing an active intent for UI consumption
class IntentView {
  final String _id;
  final String? _requestId;
  final IntentType _type;
  final IntentScope _scope;
  final IntentContext _context;
  final List<IntentTarget> _targets;
  final dynamic _value;
  final IntentStatus _status;
  final int _ttlMs;
  final DateTime _createdAt;
  final DateTime _expiresAt;
  final DateTime? _completedAt;
  final List<IntentTargetResult>? _results;
  final bool _isLocal;

  IntentView({
    required String id,
    String? requestId,
    required IntentType type,
    required IntentScope scope,
    required IntentContext context,
    required List<IntentTarget> targets,
    required dynamic value,
    required IntentStatus status,
    required int ttlMs,
    required DateTime createdAt,
    required DateTime expiresAt,
    DateTime? completedAt,
    List<IntentTargetResult>? results,
    required bool isLocal,
  })  : _id = id,
        _requestId = requestId,
        _type = type,
        _scope = scope,
        _context = context,
        _targets = targets,
        _value = value,
        _status = status,
        _ttlMs = ttlMs,
        _createdAt = createdAt,
        _expiresAt = expiresAt,
        _completedAt = completedAt,
        _results = results,
        _isLocal = isLocal;

  String get id => _id;
  String? get requestId => _requestId;
  IntentType get type => _type;
  IntentScope get scope => _scope;
  IntentContext get context => _context;
  List<IntentTarget> get targets => _targets;
  dynamic get value => _value;
  IntentStatus get status => _status;
  int get ttlMs => _ttlMs;
  DateTime get createdAt => _createdAt;
  DateTime get expiresAt => _expiresAt;
  DateTime? get completedAt => _completedAt;
  List<IntentTargetResult>? get results => _results;
  bool get isLocal => _isLocal;

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

  /// Time remaining until expiration in milliseconds
  int get remainingMs {
    final remaining = _expiresAt.difference(DateTime.now()).inMilliseconds;
    return remaining > 0 ? remaining : 0;
  }

  /// Progress ratio (0.0 to 1.0) for visual indicators
  double get progressRatio {
    final elapsed =
        DateTime.now().difference(_createdAt).inMilliseconds.toDouble();
    final total = _ttlMs.toDouble();
    if (total <= 0) return 1.0;
    final ratio = elapsed / total;
    return ratio.clamp(0.0, 1.0);
  }

  /// Get the value for a specific device, channel, and property ID.
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

  /// Check if this intent affects a specific device property
  bool affectsProperty(String deviceId, String? channelId, String? propertyId) {
    return _targets.any((t) =>
        t.isDeviceTarget &&
        t.deviceId == deviceId &&
        (channelId == null || t.channelId == channelId) &&
        (propertyId == null || t.propertyId == propertyId));
  }

  /// Check if this intent affects a specific scene
  bool affectsScene(String sceneId) {
    return _targets.any((t) => t.isSceneTarget && t.sceneId == sceneId);
  }

  /// Get the result for a specific target key
  IntentTargetResult? getResultForKey(String key) {
    return _results?.firstWhere(
      (r) => r.key == key,
      orElse: () => IntentTargetResult(
        status: IntentTargetStatus.skipped,
      ),
    );
  }
}
