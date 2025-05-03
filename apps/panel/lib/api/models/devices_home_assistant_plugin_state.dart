// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_home_assistant_plugin_state.freezed.dart';
part 'devices_home_assistant_plugin_state.g.dart';

/// A representation of an individual Home Assistant entity's state and metadata.
@Freezed()
class DevicesHomeAssistantPluginState with _$DevicesHomeAssistantPluginState {
  const factory DevicesHomeAssistantPluginState({
    /// The unique ID of the Home Assistant entity (e.g. 'light.kitchen').
    @JsonKey(name: 'entity_id')
    required String entityId,

    /// Current state of the entity (e.g. 'on', 'off', 'home', etc.).
    required dynamic state,

    /// Dynamic attributes of the entity such as friendly_name, unit_of_measurement, etc.
    required dynamic attributes,

    /// Timestamp of the last state change.
    @JsonKey(name: 'last_changed')
    required DateTime? lastChanged,

    /// Timestamp of the last report (may match last_updated).
    @JsonKey(name: 'last_reported')
    required DateTime? lastReported,

    /// Timestamp of the last entity update.
    @JsonKey(name: 'last_updated')
    required DateTime? lastUpdated,
  }) = _DevicesHomeAssistantPluginState;
  
  factory DevicesHomeAssistantPluginState.fromJson(Map<String, Object?> json) => _$DevicesHomeAssistantPluginStateFromJson(json);
}
