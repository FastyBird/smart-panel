// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_module_update_plugin.dart';

part 'config_module_req_update_plugin.freezed.dart';
part 'config_module_req_update_plugin.g.dart';

/// Request schema for partial updating a configuration plugin.
@Freezed()
class ConfigModuleReqUpdatePlugin with _$ConfigModuleReqUpdatePlugin {
  const factory ConfigModuleReqUpdatePlugin({
    required ConfigModuleUpdatePlugin data,
  }) = _ConfigModuleReqUpdatePlugin;
  
  factory ConfigModuleReqUpdatePlugin.fromJson(Map<String, Object?> json) => _$ConfigModuleReqUpdatePluginFromJson(json);
}
