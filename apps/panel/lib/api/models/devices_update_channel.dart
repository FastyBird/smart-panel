// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_update_channel.freezed.dart';
part 'devices_update_channel.g.dart';

/// Schema for updating a channel, including optional updates to its name and description.
@Freezed()
class DevicesUpdateChannel with _$DevicesUpdateChannel {
  const factory DevicesUpdateChannel({
    /// Human-readable name of the channel.
    required String name,

    /// Optional description of the channel’s purpose or functionality.
    String? description,
  }) = _DevicesUpdateChannel;
  
  factory DevicesUpdateChannel.fromJson(Map<String, Object?> json) => _$DevicesUpdateChannelFromJson(json);
}
