// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_create_channel_property.dart';

part 'devices_req_create_channel_property.freezed.dart';
part 'devices_req_create_channel_property.g.dart';

/// Request schema for creating new channel property.
@Freezed()
class DevicesReqCreateChannelProperty with _$DevicesReqCreateChannelProperty {
  const factory DevicesReqCreateChannelProperty({
    required DevicesCreateChannelProperty data,
  }) = _DevicesReqCreateChannelProperty;
  
  factory DevicesReqCreateChannelProperty.fromJson(Map<String, Object?> json) => _$DevicesReqCreateChannelPropertyFromJson(json);
}
