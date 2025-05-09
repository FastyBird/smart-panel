// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_channel_property_category.dart';
import 'devices_module_create_channel_property_data_type.dart';
import 'devices_module_create_channel_property_permissions.dart';

part 'devices_home_assistant_plugin_create_home_assistant_channel_property.freezed.dart';
part 'devices_home_assistant_plugin_create_home_assistant_channel_property.g.dart';

/// The schema for creating a Home Assistant channel property.
@Freezed()
class DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty with _$DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty {
  const factory DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty({
    /// Unique identifier for the property. Optional during creation and system-generated if not provided.
    required String id,

    /// Specifies the type of channel property.
    required String type,

    /// Defines the category of the property, representing its functionality or characteristic.
    required DevicesModuleChannelPropertyCategory category,

    /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
    required List<DevicesModuleCreateChannelPropertyPermissions> permissions,

    /// Data type of the property’s value, e.g., string, integer, or boolean.
    @JsonKey(name: 'data_type')
    required DevicesModuleCreateChannelPropertyDataType dataType,

    /// A HA device entity attribute.
    @JsonKey(name: 'ha_attribute')
    required String? haAttribute,

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
  }) = _DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty;
  
  factory DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty.fromJson(Map<String, Object?> json) => _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyFromJson(json);
}
