// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_home_assistant_plugin_update_home_assistant_channel.freezed.dart';
part 'devices_home_assistant_plugin_update_home_assistant_channel.g.dart';

/// Schema for updating a Home Assistant channel.
@Freezed()
class DevicesHomeAssistantPluginUpdateHomeAssistantChannel with _$DevicesHomeAssistantPluginUpdateHomeAssistantChannel {
  const factory DevicesHomeAssistantPluginUpdateHomeAssistantChannel({
    /// Specifies the type of channel.
    required String type,

    /// Human-readable name of the channel.
    required String name,

    /// Optional description of the channel’s purpose or functionality.
    String? description,
  }) = _DevicesHomeAssistantPluginUpdateHomeAssistantChannel;
  
  factory DevicesHomeAssistantPluginUpdateHomeAssistantChannel.fromJson(Map<String, Object?> json) => _$DevicesHomeAssistantPluginUpdateHomeAssistantChannelFromJson(json);
}
