// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'config_module_update_plugin.freezed.dart';
part 'config_module_update_plugin.g.dart';

/// Schema for partial update settings for plugin configuration.
@Freezed()
class ConfigModuleUpdatePlugin with _$ConfigModuleUpdatePlugin {
  const factory ConfigModuleUpdatePlugin({
    /// Configuration plugin type
    required String type,
  }) = _ConfigModuleUpdatePlugin;
  
  factory ConfigModuleUpdatePlugin.fromJson(Map<String, Object?> json) => _$ConfigModuleUpdatePluginFromJson(json);
}
