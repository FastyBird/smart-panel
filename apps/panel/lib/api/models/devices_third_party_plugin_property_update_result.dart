// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_third_party_plugin_error_code.dart';

part 'devices_third_party_plugin_property_update_result.freezed.dart';
part 'devices_third_party_plugin_property_update_result.g.dart';

/// Represents the result of an update operation for a specific property on a third-party device.
@Freezed()
class DevicesThirdPartyPluginPropertyUpdateResult with _$DevicesThirdPartyPluginPropertyUpdateResult {
  const factory DevicesThirdPartyPluginPropertyUpdateResult({
    /// Unique identifier of the device for which the update was requested.
    required String device,

    /// Unique identifier of the channel that was updated.
    required String channel,

    /// Unique identifier of the property that was updated.
    required String property,

    /// Status code indicating the outcome of the update request. A value of 0 indicates success, while negative values indicate errors.
    required DevicesThirdPartyPluginErrorCode status,
  }) = _DevicesThirdPartyPluginPropertyUpdateResult;
  
  factory DevicesThirdPartyPluginPropertyUpdateResult.fromJson(Map<String, Object?> json) => _$DevicesThirdPartyPluginPropertyUpdateResultFromJson(json);
}
