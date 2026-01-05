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

  /// Quick lookup: "deviceId:propertyKey" -> intentId
  final Map<String, String> _targetIndex = {};

  /// Recent completion results for showing failure indicators
  /// Key: deviceId, Value: IntentTargetResult
  final Map<String, IntentTargetResult> _recentResults = {};

  /// Duration to keep failure indicators visible
  static const Duration _failureIndicatorDuration = Duration(seconds: 10);

  /// Timer for cleaning up old failure indicators
  Timer? _cleanupTimer;

  IntentOverlayService({
    required SocketService socketService,
  }) : _socketService = socketService;

  /// Initialize the service and subscribe to socket events
  void initialize() {
    _socketService.registerEventHandler(
      IntentEventConstants.moduleWildcardEvent,
      _handleSocketEvent,
    );

    if (kDebugMode) {
      debugPrint('[INTENT_OVERLAY] Service initialized');
    }
  }

  /// Check if a property is currently locked by an active intent
  ///
  /// When locked, the UI should show the overlay value instead of the
  /// actual device state to prevent jitter.
  bool isLocked(String deviceId, String? propertyKey) {
    final key = '$deviceId:${propertyKey ?? '*'}';
    return _targetIndex.containsKey(key);
  }

  /// Check if any property on a device is locked
  bool isDeviceLocked(String deviceId) {
    return _targetIndex.keys.any((key) => key.startsWith('$deviceId:'));
  }

  /// Get the overlay value for a locked property
  ///
  /// Returns null if the property is not locked or has no overlay value.
  dynamic getOverlayValue(String deviceId, String? propertyKey) {
    final key = '$deviceId:${propertyKey ?? '*'}';
    final intentId = _targetIndex[key];
    if (intentId == null) return null;

    return _activeIntents[intentId]?.value;
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

  /// Get recent failure result for a device (for showing "not synced" indicators)
  IntentTargetResult? getFailureResult(String deviceId) {
    final result = _recentResults[deviceId];
    if (result == null) return null;

    // Only return if it's a failure
    if (result.isFailure) {
      return result;
    }
    return null;
  }

  /// Check if a device has a recent failure
  bool hasRecentFailure(String deviceId) {
    return getFailureResult(deviceId) != null;
  }

  /// Create a local optimistic overlay immediately when user interacts
  ///
  /// This is called before sending the command to the backend, so the UI
  /// responds instantly. The actual intent from the backend will replace this.
  void createLocalOverlay({
    required String deviceId,
    required String? propertyKey,
    required dynamic value,
    int ttlMs = 3000,
  }) {
    final now = DateTime.now();
    final localIntentId = 'local_${deviceId}_${DateTime.now().millisecondsSinceEpoch}';

    final overlay = IntentOverlay(
      intentId: localIntentId,
      type: 'device.setProperty',
      scope: IntentScope(),
      targets: [IntentTarget(deviceId: deviceId, propertyKey: propertyKey)],
      value: value,
      status: IntentStatus.pending,
      ttlMs: ttlMs,
      createdAt: now,
      expiresAt: now.add(Duration(milliseconds: ttlMs)),
    );

    _addIntent(overlay);

    if (kDebugMode) {
      debugPrint('[INTENT_OVERLAY] Created local overlay $localIntentId for $deviceId:$propertyKey');
    }

    // Schedule local expiration (backend intent will replace this if it arrives)
    Future.delayed(Duration(milliseconds: ttlMs), () {
      if (_activeIntents.containsKey(localIntentId)) {
        _clearIntent(localIntentId);
        notifyListeners();
      }
    });
  }

  /// Clear all active intents (e.g., on disconnect)
  void clearAll() {
    _activeIntents.clear();
    _targetIndex.clear();
    _recentResults.clear();
    notifyListeners();
  }

  /// Dispose the service
  @override
  void dispose() {
    _socketService.unregisterEventHandler(
      IntentEventConstants.moduleWildcardEvent,
      _handleSocketEvent,
    );
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
      final intentId = payload['intentId'] as String;
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
      final intentId = payload['intentId'] as String;

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
          _recentResults[targetResult.deviceId] = targetResult;
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
      // Clear all results after the duration
      _recentResults.clear();
      notifyListeners();
    });
  }
}
