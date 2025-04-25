// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'config_module_req_update_section_data_union.dart';

part 'config_module_req_update_section.freezed.dart';
part 'config_module_req_update_section.g.dart';

/// Request schema for partial updating a configuration section.
@Freezed()
class ConfigModuleReqUpdateSection with _$ConfigModuleReqUpdateSection {
  const factory ConfigModuleReqUpdateSection({
    required ConfigModuleReqUpdateSectionDataUnion data,
  }) = _ConfigModuleReqUpdateSection;
  
  factory ConfigModuleReqUpdateSection.fromJson(Map<String, Object?> json) => _$ConfigModuleReqUpdateSectionFromJson(json);
}
