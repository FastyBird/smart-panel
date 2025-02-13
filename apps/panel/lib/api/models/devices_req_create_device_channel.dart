// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_create_device_channel.dart';

part 'devices_req_create_device_channel.freezed.dart';
part 'devices_req_create_device_channel.g.dart';

/// Request schema for creating new device channel.
@Freezed()
class DevicesReqCreateDeviceChannel with _$DevicesReqCreateDeviceChannel {
  const factory DevicesReqCreateDeviceChannel({
    required DevicesCreateDeviceChannel data,
  }) = _DevicesReqCreateDeviceChannel;
  
  factory DevicesReqCreateDeviceChannel.fromJson(Map<String, Object?> json) => _$DevicesReqCreateDeviceChannelFromJson(json);
}
