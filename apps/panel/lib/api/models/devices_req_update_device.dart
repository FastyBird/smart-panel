// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_req_update_device_data_union.dart';

part 'devices_req_update_device.freezed.dart';
part 'devices_req_update_device.g.dart';

/// Request schema for updating an existing device.
@Freezed()
class DevicesReqUpdateDevice with _$DevicesReqUpdateDevice {
  const factory DevicesReqUpdateDevice({
    required DevicesReqUpdateDeviceDataUnion data,
  }) = _DevicesReqUpdateDevice;
  
  factory DevicesReqUpdateDevice.fromJson(Map<String, Object?> json) => _$DevicesReqUpdateDeviceFromJson(json);
}
