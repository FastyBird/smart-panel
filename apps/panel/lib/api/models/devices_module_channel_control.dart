// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_module_channel_control.freezed.dart';
part 'devices_module_channel_control.g.dart';

/// A Channel control defines a specific action or command that can be executed for a channel. Examples include resetting a sensor or changing its operational mode.
@Freezed()
class DevicesModuleChannelControl with _$DevicesModuleChannelControl {
  const factory DevicesModuleChannelControl({
    /// System-generated unique identifier for the channel control.
    required String id,

    /// The name of the control, representing the action it performs.
    required String name,

    /// The channel to which this control belongs.
    required String channel,

    /// Timestamp when the control was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// Timestamp when the control was last updated, if applicable.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,
  }) = _DevicesModuleChannelControl;
  
  factory DevicesModuleChannelControl.fromJson(Map<String, Object?> json) => _$DevicesModuleChannelControlFromJson(json);
}
