import 'dart:async';

import 'package:fastybird_smart_panel/modules/deck/models/control_state.dart';
import 'package:fastybird_smart_panel/modules/deck/types/control_ui_state.dart';
import 'package:flutter/foundation.dart';

/// Function type for checking if all targets have converged to the desired value.
///
/// Returns true if all targets are within [tolerance] of [desiredValue].
/// The generic type [T] represents the target type (e.g., LightTargetView, ClimateDevice).
typedef ConvergenceChecker<T> = bool Function(
  List<T> targets,
  double desiredValue,
  double tolerance,
);

/// Function type for checking if any target property is locked by an active intent.
///
/// Returns true if any target has an active intent locking the control.
typedef IntentLockChecker<T> = bool Function(List<T> targets);

/// Configuration for a single control channel within a domain.
///
/// Each control channel (e.g., "brightness", "temperature", "position") has its own
/// configuration defining how to check convergence, tolerances, and timing.
class ControlChannelConfig<T> {
  /// Unique identifier for this control channel (e.g., "brightness", "setpoint").
  final String id;

  /// Domain-specific function to check if targets have converged to desired value.
  final ConvergenceChecker<T> convergenceChecker;

  /// Optional function to check if any target is locked by an active intent.
  /// If not provided, intent lock checking is skipped.
  final IntentLockChecker<T>? intentLockChecker;

  /// Duration to wait for devices to converge after intent completes (milliseconds).
  final int settlingWindowMs;

  /// Tolerance for convergence comparison (domain-specific units).
  /// For brightness: 3.0 (percent)
  /// For temperature: 0.5 (degrees)
  /// For position: 2.0 (percent)
  final double tolerance;

  const ControlChannelConfig({
    required this.id,
    required this.convergenceChecker,
    this.intentLockChecker,
    required this.settlingWindowMs,
    required this.tolerance,
  });
}

/// Service for managing optimistic UI state across multiple control channels.
///
/// This is a generic state machine that handles:
/// - State transitions: idle → pending → settling → idle/mixed
/// - Settling timers with configurable durations
/// - Convergence checking using domain-provided callbacks
/// - Intent lock tracking
///
/// Usage:
/// ```dart
/// final service = DomainControlStateService<LightTargetView>(
///   channelConfigs: {
///     'brightness': ControlChannelConfig(
///       id: 'brightness',
///       convergenceChecker: (targets, desired, tolerance) => ...,
///       settlingWindowMs: 2000,
///       tolerance: 3.0,
///     ),
///   },
/// );
///
/// // When user changes a value
/// service.setPending('brightness', 80.0);
///
/// // After intent completes, check and start settling
/// service.onIntentCompleted('brightness', targets);
///
/// // When device data changes, check convergence
/// service.checkConvergence('brightness', targets);
///
/// // In build method
/// final state = service.getState('brightness');
/// if (state?.isLocked == true) {
///   brightness = state!.desiredValue;
/// }
/// ```
class DomainControlStateService<T> extends ChangeNotifier {
  /// Control states indexed by channel ID.
  final Map<String, ControlState> _states = {};

  /// Channel configurations indexed by channel ID.
  final Map<String, ControlChannelConfig<T>> _channelConfigs;

  /// Track which channels were locked in previous update (for detecting unlocks).
  final Map<String, bool> _wasLocked = {};

  /// Track if disposed.
  bool _isDisposed = false;

  DomainControlStateService({
    required Map<String, ControlChannelConfig<T>> channelConfigs,
  }) : _channelConfigs = channelConfigs {
    // Initialize lock tracking for all channels
    for (final channelId in _channelConfigs.keys) {
      _wasLocked[channelId] = false;
    }
  }

  // ===========================================================================
  // PUBLIC API - State Management
  // ===========================================================================

  /// Set a control channel to PENDING state with a desired value.
  ///
  /// Call this when the user initiates an action (e.g., moves a slider).
  /// The UI should show [desiredValue] instead of actual device values.
  void setPending(String channelId, double desiredValue) {
    final currentState = _states[channelId];
    currentState?.cancelTimer();

    _states[channelId] = ControlState(
      state: ControlUIState.pending,
      desiredValue: desiredValue,
    );

    if (kDebugMode) {
      debugPrint(
        '[DOMAIN_CONTROL_STATE] Set PENDING: $channelId = $desiredValue',
      );
    }

    _notifyIfNotDisposed();
  }

  /// Handle intent completion for a control channel.
  ///
  /// Call this when a backend intent completes. This will:
  /// 1. Check if targets have already converged (→ idle)
  /// 2. If not converged, start settling timer (→ settling)
  ///
  /// [targets] is the current list of domain targets to check convergence against.
  void onIntentCompleted(String channelId, List<T> targets) {
    final config = _channelConfigs[channelId];
    final currentState = _states[channelId];

    if (config == null || currentState == null) return;
    if (currentState.state != ControlUIState.pending) return;

    final desiredValue = currentState.desiredValue;
    if (desiredValue == null) return;

    // Check immediate convergence
    if (config.convergenceChecker(targets, desiredValue, config.tolerance)) {
      _transitionToIdle(channelId);
      return;
    }

    // Start settling
    _startSettling(channelId, desiredValue, config);
  }

  /// Check for convergence when device data changes.
  ///
  /// Handles three states:
  /// - **pending**: converged → idle (covers direct device commands without intents)
  /// - **settling**: converged → idle
  /// - **mixed**: converged → idle (sync error resolved), OR
  ///   any new backend data → idle (accept external changes, e.g. from
  ///   another panel setting a different value)
  void checkConvergence(String channelId, List<T> targets) {
    final config = _channelConfigs[channelId];
    final currentState = _states[channelId];

    if (config == null || currentState == null) return;

    final desiredValue = currentState.desiredValue;
    if (desiredValue == null) return;

    if (currentState.state != ControlUIState.pending &&
        currentState.state != ControlUIState.settling &&
        currentState.state != ControlUIState.mixed) {
      return;
    }

    if (config.convergenceChecker(targets, desiredValue, config.tolerance)) {
      _transitionToIdle(channelId);
    } else if (currentState.state == ControlUIState.mixed) {
      // MIXED means the settling window already expired without convergence.
      // If new backend data arrives (even with a different value), accept it
      // rather than staying locked forever. This handles the case where
      // another client changed the value to something different.
      _transitionToIdle(channelId);
    }
  }

  /// Check and update intent lock status for a channel.
  ///
  /// Call this when intent state changes. Detects when intents unlock
  /// and triggers transition from pending to settling.
  ///
  /// Returns true if the lock status changed.
  bool updateIntentLockStatus(String channelId, List<T> targets) {
    final config = _channelConfigs[channelId];
    if (config == null || config.intentLockChecker == null) return false;

    final isNowLocked = config.intentLockChecker!(targets);
    final wasLocked = _wasLocked[channelId] ?? false;

    _wasLocked[channelId] = isNowLocked;

    // Detect unlock (was locked, now not locked)
    if (wasLocked && !isNowLocked) {
      final currentState = _states[channelId];
      if (currentState?.state == ControlUIState.pending) {
        // Intent completed, start settling
        final desiredValue = currentState!.desiredValue;
        if (desiredValue != null) {
          _startSettling(channelId, desiredValue, config);
          return true;
        }
      }
    }

    return false;
  }

  /// Manually transition a channel to idle state.
  ///
  /// Use this to clear state when needed (e.g., user cancels action).
  void setIdle(String channelId) {
    _transitionToIdle(channelId);
  }

  /// Set a control channel to MIXED state with a desired value.
  ///
  /// Use this when restoring cached values for display when devices are in a mixed state.
  /// The desired value will be shown in the UI instead of device values.
  void setMixed(String channelId, double desiredValue) {
    final currentState = _states[channelId];
    currentState?.cancelTimer();

    _states[channelId] = ControlState(
      state: ControlUIState.mixed,
      desiredValue: desiredValue,
    );

    if (kDebugMode) {
      debugPrint(
        '[DOMAIN_CONTROL_STATE] Set MIXED: $channelId = $desiredValue',
      );
    }

    _notifyIfNotDisposed();
  }

  /// Clear state for a specific channel.
  void clear(String channelId) {
    final state = _states.remove(channelId);
    state?.cancelTimer();
    _wasLocked[channelId] = false;

    if (kDebugMode) {
      debugPrint('[DOMAIN_CONTROL_STATE] Cleared: $channelId');
    }

    _notifyIfNotDisposed();
  }

  /// Clear all channel states.
  void clearAll() {
    for (final state in _states.values) {
      state.cancelTimer();
    }
    _states.clear();

    for (final key in _wasLocked.keys) {
      _wasLocked[key] = false;
    }

    if (kDebugMode) {
      debugPrint('[DOMAIN_CONTROL_STATE] All states cleared');
    }

    _notifyIfNotDisposed();
  }

  // ===========================================================================
  // PUBLIC API - State Queries
  // ===========================================================================

  /// Get the current state for a control channel.
  ControlState? getState(String channelId) => _states[channelId];

  /// Check if a control channel is locked (showing desired value).
  bool isLocked(String channelId) => _states[channelId]?.isLocked ?? false;

  /// Check if a control channel is in settling state.
  bool isSettling(String channelId) => _states[channelId]?.isSettling ?? false;

  /// Check if a control channel is in mixed state.
  bool isMixed(String channelId) => _states[channelId]?.isMixed ?? false;

  /// Check if a control channel is idle (normal state).
  bool isIdle(String channelId) =>
      _states[channelId]?.isIdle ?? true; // Default to idle if no state

  /// Get the desired value for a control channel.
  double? getDesiredValue(String channelId) =>
      _states[channelId]?.desiredValue;

  /// Check if any channel is in a non-idle state.
  bool get hasActiveState =>
      _states.values.any((s) => s.state != ControlUIState.idle);

  /// Get all channel IDs that are currently locked.
  List<String> get lockedChannels =>
      _states.entries
          .where((e) => e.value.isLocked)
          .map((e) => e.key)
          .toList();

  /// Get all channel IDs that are in mixed state.
  List<String> get mixedChannels =>
      _states.entries
          .where((e) => e.value.isMixed)
          .map((e) => e.key)
          .toList();

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  void _startSettling(
    String channelId,
    double desiredValue,
    ControlChannelConfig<T> config,
  ) {
    final currentState = _states[channelId];
    currentState?.cancelTimer();

    final timer = Timer(
      Duration(milliseconds: config.settlingWindowMs),
      () => _onSettlingTimeout(channelId, config),
    );

    _states[channelId] = ControlState(
      state: ControlUIState.settling,
      desiredValue: desiredValue,
      settlingTimer: timer,
      settlingStartedAt: DateTime.now(),
    );

    if (kDebugMode) {
      debugPrint(
        '[DOMAIN_CONTROL_STATE] Set SETTLING: $channelId (${config.settlingWindowMs}ms)',
      );
    }

    _notifyIfNotDisposed();
  }

  void _onSettlingTimeout(String channelId, ControlChannelConfig<T> config) {
    if (_isDisposed) return;

    final currentState = _states[channelId];
    if (currentState?.state != ControlUIState.settling) return;

    // Settling window expired without convergence - transition to mixed
    _states[channelId] = ControlState(
      state: ControlUIState.mixed,
      desiredValue: currentState!.desiredValue,
    );

    if (kDebugMode) {
      debugPrint(
        '[DOMAIN_CONTROL_STATE] Settling timeout, set MIXED: $channelId',
      );
    }

    _notifyIfNotDisposed();
  }

  void _transitionToIdle(String channelId) {
    final currentState = _states[channelId];
    currentState?.cancelTimer();

    _states[channelId] = const ControlState(state: ControlUIState.idle);

    if (kDebugMode) {
      debugPrint('[DOMAIN_CONTROL_STATE] Set IDLE: $channelId');
    }

    _notifyIfNotDisposed();
  }

  void _notifyIfNotDisposed() {
    if (!_isDisposed) {
      notifyListeners();
    }
  }

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
