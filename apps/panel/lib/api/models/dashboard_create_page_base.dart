// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_create_page_base.freezed.dart';
part 'dashboard_create_page_base.g.dart';

/// The base schema for creating a new dashboard page, containing shared attributes like title and order.
@Freezed()
class DashboardCreatePageBase with _$DashboardCreatePageBase {
  const factory DashboardCreatePageBase({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page.
    required String title,

    /// The position of the page in the dashboard’s list.
    @Default(0)
    int order,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = _DashboardCreatePageBase;
  
  factory DashboardCreatePageBase.fromJson(Map<String, Object?> json) => _$DashboardCreatePageBaseFromJson(json);
}
