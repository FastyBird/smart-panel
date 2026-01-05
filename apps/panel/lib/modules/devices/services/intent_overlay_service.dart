import 'dart:async';

import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/models/intent_overlay.dart';

/// Constants for intent socket events
class IntentEventConstants {
  static const String moduleWildcardEvent = 'IntentsModule.*';
  static const String intentCreatedEvent = 'IntentsModule.Intent.Created';
  static const String intentCompletedEvent = 'IntentsModule.Intent.Completed';
  static const String intentExpiredEvent = 'IntentsModule.Intent.Expired';
}

/// Service that tracks active intents and provides overlay values for UI anti-jitter.
///
/// When the user interacts with a device (e.g., changes brightness), an intent is created
/// on the backend. This service:
/// 1. Receives intent lifecycle events via Socket.IO
/// 2. Tracks which device properties are "locked" by active intents
/// 3. Provides overlay values so the UI shows the intended value instead of outdated state
/// 4. Clears overlays when intents complete or expire
///
/// This prevents UI jitter where the slider would jump back to the old value
/// before the device reports the new state.
class IntentOverlayService extends ChangeNotifier {
  final SocketService _socketService;

  /// Active intents indexed by intentId
  final Map<String, IntentOverlay> _activeIntents = {};

  /// Quick lookup: target key -> intentId
  /// Device targets: "device:deviceId:channelId:propertyId" (using * for null values)
  /// Scene targets: "scene:sceneId"
  final Map<String, String> _targetIndex = {};

  /// Recent completion results for showing failure indicators
  /// Uses same key format as _targetIndex
  final Map<String, IntentTargetResult> _recentResults = {};

  /// Duration to keep failure indicators visible
  static const Duration _failureIndicatorDuration = Duration(seconds: 10);

  /// Timer for cleaning up old failure indicators
  Timer? _cleanupTimer;

  /// Timers for local intent expiration, keyed by intentId
  final Map<String, Timer> _expirationTimers = {};

  /// Track if the service has been disposed
  bool _isDisposed = false;

  IntentOverlayService({
    required SocketService socketService,
  }) : _socketService = socketService;

  /// Initialize the service and subscribe to socket events
  void initialize() {
    _socketService.registerEventHandler(
      IntentEventConstants.moduleWildcardEvent,
      _handleSocketEvent,
    );

    // Listen for socket disconnects to clear stale intents
    _socketService.addConnectionListener(_handleConnectionChange);

    if (kDebugMode) {
      debugPrint('[INTENT_OVERLAY] Service initialized');
    }
  }

  /// Handle socket connection state changes
  void _handleConnectionChange(bool isConnected) {
    if (!isConnected) {
      // Socket disconnected - clear all intents to prevent stale locks
      if (kDebugMode) {
        debugPrint('[INTENT_OVERLAY] Socket disconnected, clearing all intents');
      }
      clearAll();
    }
  }

  /// Check if a property is currently locked by an active intent
  ///
  /// When locked, the UI should show the overlay value instead of the
  /// actual device state to prevent jitter.
  bool isLocked(String deviceId, String? channelId, String? propertyId) {
    final key = 'device:$deviceId:${channelId ?? '*'}:${propertyId ?? '*'}';
    return _targetIndex.containsKey(key);
  }

  /// Check if a scene is currently locked by an active intent
  bool isSceneLocked(String sceneId) {
    final key = 'scene:$sceneId';
    return _targetIndex.containsKey(key);
  }

  /// Check if any property on a device is locked
  bool isDeviceLocked(String deviceId) {
    return _targetIndex.keys.any((key) => key.startsWith('device:$deviceId:'));
  }

  /// Get the overlay value for a locked property
  ///
  /// Returns null if the property is not locked or has no overlay value.
  /// For multi-property intents, returns the specific value for the given propertyId.
  dynamic getOverlayValue(String deviceId, String? channelId, String? propertyId) {
    final key = 'device:$deviceId:${channelId ?? '*'}:${propertyId ?? '*'}';
    final intentId = _targetIndex[key];
    if (intentId == null) return null;

    final overlay = _activeIntents[intentId];
    if (overlay == null) return null;

    // Use getValueForProperty with deviceId and channelId to support composite keys
    return overlay.getValueForProperty(deviceId, channelId, propertyId);
  }

  /// Get the active intent affecting a device
  IntentOverlay? getActiveIntent(String deviceId) {
    for (final intent in _activeIntents.values) {
      if (intent.targets.any((t) => t.deviceId == deviceId)) {
        return intent;
      }
    }
    return null;
  }

  /// Get the active intent affecting a scene
  IntentOverlay? getActiveSceneIntent(String sceneId) {
    for (final intent in _activeIntents.values) {
      if (intent.targets.any((t) => t.sceneId == sceneId)) {
        return intent;
      }
    }
    return null;
  }

  /// Get recent failure result for a specific property or any property on a device.
  ///
  /// If [channelId] and [propertyId] are provided, looks up the specific property.
  /// Otherwise, returns the first failure found for the device (for showing device-level indicators).
  IntentTargetResult? getFailureResult(
    String deviceId, [
    String? channelId,
    String? propertyId,
  ]) {
    // If specific property requested, look up by composite key
    if (propertyId != null) {
      final key = 'device:$deviceId:${channelId ?? '*'}:$propertyId';
      final result = _recentResults[key];
      if (result != null && result.isFailure) {
        return result;
      }
      return null;
    }

    // Otherwise, find any failure for this device
    for (final entry in _recentResults.entries) {
      if (entry.key.startsWith('device:$deviceId:') && entry.value.isFailure) {
        return entry.value;
      }
    }
    return null;
  }

  /// Get recent failure result for a scene
  IntentTargetResult? getSceneFailureResult(String sceneId) {
    final key = 'scene:$sceneId';
    final result = _recentResults[key];
    if (result != null && result.isFailure) {
      return result;
    }
    return null;
  }

  /// Check if a device has a recent failure (any property)
  bool hasRecentFailure(String deviceId) {
    return getFailureResult(deviceId) != null;
  }

  /// Check if a scene has a recent failure
  bool hasSceneRecentFailure(String sceneId) {
    return getSceneFailureResult(sceneId) != null;
  }

  /// Create a local optimistic overlay immediately when user interacts
  ///
  /// This is called before sending the command to the backend, so the UI
  /// responds instantly. The actual intent from the backend will replace this.
  void createLocalOverlay({
    required String deviceId,
    required String? channelId,
    required String? propertyId,
    required dynamic value,
    int ttlMs = 3000,
  }) {
    final now = DateTime.now();
    final localIntentId = 'local_${deviceId}_${DateTime.now().millisecondsSinceEpoch}';

    // Build value map for consistency with backend format (using composite key with device: prefix)
    final valueMap = propertyId != null
        ? {'device:$deviceId:${channelId ?? '*'}:$propertyId': value}
        : value;

    final overlay = IntentOverlay(
      intentId: localIntentId,
      type: 'device.setProperty',
      scope: IntentScope(),
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

    _addIntent(overlay);

    if (kDebugMode) {
      debugPrint('[INTENT_OVERLAY] Created local overlay $localIntentId for device:$deviceId:$channelId:$propertyId');
    }

    // Schedule local expiration with a tracked timer
    _scheduleExpiration(localIntentId, Duration(milliseconds: ttlMs));
  }

  /// Schedule expiration for an intent
  void _scheduleExpiration(String intentId, Duration duration) {
    // Cancel any existing timer for this intent
    _expirationTimers[intentId]?.cancel();

    _expirationTimers[intentId] = Timer(duration, () {
      if (_isDisposed) return;

      if (_activeIntents.containsKey(intentId)) {
        if (kDebugMode) {
          debugPrint('[INTENT_OVERLAY] Local expiration triggered for $intentId');
        }
        _clearIntent(intentId);
        notifyListeners();
      }

      _expirationTimers.remove(intentId);
    });
  }

  /// Cancel expiration timer for an intent
  void _cancelExpiration(String intentId) {
    _expirationTimers[intentId]?.cancel();
    _expirationTimers.remove(intentId);
  }

  /// Clear all active intents (e.g., on disconnect)
  void clearAll() {
    // Cancel all expiration timers
    for (final timer in _expirationTimers.values) {
      timer.cancel();
    }
    _expirationTimers.clear();

    _activeIntents.clear();
    _targetIndex.clear();
    _recentResults.clear();

    if (!_isDisposed) {
      notifyListeners();
    }
  }

  /// Dispose the service
  @override
  void dispose() {
    _isDisposed = true;

    _socketService.unregisterEventHandler(
      IntentEventConstants.moduleWildcardEvent,
      _handleSocketEvent,
    );
    _socketService.removeConnectionListener(_handleConnectionChange);

    // Cancel all expiration timers
    for (final timer in _expirationTimers.values) {
      timer.cancel();
    }
    _expirationTimers.clear();

    _cleanupTimer?.cancel();
    super.dispose();
  }

  /// Handle incoming socket events
  void _handleSocketEvent(String event, Map<String, dynamic> payload) {
    if (event == IntentEventConstants.intentCreatedEvent) {
      _handleIntentCreated(payload);
    } else if (event == IntentEventConstants.intentCompletedEvent) {
      _handleIntentCompleted(payload);
    } else if (event == IntentEventConstants.intentExpiredEvent) {
      _handleIntentExpired(payload);
    }
  }

  /// Handle intent.created event
  void _handleIntentCreated(Map<String, dynamic> payload) {
    try {
      final overlay = IntentOverlay.fromJson(payload);

      // Remove any local overlays for the same targets
      _removeLocalOverlaysForTargets(overlay.targets);

      _addIntent(overlay);

      // Schedule local expiration as a fallback in case the completion event is lost
      // Add a small buffer (500ms) to the expiresAt time to allow for network latency
      final now = DateTime.now();
      final expirationDuration = overlay.expiresAt.difference(now) + const Duration(milliseconds: 500);

      if (expirationDuration.inMilliseconds > 0) {
        _scheduleExpiration(overlay.intentId, expirationDuration);

        if (kDebugMode) {
          debugPrint('[INTENT_OVERLAY] Scheduled local fallback expiration for ${overlay.intentId} in ${expirationDuration.inMilliseconds}ms');
        }
      }

      if (kDebugMode) {
        debugPrint('[INTENT_OVERLAY] Intent created: ${overlay.intentId}');
      }

      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[INTENT_OVERLAY] Failed to parse intent.created: $e');
      }
    }
  }

  /// Handle intent.completed event
  void _handleIntentCompleted(Map<String, dynamic> payload) {
    try {
      final intentId = payload['intent_id'] as String;
      final overlay = _activeIntents[intentId];

      if (overlay != null) {
        // Store results for failure indicators
        _storeResults(payload);

        _clearIntent(intentId);

        if (kDebugMode) {
          debugPrint('[INTENT_OVERLAY] Intent completed: $intentId');
        }

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[INTENT_OVERLAY] Failed to parse intent.completed: $e');
      }
    }
  }

  /// Handle intent.expired event
  void _handleIntentExpired(Map<String, dynamic> payload) {
    try {
      final intentId = payload['intent_id'] as String;

      if (_activeIntents.containsKey(intentId)) {
        _clearIntent(intentId);

        if (kDebugMode) {
          debugPrint('[INTENT_OVERLAY] Intent expired: $intentId');
        }

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[INTENT_OVERLAY] Failed to parse intent.expired: $e');
      }
    }
  }

  /// Add an intent to the registry
  void _addIntent(IntentOverlay overlay) {
    _activeIntents[overlay.intentId] = overlay;

    for (final target in overlay.targets) {
      _targetIndex[target.key] = overlay.intentId;
    }
  }

  /// Clear an intent from the registry
  void _clearIntent(String intentId) {
    // Cancel any pending expiration timer
    _cancelExpiration(intentId);

    final overlay = _activeIntents.remove(intentId);

    if (overlay != null) {
      for (final target in overlay.targets) {
        if (_targetIndex[target.key] == intentId) {
          _targetIndex.remove(target.key);
        }
      }
    }
  }

  /// Remove local overlays for targets that are now covered by a backend intent
  void _removeLocalOverlaysForTargets(List<IntentTarget> targets) {
    final targetKeys = targets.map((t) => t.key).toSet();

    final localIntentIds = <String>{};
    for (final key in targetKeys) {
      final intentId = _targetIndex[key];
      if (intentId != null && intentId.startsWith('local_')) {
        localIntentIds.add(intentId);
      }
    }

    for (final intentId in localIntentIds) {
      _clearIntent(intentId);
    }
  }

  /// Store results from a completed intent for failure indicators
  void _storeResults(Map<String, dynamic> payload) {
    if (payload['results'] is List) {
      for (final result in payload['results'] as List) {
        try {
          final targetResult = IntentTargetResult.fromJson(result as Map<String, dynamic>);
          // Use the key getter which includes device:/scene: prefix for consistency
          _recentResults[targetResult.key] = targetResult;
        } catch (e) {
          // Ignore parse errors for individual results
        }
      }

      // Schedule cleanup of failure indicators
      _scheduleResultCleanup();
    }
  }

  /// Schedule cleanup of old failure indicators
  void _scheduleResultCleanup() {
    _cleanupTimer?.cancel();
    _cleanupTimer = Timer(_failureIndicatorDuration, () {
      if (_isDisposed) return;

      // Clear all results after the duration
      _recentResults.clear();
      notifyListeners();
    });
  }
}
