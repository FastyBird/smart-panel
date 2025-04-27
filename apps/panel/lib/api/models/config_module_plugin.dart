// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'config_module_plugin.freezed.dart';
part 'config_module_plugin.g.dart';

/// Schema for plugin configuration.
@Freezed()
class ConfigModulePlugin with _$ConfigModulePlugin {
  const factory ConfigModulePlugin({
    /// Configuration plugin type
    @Default('custom-plugin')
    String type,
  }) = _ConfigModulePlugin;
  
  factory ConfigModulePlugin.fromJson(Map<String, Object?> json) => _$ConfigModulePluginFromJson(json);
}
