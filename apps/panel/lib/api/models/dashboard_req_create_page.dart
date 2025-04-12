// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_page.dart';

part 'dashboard_req_create_page.freezed.dart';
part 'dashboard_req_create_page.g.dart';

/// Request schema for creating new page.
@Freezed()
class DashboardReqCreatePage with _$DashboardReqCreatePage {
  const factory DashboardReqCreatePage({
    required DashboardCreatePage data,
  }) = _DashboardReqCreatePage;
  
  factory DashboardReqCreatePage.fromJson(Map<String, Object?> json) => _$DashboardReqCreatePageFromJson(json);
}
