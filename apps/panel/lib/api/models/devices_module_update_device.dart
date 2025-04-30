// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_module_update_device.freezed.dart';
part 'devices_module_update_device.g.dart';

/// Schema for updating basic details of a device, including its name and description.
@Freezed()
class DevicesModuleUpdateDevice with _$DevicesModuleUpdateDevice {
  const factory DevicesModuleUpdateDevice({
    /// Specifies the type of device.
    required String type,

    /// Human-readable name of the device.
    required String name,

    /// Optional detailed description of the device.
    String? description,
  }) = _DevicesModuleUpdateDevice;
  
  factory DevicesModuleUpdateDevice.fromJson(Map<String, Object?> json) => _$DevicesModuleUpdateDeviceFromJson(json);
}
