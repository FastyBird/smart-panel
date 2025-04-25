// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_create_device_control.dart';

part 'devices_module_req_create_device_control.freezed.dart';
part 'devices_module_req_create_device_control.g.dart';

/// Request schema for creating new device control.
@Freezed()
class DevicesModuleReqCreateDeviceControl with _$DevicesModuleReqCreateDeviceControl {
  const factory DevicesModuleReqCreateDeviceControl({
    required DevicesModuleCreateDeviceControl data,
  }) = _DevicesModuleReqCreateDeviceControl;
  
  factory DevicesModuleReqCreateDeviceControl.fromJson(Map<String, Object?> json) => _$DevicesModuleReqCreateDeviceControlFromJson(json);
}
