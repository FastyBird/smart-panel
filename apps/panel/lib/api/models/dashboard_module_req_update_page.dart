// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_update_page.dart';

part 'dashboard_module_req_update_page.freezed.dart';
part 'dashboard_module_req_update_page.g.dart';

/// Request schema for updating an existing page.
@Freezed()
class DashboardModuleReqUpdatePage with _$DashboardModuleReqUpdatePage {
  const factory DashboardModuleReqUpdatePage({
    required DashboardModuleUpdatePage data,
  }) = _DashboardModuleReqUpdatePage;
  
  factory DashboardModuleReqUpdatePage.fromJson(Map<String, Object?> json) => _$DashboardModuleReqUpdatePageFromJson(json);
}
