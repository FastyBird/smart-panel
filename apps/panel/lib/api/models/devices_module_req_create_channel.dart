// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_create_channel.dart';

part 'devices_module_req_create_channel.freezed.dart';
part 'devices_module_req_create_channel.g.dart';

/// Request schema for creating new channel.
@Freezed()
class DevicesModuleReqCreateChannel with _$DevicesModuleReqCreateChannel {
  const factory DevicesModuleReqCreateChannel({
    required DevicesModuleCreateChannel data,
  }) = _DevicesModuleReqCreateChannel;
  
  factory DevicesModuleReqCreateChannel.fromJson(Map<String, Object?> json) => _$DevicesModuleReqCreateChannelFromJson(json);
}
