// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_create_device.dart';

part 'devices_module_req_create_device.freezed.dart';
part 'devices_module_req_create_device.g.dart';

/// Request schema for creating new device.
@Freezed()
class DevicesModuleReqCreateDevice with _$DevicesModuleReqCreateDevice {
  const factory DevicesModuleReqCreateDevice({
    required DevicesModuleCreateDevice data,
  }) = _DevicesModuleReqCreateDevice;
  
  factory DevicesModuleReqCreateDevice.fromJson(Map<String, Object?> json) => _$DevicesModuleReqCreateDeviceFromJson(json);
}
