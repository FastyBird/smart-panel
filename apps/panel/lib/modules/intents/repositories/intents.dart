import 'dart:async';

import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/intents/models/intents/intent.dart';

/// Repository for managing active intents.
///
/// Intents are received via Socket.IO events and stored in-memory.
/// Unlike other repositories, there's no REST API for intents since
/// they are ephemeral (short-lived) and managed by the backend.
class IntentsRepository extends ChangeNotifier {
  /// Active intents indexed by intentId
  final Map<String, IntentModel> _intents = {};

  /// Quick lookup: target key -> intentId
  /// Device targets: "device:deviceId:channelId:propertyId" (using * for null values)
  /// Scene targets: "scene:sceneId"
  final Map<String, String> _targetIndex = {};

  /// Recent completion results for showing failure indicators
  /// Uses same key format as _targetIndex
  final Map<String, IntentTargetResult> _recentResults = {};

  /// Timers for local intent expiration, keyed by intentId
  final Map<String, Timer> _expirationTimers = {};

  /// Duration to keep failure indicators visible
  static const Duration failureIndicatorDuration = Duration(seconds: 10);

  /// Timer for cleaning up old failure indicators
  Timer? _resultCleanupTimer;

  /// Track if the repository has been disposed
  bool _isDisposed = false;

  /// Get all active intents
  List<IntentModel> get intents => _intents.values.toList();

  /// Get count of active intents
  int get activeCount => _intents.length;

  /// Get an intent by ID
  IntentModel? getIntent(String id) => _intents[id];

  /// Check if a property is currently locked by an active intent
  bool isPropertyLocked(String deviceId, String? channelId, String? propertyId) {
    final key = 'device:$deviceId:${channelId ?? '*'}:${propertyId ?? '*'}';
    return _targetIndex.containsKey(key);
  }

  /// Check if a scene is currently locked by an active intent
  bool isSceneLocked(String sceneId) {
    final key = 'scene:$sceneId';
    return _targetIndex.containsKey(key);
  }

  /// Check if a space is currently locked by an active space-level intent
  bool isSpaceLocked(String spaceId) {
    final key = 'space:$spaceId';
    return _targetIndex.containsKey(key);
  }

  /// Check if any property on a device is locked
  bool isDeviceLocked(String deviceId) {
    return _targetIndex.keys.any((key) => key.startsWith('device:$deviceId:'));
  }

  /// Get the intent ID for a locked property
  String? getIntentIdForProperty(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = 'device:$deviceId:${channelId ?? '*'}:${propertyId ?? '*'}';
    return _targetIndex[key];
  }

  /// Get the intent ID for a locked scene
  String? getIntentIdForScene(String sceneId) {
    final key = 'scene:$sceneId';
    return _targetIndex[key];
  }

  /// Get the intent ID for a locked space
  String? getIntentIdForSpace(String spaceId) {
    final key = 'space:$spaceId';
    return _targetIndex[key];
  }

  /// Get the active intent affecting a device
  IntentModel? getActiveIntentForDevice(String deviceId) {
    for (final intent in _intents.values) {
      if (intent.targets.any((t) => t.deviceId == deviceId)) {
        return intent;
      }
    }
    return null;
  }

  /// Get the active intent affecting a scene
  IntentModel? getActiveIntentForScene(String sceneId) {
    for (final intent in _intents.values) {
      if (intent.targets.any((t) => t.sceneId == sceneId)) {
        return intent;
      }
    }
    return null;
  }

  /// Get the active intent affecting a space
  IntentModel? getActiveIntentForSpace(String spaceId) {
    for (final intent in _intents.values) {
      if (intent.targets.any((t) => t.spaceId == spaceId && t.isSpaceTarget)) {
        return intent;
      }
    }
    return null;
  }

  /// Get recent failure result for a specific property
  IntentTargetResult? getFailureResultForProperty(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = 'device:$deviceId:${channelId ?? '*'}:${propertyId ?? '*'}';
    final result = _recentResults[key];
    if (result != null && result.isFailure) {
      return result;
    }
    return null;
  }

  /// Get any recent failure result for a device
  IntentTargetResult? getAnyFailureResultForDevice(String deviceId) {
    for (final entry in _recentResults.entries) {
      if (entry.key.startsWith('device:$deviceId:') && entry.value.isFailure) {
        return entry.value;
      }
    }
    return null;
  }

  /// Get recent failure result for a scene
  IntentTargetResult? getFailureResultForScene(String sceneId) {
    final key = 'scene:$sceneId';
    final result = _recentResults[key];
    if (result != null && result.isFailure) {
      return result;
    }
    return null;
  }

  /// Check if a device has a recent failure (any property)
  bool hasRecentFailure(String deviceId) {
    return getAnyFailureResultForDevice(deviceId) != null;
  }

  /// Check if a scene has a recent failure
  bool hasSceneRecentFailure(String sceneId) {
    return getFailureResultForScene(sceneId) != null;
  }

  /// Insert or update an intent
  void insert(IntentModel intent) {
    // Remove any local overlays for the same targets
    _removeLocalIntentsForTargets(intent.targets);

    // Also remove local space intents if this backend intent has same spaceId
    final spaceId = intent.context.spaceId;
    if (spaceId != null && !intent.id.startsWith('local_')) {
      _removeLocalSpaceIntent(spaceId);
    }

    _intents[intent.id] = intent;

    for (final target in intent.targets) {
      _targetIndex[target.key] = intent.id;
    }

    if (kDebugMode) {
      debugPrint('[INTENTS MODULE][REPOSITORY] Intent inserted: ${intent.id}');
    }

    notifyListeners();
  }

  /// Insert an intent from raw JSON data
  void insertFromJson(Map<String, dynamic> json) {
    try {
      final intent = IntentModel.fromJson(json);
      insert(intent);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[INTENTS MODULE][REPOSITORY] Failed to parse intent: $e',
        );
      }
    }
  }

  /// Create a local optimistic intent
  IntentModel createLocalIntent({
    required String deviceId,
    required String? channelId,
    required String? propertyId,
    required dynamic value,
    int ttlMs = 3000,
  }) {
    final intent = IntentModel.createLocal(
      deviceId: deviceId,
      channelId: channelId,
      propertyId: propertyId,
      value: value,
      ttlMs: ttlMs,
    );

    insert(intent);

    // Schedule local expiration
    _scheduleExpiration(intent.id, Duration(milliseconds: ttlMs));

    if (kDebugMode) {
      debugPrint(
        '[INTENTS MODULE][REPOSITORY] Created local intent ${intent.id} for device:$deviceId:$channelId:$propertyId',
      );
    }

    return intent;
  }

  /// Create a local optimistic intent for space-level commands
  IntentModel createLocalSpaceIntent({
    required String spaceId,
    required IntentType type,
    required dynamic value,
    int ttlMs = 5000, // Space commands may take longer (multi-device)
  }) {
    final intent = IntentModel.createLocalForSpace(
      spaceId: spaceId,
      type: type,
      value: value,
      ttlMs: ttlMs,
    );

    insert(intent);

    // Schedule local expiration
    _scheduleExpiration(intent.id, Duration(milliseconds: ttlMs));

    if (kDebugMode) {
      debugPrint(
        '[INTENTS MODULE][REPOSITORY] Created local space intent ${intent.id} for space:$spaceId type:$type',
      );
    }

    return intent;
  }

  /// Remove an intent by ID
  void remove(String id) {
    _cancelExpiration(id);

    final intent = _intents.remove(id);

    if (intent != null) {
      for (final target in intent.targets) {
        if (_targetIndex[target.key] == id) {
          _targetIndex.remove(target.key);
        }
      }

      if (kDebugMode) {
        debugPrint('[INTENTS MODULE][REPOSITORY] Intent removed: $id');
      }

      notifyListeners();
    }
  }

  /// Store results from a completed intent
  void storeResults(String intentId, List<IntentTargetResult> results) {
    for (final result in results) {
      _recentResults[result.key] = result;
    }

    _scheduleResultCleanup();

    if (kDebugMode) {
      debugPrint(
        '[INTENTS MODULE][REPOSITORY] Stored ${results.length} results for intent $intentId',
      );
    }

    notifyListeners();
  }

  /// Store results from raw JSON payload
  void storeResultsFromJson(Map<String, dynamic> payload) {
    if (payload['results'] is List) {
      final results = <IntentTargetResult>[];
      for (final result in payload['results'] as List) {
        try {
          results.add(
            IntentTargetResult.fromJson(result as Map<String, dynamic>),
          );
        } catch (e) {
          // Ignore parse errors for individual results
        }
      }
      if (results.isNotEmpty) {
        storeResults(payload['intent_id'] as String, results);
      }
    }
  }

  /// Clear all intents and results (e.g., on disconnect)
  void clearAll() {
    // Cancel all expiration timers
    for (final timer in _expirationTimers.values) {
      timer.cancel();
    }
    _expirationTimers.clear();

    _intents.clear();
    _targetIndex.clear();
    _recentResults.clear();

    if (kDebugMode) {
      debugPrint('[INTENTS MODULE][REPOSITORY] Cleared all intents');
    }

    if (!_isDisposed) {
      notifyListeners();
    }
  }

  /// Schedule expiration for an intent
  void scheduleExpiration(String intentId, Duration duration) {
    _scheduleExpiration(intentId, duration);
  }

  void _scheduleExpiration(String intentId, Duration duration) {
    // Cancel any existing timer for this intent
    _expirationTimers[intentId]?.cancel();

    _expirationTimers[intentId] = Timer(duration, () {
      if (_isDisposed) return;

      if (_intents.containsKey(intentId)) {
        if (kDebugMode) {
          debugPrint(
            '[INTENTS MODULE][REPOSITORY] Local expiration triggered for $intentId',
          );
        }
        remove(intentId);
      }

      _expirationTimers.remove(intentId);
    });
  }

  /// Cancel expiration timer for an intent
  void _cancelExpiration(String intentId) {
    _expirationTimers[intentId]?.cancel();
    _expirationTimers.remove(intentId);
  }

  /// Remove local intents that overlap with the given targets
  void _removeLocalIntentsForTargets(List<IntentTarget> targets) {
    final targetKeys = targets.map((t) => t.key).toSet();

    final localIntentIds = <String>{};
    for (final key in targetKeys) {
      final intentId = _targetIndex[key];
      if (intentId != null && intentId.startsWith('local_')) {
        localIntentIds.add(intentId);
      }
    }

    for (final intentId in localIntentIds) {
      remove(intentId);
    }
  }

  /// Remove local space intent for a given spaceId
  void _removeLocalSpaceIntent(String spaceId) {
    // Find and remove any local space intent with matching spaceId
    final localSpaceIntentIds = <String>[];
    for (final entry in _intents.entries) {
      if (entry.key.startsWith('local_space_') &&
          entry.value.context.spaceId == spaceId) {
        localSpaceIntentIds.add(entry.key);
      }
    }

    for (final intentId in localSpaceIntentIds) {
      if (kDebugMode) {
        debugPrint(
          '[INTENTS MODULE][REPOSITORY] Removing local space intent $intentId (replaced by backend intent)',
        );
      }
      remove(intentId);
    }
  }

  /// Schedule cleanup of old failure indicators
  void _scheduleResultCleanup() {
    _resultCleanupTimer?.cancel();
    _resultCleanupTimer = Timer(failureIndicatorDuration, () {
      if (_isDisposed) return;

      _recentResults.clear();
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _isDisposed = true;

    // Cancel all expiration timers
    for (final timer in _expirationTimers.values) {
      timer.cancel();
    }
    _expirationTimers.clear();

    _resultCleanupTimer?.cancel();

    super.dispose();
  }
}
