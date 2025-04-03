// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_req_create_data_source_data_union.dart';

part 'dashboard_req_create_data_source.freezed.dart';
part 'dashboard_req_create_data_source.g.dart';

/// Request schema for creating new data source.
@Freezed()
class DashboardReqCreateDataSource with _$DashboardReqCreateDataSource {
  const factory DashboardReqCreateDataSource({
    required DashboardReqCreateDataSourceDataUnion data,
  }) = _DashboardReqCreateDataSource;
  
  factory DashboardReqCreateDataSource.fromJson(Map<String, Object?> json) => _$DashboardReqCreateDataSourceFromJson(json);
}
