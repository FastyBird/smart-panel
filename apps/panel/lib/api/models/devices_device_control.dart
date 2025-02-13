// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_device_control.freezed.dart';
part 'devices_device_control.g.dart';

/// A Device control is an action that can be executed at the device level. It provides operational commands like restarting a device or updating its firmware.
@Freezed()
class DevicesDeviceControl with _$DevicesDeviceControl {
  const factory DevicesDeviceControl({
    /// System-generated unique identifier for the control.
    required String id,

    /// The name of the control, representing the action it performs.
    required String name,

    /// The device to which this control belongs.
    required String device,

    /// Timestamp when the control was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// Timestamp when the control was last updated, if applicable.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,
  }) = _DevicesDeviceControl;
  
  factory DevicesDeviceControl.fromJson(Map<String, Object?> json) => _$DevicesDeviceControlFromJson(json);
}
