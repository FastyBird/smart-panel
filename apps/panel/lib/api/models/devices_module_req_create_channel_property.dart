// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_create_channel_property.dart';

part 'devices_module_req_create_channel_property.freezed.dart';
part 'devices_module_req_create_channel_property.g.dart';

/// Request schema for creating new channel property.
@Freezed()
class DevicesModuleReqCreateChannelProperty with _$DevicesModuleReqCreateChannelProperty {
  const factory DevicesModuleReqCreateChannelProperty({
    required DevicesModuleCreateChannelProperty data,
  }) = _DevicesModuleReqCreateChannelProperty;
  
  factory DevicesModuleReqCreateChannelProperty.fromJson(Map<String, Object?> json) => _$DevicesModuleReqCreateChannelPropertyFromJson(json);
}
