// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_req_update_page_data_union.dart';

part 'dashboard_req_update_page.freezed.dart';
part 'dashboard_req_update_page.g.dart';

/// Request schema for updating an existing page.
@Freezed()
class DashboardReqUpdatePage with _$DashboardReqUpdatePage {
  const factory DashboardReqUpdatePage({
    required DashboardReqUpdatePageDataUnion data,
  }) = _DashboardReqUpdatePage;
  
  factory DashboardReqUpdatePage.fromJson(Map<String, Object?> json) => _$DashboardReqUpdatePageFromJson(json);
}
