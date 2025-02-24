// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_req_update_device_data_union.freezed.dart';
part 'devices_req_update_device_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DevicesReqUpdateDeviceDataUnion with _$DevicesReqUpdateDeviceDataUnion {
  @FreezedUnionValue('third-party')
  const factory DevicesReqUpdateDeviceDataUnion.thirdParty({
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
  }) = DevicesReqUpdateDeviceDataUnionThirdParty;

  
  factory DevicesReqUpdateDeviceDataUnion.fromJson(Map<String, Object?> json) => _$DevicesReqUpdateDeviceDataUnionFromJson(json);
}
