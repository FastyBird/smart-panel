// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_create_device_control.dart';

part 'devices_req_create_device_control.freezed.dart';
part 'devices_req_create_device_control.g.dart';

/// Request schema for creating new device control.
@Freezed()
class DevicesReqCreateDeviceControl with _$DevicesReqCreateDeviceControl {
  const factory DevicesReqCreateDeviceControl({
    required DevicesCreateDeviceControl data,
  }) = _DevicesReqCreateDeviceControl;
  
  factory DevicesReqCreateDeviceControl.fromJson(Map<String, Object?> json) => _$DevicesReqCreateDeviceControlFromJson(json);
}
