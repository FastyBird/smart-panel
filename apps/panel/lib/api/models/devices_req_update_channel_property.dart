// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_update_channel_property.dart';

part 'devices_req_update_channel_property.freezed.dart';
part 'devices_req_update_channel_property.g.dart';

/// Request schema for updating an existing channel property.
@Freezed()
class DevicesReqUpdateChannelProperty with _$DevicesReqUpdateChannelProperty {
  const factory DevicesReqUpdateChannelProperty({
    required DevicesUpdateChannelProperty data,
  }) = _DevicesReqUpdateChannelProperty;
  
  factory DevicesReqUpdateChannelProperty.fromJson(Map<String, Object?> json) => _$DevicesReqUpdateChannelPropertyFromJson(json);
}
