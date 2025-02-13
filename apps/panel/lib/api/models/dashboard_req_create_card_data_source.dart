// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_req_create_card_data_source_data_union.dart';

part 'dashboard_req_create_card_data_source.freezed.dart';
part 'dashboard_req_create_card_data_source.g.dart';

/// Request schema for creating new card data source.
@Freezed()
class DashboardReqCreateCardDataSource with _$DashboardReqCreateCardDataSource {
  const factory DashboardReqCreateCardDataSource({
    required DashboardReqCreateCardDataSourceDataUnion data,
  }) = _DashboardReqCreateCardDataSource;
  
  factory DashboardReqCreateCardDataSource.fromJson(Map<String, Object?> json) => _$DashboardReqCreateCardDataSourceFromJson(json);
}
