// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_create_channel_control.dart';

part 'devices_module_req_create_channel_control.freezed.dart';
part 'devices_module_req_create_channel_control.g.dart';

/// Request schema for creating new channel control.
@Freezed()
class DevicesModuleReqCreateChannelControl with _$DevicesModuleReqCreateChannelControl {
  const factory DevicesModuleReqCreateChannelControl({
    required DevicesModuleCreateChannelControl data,
  }) = _DevicesModuleReqCreateChannelControl;
  
  factory DevicesModuleReqCreateChannelControl.fromJson(Map<String, Object?> json) => _$DevicesModuleReqCreateChannelControlFromJson(json);
}
