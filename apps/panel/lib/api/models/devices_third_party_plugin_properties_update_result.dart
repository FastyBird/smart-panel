// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_third_party_plugin_property_update_result.dart';

part 'devices_third_party_plugin_properties_update_result.freezed.dart';
part 'devices_third_party_plugin_properties_update_result.g.dart';

/// Represents the overall response from a third-party device after processing an update request.
@Freezed()
class DevicesThirdPartyPluginPropertiesUpdateResult with _$DevicesThirdPartyPluginPropertiesUpdateResult {
  const factory DevicesThirdPartyPluginPropertiesUpdateResult({
    /// List of processed properties and their update results.
    required List<DevicesThirdPartyPluginPropertyUpdateResult> properties,
  }) = _DevicesThirdPartyPluginPropertiesUpdateResult;
  
  factory DevicesThirdPartyPluginPropertiesUpdateResult.fromJson(Map<String, Object?> json) => _$DevicesThirdPartyPluginPropertiesUpdateResultFromJson(json);
}
