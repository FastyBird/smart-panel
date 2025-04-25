// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_update_channel.dart';

part 'devices_module_req_update_channel.freezed.dart';
part 'devices_module_req_update_channel.g.dart';

/// Request schema for updating an existing channel.
@Freezed()
class DevicesModuleReqUpdateChannel with _$DevicesModuleReqUpdateChannel {
  const factory DevicesModuleReqUpdateChannel({
    required DevicesModuleUpdateChannel data,
  }) = _DevicesModuleReqUpdateChannel;
  
  factory DevicesModuleReqUpdateChannel.fromJson(Map<String, Object?> json) => _$DevicesModuleReqUpdateChannelFromJson(json);
}
