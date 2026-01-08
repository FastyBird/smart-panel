import 'package:fastybird_smart_panel/modules/intents/models/intents/intent.dart';

/// View representing an active intent for UI consumption
class IntentView {
  final IntentModel _model;

  IntentView({required IntentModel model}) : _model = model;

  IntentModel get model => _model;

  String get id => _model.id;
  String? get requestId => _model.requestId;
  IntentType get type => _model.type;
  IntentContext get context => _model.context;
  List<IntentTarget> get targets => _model.targets;
  dynamic get value => _model.value;
  IntentStatus get status => _model.status;
  int get ttlMs => _model.ttlMs;
  DateTime get createdAt => _model.createdAt ?? DateTime.now();
  DateTime get expiresAt => _model.expiresAt;
  DateTime? get completedAt => _model.completedAt;
  List<IntentTargetResult>? get results => _model.results;
  bool get isLocal => _model.isLocal;

  /// Check if this intent is still pending (active)
  bool get isPending => _model.isPending;

  /// Check if this intent has any failures
  bool get hasFailures => _model.hasFailures;

  /// Check if this intent fully succeeded
  bool get isFullySuccessful => _model.isFullySuccessful;

  /// Check if this intent has expired
  bool get isExpired => _model.isExpired;

  /// Time remaining until expiration in milliseconds
  int get remainingMs {
    final remaining = _model.expiresAt.difference(DateTime.now()).inMilliseconds;
    return remaining > 0 ? remaining : 0;
  }

  /// Progress ratio (0.0 to 1.0) for visual indicators
  double get progressRatio {
    final created = _model.createdAt ?? DateTime.now();
    final elapsed = DateTime.now().difference(created).inMilliseconds.toDouble();
    final total = _model.ttlMs.toDouble();
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
    return _model.getValueForProperty(deviceId, channelId, propertyId);
  }

  /// Check if this intent affects a specific device property
  bool affectsProperty(String deviceId, String? channelId, String? propertyId) {
    return _model.targets.any((t) =>
        t.isDeviceTarget &&
        t.deviceId == deviceId &&
        (channelId == null || t.channelId == channelId) &&
        (propertyId == null || t.propertyId == propertyId));
  }

  /// Check if this intent affects a specific scene
  bool affectsScene(String sceneId) {
    return _model.targets.any((t) => t.isSceneTarget && t.sceneId == sceneId);
  }

  /// Get the result for a specific target key
  IntentTargetResult? getResultForKey(String key) {
    return _model.results?.firstWhere(
      (r) => r.key == key,
      orElse: () => IntentTargetResult(
        status: IntentTargetStatus.skipped,
      ),
    );
  }
}
