// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_req_create_page_data_source_data_union.dart';

part 'dashboard_req_create_page_data_source.freezed.dart';
part 'dashboard_req_create_page_data_source.g.dart';

/// Request schema for creating new page data source.
@Freezed()
class DashboardReqCreatePageDataSource with _$DashboardReqCreatePageDataSource {
  const factory DashboardReqCreatePageDataSource({
    required DashboardReqCreatePageDataSourceDataUnion data,
  }) = _DashboardReqCreatePageDataSource;
  
  factory DashboardReqCreatePageDataSource.fromJson(Map<String, Object?> json) => _$DashboardReqCreatePageDataSourceFromJson(json);
}
