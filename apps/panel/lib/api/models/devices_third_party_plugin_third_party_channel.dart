// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_module_channel_category.dart';
import 'devices_module_channel_control.dart';
import 'devices_module_channel_property.dart';

part 'devices_third_party_plugin_third_party_channel.freezed.dart';
part 'devices_third_party_plugin_third_party_channel.g.dart';

/// A Home Assistant channels used to communicate with Home Assistant instance.
@Freezed()
class DevicesThirdPartyPluginThirdPartyChannel with _$DevicesThirdPartyPluginThirdPartyChannel {
  const factory DevicesThirdPartyPluginThirdPartyChannel({
    /// System-generated unique identifier for the channel.
    required String id,

    /// Specifies the type of channel.
    required String type,

    /// Type of the channel, indicating its functional category (e.g., temperature, light).
    required DevicesModuleChannelCategory category,

    /// Human-readable name of the channel.
    required String name,

    /// Optional description of the channel’s purpose or functionality.
    required String? description,

    /// The parent device to which this channel belongs.
    required String device,

    /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
    required List<DevicesModuleChannelControl> controls,

    /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
    required List<DevicesModuleChannelProperty> properties,

    /// Timestamp when the channel was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// Timestamp when the channel was last updated, if applicable.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,
  }) = _DevicesThirdPartyPluginThirdPartyChannel;
  
  factory DevicesThirdPartyPluginThirdPartyChannel.fromJson(Map<String, Object?> json) => _$DevicesThirdPartyPluginThirdPartyChannelFromJson(json);
}
