// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_data_source.dart';

part 'dashboard_page.freezed.dart';
part 'dashboard_page.g.dart';

/// The base schema for all dashboard pages, including common properties such as id, type, title, and timestamps.
@Freezed()
class DashboardPage with _$DashboardPage {
  const factory DashboardPage({
    /// A unique identifier for the dashboard page.
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page, displayed in the UI.
    required String title,

    /// The icon representing the dashboard page.
    required String? icon,

    /// A list of data sources used by the page, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardDataSource> dataSource,

    /// The timestamp when the dashboard page was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard page was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The display order of the dashboard page in the navigation or list.
    @Default(0)
    int order,
  }) = _DashboardPage;
  
  factory DashboardPage.fromJson(Map<String, Object?> json) => _$DashboardPageFromJson(json);
}
