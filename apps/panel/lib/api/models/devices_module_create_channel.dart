// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_channel_category.dart';
import 'devices_module_create_channel_control.dart';
import 'devices_module_create_channel_property.dart';

part 'devices_module_create_channel.freezed.dart';
part 'devices_module_create_channel.g.dart';

/// Schema representing a request to create a new channel for a device.
@Freezed()
class DevicesModuleCreateChannel with _$DevicesModuleCreateChannel {
  const factory DevicesModuleCreateChannel({
    /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
    required String id,

    /// Specifies the type of channel.
    required String type,

    /// Type of the channel, indicating its functional category (e.g., temperature, light).
    required DevicesModuleChannelCategory category,

    /// Human-readable name of the channel.
    required String name,

    /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
    required List<DevicesModuleCreateChannelControl> controls,

    /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
    required List<DevicesModuleCreateChannelProperty> properties,

    /// The parent device to which this channel belongs.
    required String device,

    /// Optional description of the channel’s purpose or functionality.
    String? description,
  }) = _DevicesModuleCreateChannel;
  
  factory DevicesModuleCreateChannel.fromJson(Map<String, Object?> json) => _$DevicesModuleCreateChannelFromJson(json);
}
