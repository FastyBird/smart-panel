import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/intents/mappers/intent.dart';
import 'package:fastybird_smart_panel/modules/intents/models/intents/intent.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/intents/views/intents/view.dart';

/// Service that tracks active intents and provides overlay values for UI anti-jitter.
///
/// Other modules should use this service to:
/// - Check if properties/scenes are locked by active intents
/// - Get overlay values for locked properties
/// - Access recent failure results
/// - Create local optimistic overlays
///
/// When the user interacts with a device (e.g., changes brightness), an intent is created
/// on the backend. This service tracks those intents and provides overlay values so the
/// UI shows the intended value instead of outdated state, preventing jitter.
class IntentOverlayService extends ChangeNotifier {
  final IntentsRepository _intentsRepository;

  Map<String, IntentView> _intents = {};

  IntentOverlayService({
    required IntentsRepository intentsRepository,
  }) : _intentsRepository = intentsRepository;

  Future<void> initialize() async {
    _intentsRepository.addListener(_updateData);
    _updateData();
  }

  /// All active intents as a map by ID
  Map<String, IntentView> get intents => _intents;

  /// All active intents as a list
  List<IntentView> get intentsList => _intents.values.toList();

  /// Count of active intents
  int get activeCount => _intents.length;

  /// Get a specific intent by ID
  IntentView? getIntent(String id) {
    return _intents[id];
  }

  // ============================================
  // Property locking and overlay methods
  // ============================================

  /// Check if a property is currently locked by an active intent
  ///
  /// When locked, the UI should show the overlay value instead of the
  /// actual device state to prevent jitter.
  bool isPropertyLocked(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    return _intentsRepository.isPropertyLocked(deviceId, channelId, propertyId);
  }

  /// Check if a scene is currently locked by an active intent
  bool isSceneLocked(String sceneId) {
    return _intentsRepository.isSceneLocked(sceneId);
  }

  /// Check if any property on a device is locked
  bool isDeviceLocked(String deviceId) {
    return _intentsRepository.isDeviceLocked(deviceId);
  }

  /// Get the overlay value for a locked property
  ///
  /// Returns null if the property is not locked or has no overlay value.
  /// For multi-property intents, returns the specific value for the given propertyId.
  dynamic getOverlayValue(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final intentId = _intentsRepository.getIntentIdForProperty(
      deviceId,
      channelId,
      propertyId,
    );
    if (intentId == null) return null;

    final intent = _intents[intentId];
    if (intent == null) return null;

    return intent.getValueForProperty(deviceId, channelId, propertyId);
  }

  /// Get the active intent affecting a device
  IntentView? getActiveIntentForDevice(String deviceId) {
    final model = _intentsRepository.getActiveIntentForDevice(deviceId);
    if (model == null) return null;
    return _intents[model.id];
  }

  /// Get the active intent affecting a scene
  IntentView? getActiveIntentForScene(String sceneId) {
    final model = _intentsRepository.getActiveIntentForScene(sceneId);
    if (model == null) return null;
    return _intents[model.id];
  }

  // ============================================
  // Failure result methods
  // ============================================

  /// Get recent failure result for a specific property
  IntentTargetResult? getFailureResultForProperty(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    return _intentsRepository.getFailureResultForProperty(
      deviceId,
      channelId,
      propertyId,
    );
  }

  /// Get any recent failure result for a device
  IntentTargetResult? getAnyFailureResultForDevice(String deviceId) {
    return _intentsRepository.getAnyFailureResultForDevice(deviceId);
  }

  /// Get recent failure result for a scene
  IntentTargetResult? getFailureResultForScene(String sceneId) {
    return _intentsRepository.getFailureResultForScene(sceneId);
  }

  /// Check if a device has a recent failure (any property)
  bool hasRecentFailure(String deviceId) {
    return _intentsRepository.hasRecentFailure(deviceId);
  }

  /// Check if a scene has a recent failure
  bool hasSceneRecentFailure(String sceneId) {
    return _intentsRepository.hasSceneRecentFailure(sceneId);
  }

  // ============================================
  // Local overlay creation
  // ============================================

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
    _intentsRepository.createLocalIntent(
      deviceId: deviceId,
      channelId: channelId,
      propertyId: propertyId,
      value: value,
      ttlMs: ttlMs,
    );
  }

  // ============================================
  // Internal methods
  // ============================================

  void _updateData() {
    final intentModels = _intentsRepository.intents;

    late bool triggerNotifyListeners = false;

    Map<String, IntentView> newIntentViews = {};

    for (var intent in intentModels) {
      try {
        newIntentViews[intent.id] = buildIntentView(intent);
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[INTENTS MODULE][SERVICE] Failed to create intent view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_intents, newIntentViews)) {
      _intents = newIntentViews;
      triggerNotifyListeners = true;
    }

    if (triggerNotifyListeners) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _intentsRepository.removeListener(_updateData);
    super.dispose();
  }
}
