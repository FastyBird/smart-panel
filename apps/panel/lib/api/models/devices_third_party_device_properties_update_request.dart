// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_third_party_device_property_update_request.dart';

part 'devices_third_party_device_properties_update_request.freezed.dart';
part 'devices_third_party_device_properties_update_request.g.dart';

/// Represents a request to update one or more properties on a third-party device.
@Freezed()
class DevicesThirdPartyDevicePropertiesUpdateRequest with _$DevicesThirdPartyDevicePropertiesUpdateRequest {
  const factory DevicesThirdPartyDevicePropertiesUpdateRequest({
    /// Represents a single property update operation for a third-party device.
    required List<DevicesThirdPartyDevicePropertyUpdateRequest> properties,
  }) = _DevicesThirdPartyDevicePropertiesUpdateRequest;
  
  factory DevicesThirdPartyDevicePropertiesUpdateRequest.fromJson(Map<String, Object?> json) => _$DevicesThirdPartyDevicePropertiesUpdateRequestFromJson(json);
}
