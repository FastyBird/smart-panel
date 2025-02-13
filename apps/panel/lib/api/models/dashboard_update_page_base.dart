// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_page_base.freezed.dart';
part 'dashboard_update_page_base.g.dart';

/// Base schema for updating a dashboard page.
@Freezed()
class DashboardUpdatePageBase with _$DashboardUpdatePageBase {
  const factory DashboardUpdatePageBase({
    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// The icon associated with the page.
    String? icon,
  }) = _DashboardUpdatePageBase;
  
  factory DashboardUpdatePageBase.fromJson(Map<String, Object?> json) => _$DashboardUpdatePageBaseFromJson(json);
}
