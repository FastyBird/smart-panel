// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_update_data_source.dart';

part 'dashboard_req_update_data_source.freezed.dart';
part 'dashboard_req_update_data_source.g.dart';

/// Request schema for updating an existing data source.
@Freezed()
class DashboardReqUpdateDataSource with _$DashboardReqUpdateDataSource {
  const factory DashboardReqUpdateDataSource({
    required DashboardUpdateDataSource data,
  }) = _DashboardReqUpdateDataSource;
  
  factory DashboardReqUpdateDataSource.fromJson(Map<String, Object?> json) => _$DashboardReqUpdateDataSourceFromJson(json);
}
