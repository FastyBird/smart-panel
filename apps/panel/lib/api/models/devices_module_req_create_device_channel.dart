// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_create_device_channel.dart';

part 'devices_module_req_create_device_channel.freezed.dart';
part 'devices_module_req_create_device_channel.g.dart';

/// Request schema for creating new device channel.
@Freezed()
class DevicesModuleReqCreateDeviceChannel with _$DevicesModuleReqCreateDeviceChannel {
  const factory DevicesModuleReqCreateDeviceChannel({
    required DevicesModuleCreateDeviceChannel data,
  }) = _DevicesModuleReqCreateDeviceChannel;
  
  factory DevicesModuleReqCreateDeviceChannel.fromJson(Map<String, Object?> json) => _$DevicesModuleReqCreateDeviceChannelFromJson(json);
}
