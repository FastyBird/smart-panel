// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_req_create_tile_data_source_data_union.dart';

part 'dashboard_req_create_tile_data_source.freezed.dart';
part 'dashboard_req_create_tile_data_source.g.dart';

/// Request schema for creating new tile data source.
@Freezed()
class DashboardReqCreateTileDataSource with _$DashboardReqCreateTileDataSource {
  const factory DashboardReqCreateTileDataSource({
    required DashboardReqCreateTileDataSourceDataUnion data,
  }) = _DashboardReqCreateTileDataSource;
  
  factory DashboardReqCreateTileDataSource.fromJson(Map<String, Object?> json) => _$DashboardReqCreateTileDataSourceFromJson(json);
}
