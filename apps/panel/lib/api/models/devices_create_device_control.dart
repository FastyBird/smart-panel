// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_create_device_control.freezed.dart';
part 'devices_create_device_control.g.dart';

/// Schema for creating a new device control, which represents an action the device can perform.
@Freezed()
class DevicesCreateDeviceControl with _$DevicesCreateDeviceControl {
  const factory DevicesCreateDeviceControl({
    /// Unique identifier for the control. Optional during creation and system-generated if not provided.
    required String id,

    /// The name of the control, representing the action it performs.
    required String name,
  }) = _DevicesCreateDeviceControl;
  
  factory DevicesCreateDeviceControl.fromJson(Map<String, Object?> json) => _$DevicesCreateDeviceControlFromJson(json);
}
