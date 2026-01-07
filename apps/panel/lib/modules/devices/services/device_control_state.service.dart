import 'dart:async';

import 'package:flutter/foundation.dart';

/// UI states for device property controls
enum ControlUIState {
  /// Normal state - showing actual device values
  idle,

  /// User has initiated action, waiting for command to complete
  pending,

  /// Command completed, waiting for device state to sync (settling window)
  settling,
}

/// Control state for a device property.
///
/// Tracks optimistic UI state for a single device:channel:property combination.
/// Used to prevent UI flickering during command execution and device sync.
class PropertyControlState {
  /// Current UI state
  final ControlUIState state;

  /// The value the user set (persists through PENDING and SETTLING)
  final dynamic desiredValue;

  /// Settling timer (active during SETTLING state)
  final Timer? settlingTimer;

  /// Timestamp when this state was created
  final DateTime createdAt;

  const PropertyControlState({
    this.state = ControlUIState.idle,
    this.desiredValue,
    this.settlingTimer,
    required this.createdAt,
  });

  /// Whether the control is in a "locked" state where we show desired value
  bool get isLocked =>
      state == ControlUIState.pending || state == ControlUIState.settling;

  /// Whether we're actively waiting for device to sync
  bool get isSettling => state == ControlUIState.settling;

  /// Cancel any active timer
  void cancelTimer() {
    settlingTimer?.cancel();
  }

  @override
  String toString() =>
      'PropertyControlState(state: $state, desiredValue: $desiredValue)';
}

/// Service for managing optimistic UI state for device controls.
///
/// Tracks pending/settling states for device properties to prevent UI flickering
/// during command execution and device state synchronization.
///
/// Key format: `device:channelId:propertyId` (channelId can be *)
///
/// Usage:
/// ```dart
/// // When user initiates a command
/// controlStateService.setPending(deviceId, channelId, propertyId, newValue);
///
/// // After command completes, start settling window
/// controlStateService.setSettling(deviceId, channelId, propertyId);
///
/// // In build method
/// if (controlStateService.isLocked(deviceId, channelId, propertyId)) {
///   isOn = controlStateService.getDesiredValue(deviceId, channelId, propertyId);
/// }
/// ```
class DeviceControlStateService extends ChangeNotifier {
  /// In-memory state storage
  final Map<String, PropertyControlState> _states = {};

  /// Default settling duration
  static const Duration defaultSettlingDuration = Duration(milliseconds: 800);

  /// Track if disposed
  bool _isDisposed = false;

  /// Generate state key from components
  static String generateKey(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    return 'device:$deviceId:${channelId ?? '*'}:${propertyId ?? '*'}';
  }

  /// Set state to PENDING for a property.
  ///
  /// Called when user initiates a command. The UI will show [desiredValue]
  /// instead of actual device state until settling completes.
  void setPending(
    String deviceId,
    String? channelId,
    String? propertyId,
    dynamic desiredValue,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);

    // Cancel any existing timer for this key
    _states[key]?.cancelTimer();

    _states[key] = PropertyControlState(
      state: ControlUIState.pending,
      desiredValue: desiredValue,
      createdAt: DateTime.now(),
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICE_CONTROL_STATE] Set PENDING: $key = $desiredValue',
      );
    }

    if (!_isDisposed) {
      notifyListeners();
    }
  }

  /// Transition state to SETTLING for a property.
  ///
  /// Called after command completes. Starts a timer that will clear
  /// the state after [duration] (default 800ms).
  void setSettling(
    String deviceId,
    String? channelId,
    String? propertyId, {
    Duration duration = defaultSettlingDuration,
  }) {
    final key = generateKey(deviceId, channelId, propertyId);
    final currentState = _states[key];

    if (currentState == null) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICE_CONTROL_STATE] setSettling called but no pending state for: $key',
        );
      }
      return;
    }

    // Cancel any existing timer
    currentState.cancelTimer();

    _states[key] = PropertyControlState(
      state: ControlUIState.settling,
      desiredValue: currentState.desiredValue,
      createdAt: currentState.createdAt,
      settlingTimer: Timer(duration, () {
        _clearState(key);
      }),
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICE_CONTROL_STATE] Set SETTLING: $key (${duration.inMilliseconds}ms)',
      );
    }

    if (!_isDisposed) {
      notifyListeners();
    }
  }

  /// Clear state for a property.
  ///
  /// Called when settling timer expires or when state should be cleared manually.
  void clear(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);
    _clearState(key);
  }

  void _clearState(String key) {
    final state = _states.remove(key);
    if (state != null) {
      state.cancelTimer();

      if (kDebugMode) {
        debugPrint('[DEVICE_CONTROL_STATE] Cleared: $key');
      }

      if (!_isDisposed) {
        notifyListeners();
      }
    }
  }

  /// Check if a property is currently locked (pending or settling).
  ///
  /// When locked, the UI should show the desired value instead of actual state.
  bool isLocked(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);
    return _states[key]?.isLocked ?? false;
  }

  /// Get the desired value for a locked property.
  ///
  /// Returns null if the property is not locked.
  dynamic getDesiredValue(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);
    return _states[key]?.desiredValue;
  }

  /// Get the full state for a property.
  ///
  /// Returns null if no state exists.
  PropertyControlState? getState(
    String deviceId,
    String? channelId,
    String? propertyId,
  ) {
    final key = generateKey(deviceId, channelId, propertyId);
    return _states[key];
  }

  /// Clear all states for a specific device.
  void clearForDevice(String deviceId) {
    final keysToRemove = _states.keys
        .where((key) => key.startsWith('device:$deviceId:'))
        .toList();

    for (final key in keysToRemove) {
      final state = _states.remove(key);
      state?.cancelTimer();
    }

    if (keysToRemove.isNotEmpty) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICE_CONTROL_STATE] Cleared ${keysToRemove.length} states for device: $deviceId',
        );
      }

      if (!_isDisposed) {
        notifyListeners();
      }
    }
  }

  /// Clear all states.
  ///
  /// Called on disconnect or when all states should be reset.
  void clearAll() {
    for (final state in _states.values) {
      state.cancelTimer();
    }
    _states.clear();

    if (kDebugMode) {
      debugPrint('[DEVICE_CONTROL_STATE] All states cleared');
    }

    if (!_isDisposed) {
      notifyListeners();
    }
  }

  /// Get the number of active states
  int get activeCount => _states.length;

  /// Get all active state keys (for debugging)
  List<String> get activeKeys => _states.keys.toList();

  @override
  void dispose() {
    _isDisposed = true;

    for (final state in _states.values) {
      state.cancelTimer();
    }
    _states.clear();

    super.dispose();
  }
}
