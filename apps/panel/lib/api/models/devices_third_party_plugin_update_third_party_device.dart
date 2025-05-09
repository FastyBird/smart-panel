// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_third_party_plugin_update_third_party_device.freezed.dart';
part 'devices_third_party_plugin_update_third_party_device.g.dart';

/// Schema for updating a third-party device.
@Freezed()
class DevicesThirdPartyPluginUpdateThirdPartyDevice with _$DevicesThirdPartyPluginUpdateThirdPartyDevice {
  const factory DevicesThirdPartyPluginUpdateThirdPartyDevice({
    /// Specifies the type of device.
    required String type,

    /// Human-readable name of the device.
    required String name,

    /// A url address of the third-party device endpoint.
    @JsonKey(name: 'service_address')
    required String serviceAddress,

    /// Optional detailed description of the device.
    String? description,
  }) = _DevicesThirdPartyPluginUpdateThirdPartyDevice;
  
  factory DevicesThirdPartyPluginUpdateThirdPartyDevice.fromJson(Map<String, Object?> json) => _$DevicesThirdPartyPluginUpdateThirdPartyDeviceFromJson(json);
}
