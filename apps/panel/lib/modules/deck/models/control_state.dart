import 'dart:async';

import 'package:fastybird_smart_panel/modules/deck/types/control_ui_state.dart';

/// Control state for a single control channel (e.g., brightness, temperature, position).
///
/// Tracks the UI state and desired value for optimistic updates across
/// multiple devices in a domain (lighting, climate, covers).
class ControlState {
  /// Current UI state.
  final ControlUIState state;

  /// The value the user set (persists through PENDING, SETTLING, MIXED).
  final double? desiredValue;

  /// Settling timer (active during SETTLING state).
  final Timer? settlingTimer;

  /// Timestamp when settling started.
  final DateTime? settlingStartedAt;

  const ControlState({
    this.state = ControlUIState.idle,
    this.desiredValue,
    this.settlingTimer,
    this.settlingStartedAt,
  });

  /// Create a copy with updated fields.
  ControlState copyWith({
    ControlUIState? state,
    double? desiredValue,
    Timer? settlingTimer,
    DateTime? settlingStartedAt,
    bool clearDesiredValue = false,
    bool clearSettlingTimer = false,
    bool clearSettlingStartedAt = false,
  }) {
    return ControlState(
      state: state ?? this.state,
      desiredValue:
          clearDesiredValue ? null : (desiredValue ?? this.desiredValue),
      settlingTimer:
          clearSettlingTimer ? null : (settlingTimer ?? this.settlingTimer),
      settlingStartedAt: clearSettlingStartedAt
          ? null
          : (settlingStartedAt ?? this.settlingStartedAt),
    );
  }

  /// Whether the control is in a "locked" state where we show desired value.
  bool get isLocked =>
      state == ControlUIState.pending ||
      state == ControlUIState.settling ||
      state == ControlUIState.mixed;

  /// Whether we're actively waiting for devices to sync.
  bool get isSettling => state == ControlUIState.settling;

  /// Whether devices are in mixed state.
  bool get isMixed => state == ControlUIState.mixed;

  /// Whether control is idle (normal state).
  bool get isIdle => state == ControlUIState.idle;

  /// Whether control is pending (waiting for intent).
  bool get isPending => state == ControlUIState.pending;

  /// Cancel any active timer.
  ///
  /// Note: This is a side-effect method on an otherwise immutable class.
  /// Use this when you need to cancel the timer before replacing the state
  /// with a new instance.
  void cancelTimer() {
    settlingTimer?.cancel();
  }

  /// Cancel timer and return a new state with timer cleared.
  ///
  /// Use this when you want to cancel the timer and keep the rest of the state.
  /// This is the preferred immutable pattern.
  ControlState withTimerCancelled() {
    settlingTimer?.cancel();
    return copyWith(clearSettlingTimer: true, clearSettlingStartedAt: true);
  }

  /// Transition to idle state.
  ControlState toIdle() {
    cancelTimer();
    return const ControlState(state: ControlUIState.idle);
  }

  /// Transition to pending state with a desired value.
  ControlState toPending(double value) {
    cancelTimer();
    return ControlState(
      state: ControlUIState.pending,
      desiredValue: value,
    );
  }

  /// Transition to mixed state (preserves desired value).
  ControlState toMixed() {
    cancelTimer();
    return ControlState(
      state: ControlUIState.mixed,
      desiredValue: desiredValue,
    );
  }

  @override
  String toString() =>
      'ControlState(state: $state, desiredValue: $desiredValue)';
}
