// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_tiles_page_data_source_union.dart';
import 'dashboard_create_tiles_page_tiles_union.dart';

part 'dashboard_create_tiles_page.freezed.dart';
part 'dashboard_create_tiles_page.g.dart';

/// The schema for creating a tiles dashboard page.
@Freezed()
class DashboardCreateTilesPage with _$DashboardCreateTilesPage {
  const factory DashboardCreateTilesPage({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// The title of the dashboard page.
    required String title,

    /// The position of the page in the dashboard’s list.
    required int order,

    /// A list of tiles associated with the tiles page.
    required List<DashboardCreateTilesPageTilesUnion> tiles,

    /// A list of data sources associated with the tiles page.
    @JsonKey(name: 'data_source')
    required List<DashboardCreateTilesPageDataSourceUnion> dataSource,

    /// Indicates that this is a tiles dashboard page.
    @Default('tiles')
    String type,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = _DashboardCreateTilesPage;
  
  factory DashboardCreateTilesPage.fromJson(Map<String, Object?> json) => _$DashboardCreateTilesPageFromJson(json);
}
