// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_channel.dart';
import 'devices_device_category.dart';
import 'devices_device_control.dart';

part 'devices_res_devices_data_union.freezed.dart';
part 'devices_res_devices_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DevicesResDevicesDataUnion with _$DevicesResDevicesDataUnion {
  @FreezedUnionValue('third-party')
  const factory DevicesResDevicesDataUnion.thirdParty({
    /// System-generated unique identifier for the device.
    required String id,

    /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
    required DevicesDeviceCategory category,

    /// Human-readable name of the device.
    required String name,

    /// Optional detailed description of the device.
    required String? description,

    /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
    required List<DevicesDeviceControl> controls,

    /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
    required List<DevicesChannel> channels,

    /// Timestamp indicating when the device was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// Timestamp indicating when the device was last updated, if applicable.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The address of the third-party service used by the third-party device. It can be a URL or IP address with an optional port.
    @JsonKey(name: 'service_address')
    required String serviceAddress,

    /// Specifies the type of device. This value is fixed as 'third-party' for third-party device integrations.
    @Default('third-party')
    String type,
  }) = DevicesResDevicesDataUnionThirdParty;

  
  factory DevicesResDevicesDataUnion.fromJson(Map<String, Object?> json) => _$DevicesResDevicesDataUnionFromJson(json);
}
