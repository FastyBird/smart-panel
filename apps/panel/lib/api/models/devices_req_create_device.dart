// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_create_device.dart';

part 'devices_req_create_device.freezed.dart';
part 'devices_req_create_device.g.dart';

/// Request schema for creating new device.
@Freezed()
class DevicesReqCreateDevice with _$DevicesReqCreateDevice {
  const factory DevicesReqCreateDevice({
    required DevicesCreateDevice data,
  }) = _DevicesReqCreateDevice;
  
  factory DevicesReqCreateDevice.fromJson(Map<String, Object?> json) => _$DevicesReqCreateDeviceFromJson(json);
}
