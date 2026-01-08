import 'dart:async';

import 'package:fastybird_smart_panel/modules/deck/types/lighting/role_ui_state.dart';

/// Control state for a single control type (brightness, hue, temperature, white).
class RoleControlState {
  /// Current UI state.
  final RoleUIState state;

  /// The value the user set (persists through PENDING, SETTLING, MIXED).
  final double? desiredValue;

  /// Settling timer (active during SETTLING state).
  final Timer? settlingTimer;

  /// Timestamp when settling started.
  final DateTime? settlingStartedAt;

  const RoleControlState({
    this.state = RoleUIState.idle,
    this.desiredValue,
    this.settlingTimer,
    this.settlingStartedAt,
  });

  /// Create a copy with updated fields.
  RoleControlState copyWith({
    RoleUIState? state,
    double? desiredValue,
    Timer? settlingTimer,
    DateTime? settlingStartedAt,
    bool clearDesiredValue = false,
    bool clearSettlingTimer = false,
    bool clearSettlingStartedAt = false,
  }) {
    return RoleControlState(
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
      state == RoleUIState.pending ||
      state == RoleUIState.settling ||
      state == RoleUIState.mixed;

  /// Whether we're actively waiting for devices to sync.
  bool get isSettling => state == RoleUIState.settling;

  /// Whether devices are in mixed state.
  bool get isMixed => state == RoleUIState.mixed;

  /// Cancel any active timer.
  ///
  /// Note: This is a side-effect method on an otherwise immutable class.
  /// Use this when you need to cancel the timer before replacing the state
  /// with a new instance. Example:
  /// ```dart
  /// _brightnessState.cancelTimer();
  /// _brightnessState = RoleControlState(...);
  /// ```
  void cancelTimer() {
    settlingTimer?.cancel();
  }

  /// Cancel timer and return a new state with timer cleared.
  ///
  /// Use this when you want to cancel the timer and keep the rest of the state.
  /// This is the preferred immutable pattern. Example:
  /// ```dart
  /// _brightnessState = _brightnessState.withTimerCancelled();
  /// ```
  RoleControlState withTimerCancelled() {
    settlingTimer?.cancel();
    return copyWith(clearSettlingTimer: true, clearSettlingStartedAt: true);
  }
}
