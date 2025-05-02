// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_home_assistant_plugin_update_home_assistant_channel_property.freezed.dart';
part 'devices_home_assistant_plugin_update_home_assistant_channel_property.g.dart';

/// Schema for updating a Home Assistant channel property.
@Freezed()
class DevicesHomeAssistantPluginUpdateHomeAssistantChannelProperty with _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelProperty {
  const factory DevicesHomeAssistantPluginUpdateHomeAssistantChannelProperty({
    /// Specifies the type of channel property.
    required String type,

    /// Optional name of the property for easier identification.
    String? name,

    /// Measurement unit associated with the property’s value, if applicable.
    String? unit,

    /// List of valid values or states for the property, where applicable.
    List<dynamic>? format,

    /// Value to represent an invalid state for the property.
    dynamic invalid,

    /// Step value indicating the smallest increment for the property.
    num? step,

    /// Current value of the property.
    dynamic value,
  }) = _DevicesHomeAssistantPluginUpdateHomeAssistantChannelProperty;
  
  factory DevicesHomeAssistantPluginUpdateHomeAssistantChannelProperty.fromJson(Map<String, Object?> json) => _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelPropertyFromJson(json);
}
