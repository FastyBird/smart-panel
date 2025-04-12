// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_data_source.dart';

part 'dashboard_create_page.freezed.dart';
part 'dashboard_create_page.g.dart';

/// The base schema for creating a new dashboard page, containing shared attributes like title and order.
@Freezed()
class DashboardCreatePage with _$DashboardCreatePage {
  const factory DashboardCreatePage({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page.
    required String title,

    /// A list of data sources used by the page, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateDataSource> dataSource,

    /// The position of the page in the dashboard’s list.
    @Default(0)
    int order,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = _DashboardCreatePage;
  
  factory DashboardCreatePage.fromJson(Map<String, Object?> json) => _$DashboardCreatePageFromJson(json);
}
