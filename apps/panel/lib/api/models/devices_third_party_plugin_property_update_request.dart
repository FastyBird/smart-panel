// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_third_party_plugin_property_update_request.freezed.dart';
part 'devices_third_party_plugin_property_update_request.g.dart';

/// Represents a request to update a specific property on a third-party device.
@Freezed()
class DevicesThirdPartyPluginPropertyUpdateRequest with _$DevicesThirdPartyPluginPropertyUpdateRequest {
  const factory DevicesThirdPartyPluginPropertyUpdateRequest({
    /// Unique identifier of the target device.
    required String device,

    /// Unique identifier of the target device channel.
    required String channel,

    /// Unique identifier of the property being updated.
    required String property,

    /// New value to be applied to the property.
    required dynamic value,
  }) = _DevicesThirdPartyPluginPropertyUpdateRequest;
  
  factory DevicesThirdPartyPluginPropertyUpdateRequest.fromJson(Map<String, Object?> json) => _$DevicesThirdPartyPluginPropertyUpdateRequestFromJson(json);
}
