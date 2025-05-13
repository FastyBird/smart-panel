// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_channel_category.dart';
import 'devices_module_create_channel_control.dart';
import 'devices_module_create_channel_property.dart';

part 'devices_home_assistant_plugin_create_home_assistant_channel.freezed.dart';
part 'devices_home_assistant_plugin_create_home_assistant_channel.g.dart';

/// The schema for creating a Home Assistant channel.
@Freezed()
class DevicesHomeAssistantPluginCreateHomeAssistantChannel with _$DevicesHomeAssistantPluginCreateHomeAssistantChannel {
  const factory DevicesHomeAssistantPluginCreateHomeAssistantChannel({
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
  }) = _DevicesHomeAssistantPluginCreateHomeAssistantChannel;
  
  factory DevicesHomeAssistantPluginCreateHomeAssistantChannel.fromJson(Map<String, Object?> json) => _$DevicesHomeAssistantPluginCreateHomeAssistantChannelFromJson(json);
}
