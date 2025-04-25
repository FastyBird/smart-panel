// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_create_data_source.dart';

part 'dashboard_module_req_create_data_source_with_parent.freezed.dart';
part 'dashboard_module_req_create_data_source_with_parent.g.dart';

/// Request schema for creating new data source.
@Freezed()
class DashboardModuleReqCreateDataSourceWithParent with _$DashboardModuleReqCreateDataSourceWithParent {
  const factory DashboardModuleReqCreateDataSourceWithParent({
    required DashboardModuleCreateDataSource data,
  }) = _DashboardModuleReqCreateDataSourceWithParent;
  
  factory DashboardModuleReqCreateDataSourceWithParent.fromJson(Map<String, Object?> json) => _$DashboardModuleReqCreateDataSourceWithParentFromJson(json);
}
