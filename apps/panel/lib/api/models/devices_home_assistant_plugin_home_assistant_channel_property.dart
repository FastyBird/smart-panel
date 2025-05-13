// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_channel_property_category.dart';
import 'devices_module_channel_property_data_type.dart';
import 'devices_module_channel_property_permissions.dart';

part 'devices_home_assistant_plugin_home_assistant_channel_property.freezed.dart';
part 'devices_home_assistant_plugin_home_assistant_channel_property.g.dart';

/// A Home Assistant properties used to communicate with Home Assistant instance.
@Freezed()
class DevicesHomeAssistantPluginHomeAssistantChannelProperty with _$DevicesHomeAssistantPluginHomeAssistantChannelProperty {
  const factory DevicesHomeAssistantPluginHomeAssistantChannelProperty({
    /// System-generated unique identifier for the channel property.
    required String id,

    /// Specifies the type of channel property.
    required String type,

    /// Defines the category of the property, representing its functionality or characteristic.
    required DevicesModuleChannelPropertyCategory category,

    /// Optional name of the property for easier identification.
    required String? name,

    /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
    required List<DevicesModuleChannelPropertyPermissions> permissions,

    /// Measurement unit associated with the property’s value, if applicable.
    required String? unit,

    /// List of valid values or states for the property, where applicable.
    required List<dynamic>? format,

    /// Value to represent an invalid state for the property.
    required dynamic invalid,

    /// Step value indicating the smallest increment for the property.
    required num? step,

    /// Current value of the property.
    required dynamic value,

    /// Reference to the channel that this property belongs to.
    required String channel,

    /// Timestamp when the control was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// Timestamp when the control was last updated, if applicable.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// A HA device entity identifier.
    @JsonKey(name: 'ha_entity_id')
    required String? haEntityId,

    /// A HA device entity attribute.
    @JsonKey(name: 'ha_attribute')
    required String? haAttribute,

    /// Data type of the property’s value, e.g., string, integer, or boolean.
    @JsonKey(name: 'data_type')
    @Default(DevicesModuleChannelPropertyDataType.unknown)
    DevicesModuleChannelPropertyDataType dataType,
  }) = _DevicesHomeAssistantPluginHomeAssistantChannelProperty;
  
  factory DevicesHomeAssistantPluginHomeAssistantChannelProperty.fromJson(Map<String, Object?> json) => _$DevicesHomeAssistantPluginHomeAssistantChannelPropertyFromJson(json);
}
