// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_update_data_source.dart';

part 'dashboard_module_req_update_data_source.freezed.dart';
part 'dashboard_module_req_update_data_source.g.dart';

/// Request schema for updating an existing data source.
@Freezed()
class DashboardModuleReqUpdateDataSource with _$DashboardModuleReqUpdateDataSource {
  const factory DashboardModuleReqUpdateDataSource({
    required DashboardModuleUpdateDataSource data,
  }) = _DashboardModuleReqUpdateDataSource;
  
  factory DashboardModuleReqUpdateDataSource.fromJson(Map<String, Object?> json) => _$DashboardModuleReqUpdateDataSourceFromJson(json);
}
