// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_create_channel.dart';

part 'devices_req_create_channel.freezed.dart';
part 'devices_req_create_channel.g.dart';

/// Request schema for creating new channel.
@Freezed()
class DevicesReqCreateChannel with _$DevicesReqCreateChannel {
  const factory DevicesReqCreateChannel({
    required DevicesCreateChannel data,
  }) = _DevicesReqCreateChannel;
  
  factory DevicesReqCreateChannel.fromJson(Map<String, Object?> json) => _$DevicesReqCreateChannelFromJson(json);
}
