// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_update_channel_property.dart';

part 'devices_module_req_update_channel_property.freezed.dart';
part 'devices_module_req_update_channel_property.g.dart';

/// Request schema for updating an existing channel property.
@Freezed()
class DevicesModuleReqUpdateChannelProperty with _$DevicesModuleReqUpdateChannelProperty {
  const factory DevicesModuleReqUpdateChannelProperty({
    required DevicesModuleUpdateChannelProperty data,
  }) = _DevicesModuleReqUpdateChannelProperty;
  
  factory DevicesModuleReqUpdateChannelProperty.fromJson(Map<String, Object?> json) => _$DevicesModuleReqUpdateChannelPropertyFromJson(json);
}
