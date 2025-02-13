// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'devices_channel_category.dart';
import 'devices_create_channel_control.dart';
import 'devices_create_channel_property.dart';

part 'devices_create_channel.freezed.dart';
part 'devices_create_channel.g.dart';

/// Schema representing a request to create a new channel for a device.
@Freezed()
class DevicesCreateChannel with _$DevicesCreateChannel {
  const factory DevicesCreateChannel({
    /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
    required String id,

    /// Type of the channel, indicating its functional category (e.g., temperature, light).
    required DevicesChannelCategory category,

    /// Human-readable name of the channel.
    required String name,

    /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
    required List<DevicesCreateChannelControl> controls,

    /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
    required List<DevicesCreateChannelProperty> properties,

    /// The parent device to which this channel belongs.
    required String device,

    /// Optional description of the channel’s purpose or functionality.
    String? description,
  }) = _DevicesCreateChannel;
  
  factory DevicesCreateChannel.fromJson(Map<String, Object?> json) => _$DevicesCreateChannelFromJson(json);
}
