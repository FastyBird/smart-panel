// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_create_page.dart';

part 'dashboard_module_req_create_page.freezed.dart';
part 'dashboard_module_req_create_page.g.dart';

/// Request schema for creating new page.
@Freezed()
class DashboardModuleReqCreatePage with _$DashboardModuleReqCreatePage {
  const factory DashboardModuleReqCreatePage({
    required DashboardModuleCreatePage data,
  }) = _DashboardModuleReqCreatePage;
  
  factory DashboardModuleReqCreatePage.fromJson(Map<String, Object?> json) => _$DashboardModuleReqCreatePageFromJson(json);
}
