// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_channel_property_category.dart';
import 'devices_module_create_channel_property_data_type.dart';
import 'devices_module_create_channel_property_permissions.dart';

part 'devices_module_create_channel_property.freezed.dart';
part 'devices_module_create_channel_property.g.dart';

/// Schema for creating a new property within a channel, representing a specific characteristic or functional value.
@Freezed()
class DevicesModuleCreateChannelProperty with _$DevicesModuleCreateChannelProperty {
  const factory DevicesModuleCreateChannelProperty({
    /// Unique identifier for the property. Optional during creation and system-generated if not provided.
    required String id,

    /// Defines the category of the property, representing its functionality or characteristic.
    required DevicesModuleChannelPropertyCategory category,

    /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
    required List<DevicesModuleCreateChannelPropertyPermissions> permissions,

    /// Data type of the property’s value, e.g., string, integer, or boolean.
    @JsonKey(name: 'data_type')
    required DevicesModuleCreateChannelPropertyDataType dataType,

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
  }) = _DevicesModuleCreateChannelProperty;
  
  factory DevicesModuleCreateChannelProperty.fromJson(Map<String, Object?> json) => _$DevicesModuleCreateChannelPropertyFromJson(json);
}
