// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_update_device.dart';

part 'devices_module_req_update_device.freezed.dart';
part 'devices_module_req_update_device.g.dart';

/// Request schema for updating an existing device.
@Freezed()
class DevicesModuleReqUpdateDevice with _$DevicesModuleReqUpdateDevice {
  const factory DevicesModuleReqUpdateDevice({
    required DevicesModuleUpdateDevice data,
  }) = _DevicesModuleReqUpdateDevice;
  
  factory DevicesModuleReqUpdateDevice.fromJson(Map<String, Object?> json) => _$DevicesModuleReqUpdateDeviceFromJson(json);
}
