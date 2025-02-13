// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_create_channel_control.dart';

part 'devices_req_create_channel_control.freezed.dart';
part 'devices_req_create_channel_control.g.dart';

/// Request schema for creating new channel control.
@Freezed()
class DevicesReqCreateChannelControl with _$DevicesReqCreateChannelControl {
  const factory DevicesReqCreateChannelControl({
    required DevicesCreateChannelControl data,
  }) = _DevicesReqCreateChannelControl;
  
  factory DevicesReqCreateChannelControl.fromJson(Map<String, Object?> json) => _$DevicesReqCreateChannelControlFromJson(json);
}
