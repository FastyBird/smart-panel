import 'dart:async';

import 'package:fastybird_smart_panel/modules/devices/types/control_ui_state.dart';

/// Configuration for a property within a control group.
///
/// Each property in a group has its own identifier and optional desired value.
class PropertyConfig {
  /// Channel ID for this property.
  final String? channelId;

  /// Property ID for this property.
  final String propertyId;

  /// The desired value for this property.
  final dynamic desiredValue;

  const PropertyConfig({
    this.channelId,
    required this.propertyId,
    this.desiredValue,
  });

  /// Generate a key for this property within a device context.
  String getKey(String deviceId) {
    return 'device:$deviceId:${channelId ?? '*'}:$propertyId';
  }

  @override
  String toString() =>
      'PropertyConfig(channelId: $channelId, propertyId: $propertyId, value: $desiredValue)';
}

/// Control state for a device property or property group.
///
/// Tracks the UI state and desired values for optimistic updates.
/// Supports both single property controls and multi-property groups (RGB, HUE/SAT).
class DeviceControlState {
  /// Current UI state.
  final DeviceControlUIState state;

  /// Properties being controlled with their desired values.
  /// For single property: list with one entry.
  /// For property groups (RGB): list with multiple entries.
  final List<PropertyConfig> properties;

  /// Settling timer (active during SETTLING state).
  final Timer? settlingTimer;

  /// Timestamp when settling started.
  final DateTime? settlingStartedAt;

  /// Timestamp when this state was created.
  final DateTime createdAt;

  const DeviceControlState({
    this.state = DeviceControlUIState.idle,
    this.properties = const [],
    this.settlingTimer,
    this.settlingStartedAt,
    required this.createdAt,
  });

  /// Create a copy with updated fields.
  DeviceControlState copyWith({
    DeviceControlUIState? state,
    List<PropertyConfig>? properties,
    Timer? settlingTimer,
    DateTime? settlingStartedAt,
    bool clearProperties = false,
    bool clearSettlingTimer = false,
    bool clearSettlingStartedAt = false,
  }) {
    return DeviceControlState(
      state: state ?? this.state,
      properties: clearProperties ? const [] : (properties ?? this.properties),
      settlingTimer:
          clearSettlingTimer ? null : (settlingTimer ?? this.settlingTimer),
      settlingStartedAt: clearSettlingStartedAt
          ? null
          : (settlingStartedAt ?? this.settlingStartedAt),
      createdAt: createdAt,
    );
  }

  /// Whether the control is in a "locked" state where we show desired value.
  bool get isLocked =>
      state == DeviceControlUIState.pending ||
      state == DeviceControlUIState.settling ||
      state == DeviceControlUIState.mixed;

  /// Whether we're actively waiting for device state to sync.
  bool get isSettling => state == DeviceControlUIState.settling;

  /// Whether device is in mixed state (convergence failed).
  bool get isMixed => state == DeviceControlUIState.mixed;

  /// Whether control is idle (normal state).
  bool get isIdle => state == DeviceControlUIState.idle;

  /// Whether control is pending (waiting for intent).
  bool get isPending => state == DeviceControlUIState.pending;

  /// Get the desired value for a single-property control.
  /// Returns null if no properties or multiple properties.
  dynamic get desiredValue {
    if (properties.length == 1) {
      return properties.first.desiredValue;
    }
    return null;
  }

  /// Get the desired value for a specific property in a group.
  dynamic getDesiredValueForProperty(String? channelId, String propertyId) {
    for (final prop in properties) {
      if (prop.channelId == channelId && prop.propertyId == propertyId) {
        return prop.desiredValue;
      }
    }
    return null;
  }

  /// Get all desired values as a map keyed by property ID.
  Map<String, dynamic> get desiredValuesMap {
    final map = <String, dynamic>{};
    for (final prop in properties) {
      map[prop.propertyId] = prop.desiredValue;
    }
    return map;
  }

  /// Cancel any active timer.
  void cancelTimer() {
    settlingTimer?.cancel();
  }

  /// Cancel timer and return a new state with timer cleared.
  DeviceControlState withTimerCancelled() {
    settlingTimer?.cancel();
    return copyWith(clearSettlingTimer: true, clearSettlingStartedAt: true);
  }

  /// Transition to idle state.
  DeviceControlState toIdle() {
    cancelTimer();
    return DeviceControlState(
      state: DeviceControlUIState.idle,
      createdAt: DateTime.now(),
    );
  }

  /// Transition to pending state with properties.
  DeviceControlState toPending(List<PropertyConfig> props) {
    cancelTimer();
    return DeviceControlState(
      state: DeviceControlUIState.pending,
      properties: props,
      createdAt: DateTime.now(),
    );
  }

  /// Transition to mixed state (preserves properties).
  DeviceControlState toMixed() {
    cancelTimer();
    return DeviceControlState(
      state: DeviceControlUIState.mixed,
      properties: properties,
      createdAt: createdAt,
    );
  }

  @override
  String toString() =>
      'DeviceControlState(state: $state, properties: $properties)';
}
