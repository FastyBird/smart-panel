// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_module_create_channel_control.freezed.dart';
part 'devices_module_create_channel_control.g.dart';

/// Schema for creating a new control within a channel, representing a specific action or command that can be performed.
@Freezed()
class DevicesModuleCreateChannelControl with _$DevicesModuleCreateChannelControl {
  const factory DevicesModuleCreateChannelControl({
    /// Unique identifier for the control. Optional during creation and system-generated if not provided.
    required String id,

    /// The name of the control, representing the action it performs.
    required String name,
  }) = _DevicesModuleCreateChannelControl;
  
  factory DevicesModuleCreateChannelControl.fromJson(Map<String, Object?> json) => _$DevicesModuleCreateChannelControlFromJson(json);
}
