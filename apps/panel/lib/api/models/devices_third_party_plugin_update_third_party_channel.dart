// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_third_party_plugin_update_third_party_channel.freezed.dart';
part 'devices_third_party_plugin_update_third_party_channel.g.dart';

/// Schema for updating a Home Assistant channel.
@Freezed()
class DevicesThirdPartyPluginUpdateThirdPartyChannel with _$DevicesThirdPartyPluginUpdateThirdPartyChannel {
  const factory DevicesThirdPartyPluginUpdateThirdPartyChannel({
    /// Specifies the type of channel.
    required String type,

    /// Human-readable name of the channel.
    required String name,

    /// Optional description of the channel’s purpose or functionality.
    String? description,
  }) = _DevicesThirdPartyPluginUpdateThirdPartyChannel;
  
  factory DevicesThirdPartyPluginUpdateThirdPartyChannel.fromJson(Map<String, Object?> json) => _$DevicesThirdPartyPluginUpdateThirdPartyChannelFromJson(json);
}
