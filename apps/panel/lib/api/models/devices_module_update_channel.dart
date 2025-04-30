// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'devices_module_update_channel.freezed.dart';
part 'devices_module_update_channel.g.dart';

/// Schema for updating a channel, including optional updates to its name and description.
@Freezed()
class DevicesModuleUpdateChannel with _$DevicesModuleUpdateChannel {
  const factory DevicesModuleUpdateChannel({
    /// Specifies the type of channel.
    required String type,

    /// Human-readable name of the channel.
    required String name,

    /// Optional description of the channel’s purpose or functionality.
    String? description,
  }) = _DevicesModuleUpdateChannel;
  
  factory DevicesModuleUpdateChannel.fromJson(Map<String, Object?> json) => _$DevicesModuleUpdateChannelFromJson(json);
}
