// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_update_third_party_device.freezed.dart';
part 'devices_update_third_party_device.g.dart';

/// Schema for updating a third-party device, including its basic details and the service address it connects to.
@Freezed()
class DevicesUpdateThirdPartyDevice with _$DevicesUpdateThirdPartyDevice {
  const factory DevicesUpdateThirdPartyDevice({
    /// Human-readable name of the device.
    required String name,

    /// The address of the third-party service used by the third-party device. It can be a URL or IP address with an optional port.
    @JsonKey(name: 'service_address')
    required String serviceAddress,

    /// Specifies the type of device. This value is fixed as 'third-party' for third-party device integrations.
    @Default('third-party')
    String type,

    /// Optional detailed description of the device.
    String? description,
  }) = _DevicesUpdateThirdPartyDevice;
  
  factory DevicesUpdateThirdPartyDevice.fromJson(Map<String, Object?> json) => _$DevicesUpdateThirdPartyDeviceFromJson(json);
}
