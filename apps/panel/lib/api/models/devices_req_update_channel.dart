// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_update_channel.dart';

part 'devices_req_update_channel.freezed.dart';
part 'devices_req_update_channel.g.dart';

/// Request schema for updating an existing channel.
@Freezed()
class DevicesReqUpdateChannel with _$DevicesReqUpdateChannel {
  const factory DevicesReqUpdateChannel({
    required DevicesUpdateChannel data,
  }) = _DevicesReqUpdateChannel;
  
  factory DevicesReqUpdateChannel.fromJson(Map<String, Object?> json) => _$DevicesReqUpdateChannelFromJson(json);
}
