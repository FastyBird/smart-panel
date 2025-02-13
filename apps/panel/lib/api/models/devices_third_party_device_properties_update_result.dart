// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_third_party_device_property_update_result.dart';

part 'devices_third_party_device_properties_update_result.freezed.dart';
part 'devices_third_party_device_properties_update_result.g.dart';

/// Represents the overall response from a third-party device after processing an update request.
@Freezed()
class DevicesThirdPartyDevicePropertiesUpdateResult with _$DevicesThirdPartyDevicePropertiesUpdateResult {
  const factory DevicesThirdPartyDevicePropertiesUpdateResult({
    /// List of processed properties and their update results.
    required List<DevicesThirdPartyDevicePropertyUpdateResult> properties,
  }) = _DevicesThirdPartyDevicePropertiesUpdateResult;
  
  factory DevicesThirdPartyDevicePropertiesUpdateResult.fromJson(Map<String, Object?> json) => _$DevicesThirdPartyDevicePropertiesUpdateResultFromJson(json);
}
