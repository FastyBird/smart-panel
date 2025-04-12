// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_data_source.dart';
import 'dashboard_tile.dart';

part 'dashboard_tiles_page.freezed.dart';
part 'dashboard_tiles_page.g.dart';

/// A tiles page dashboard type, displaying a grid of customizable tiles.
@Freezed()
class DashboardTilesPage with _$DashboardTilesPage {
  const factory DashboardTilesPage({
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

    /// A list of tiles associated with the tiles page.
    required List<DashboardTile> tiles,

    /// The display order of the dashboard page in the navigation or list.
    @Default(0)
    int order,
  }) = _DashboardTilesPage;
  
  factory DashboardTilesPage.fromJson(Map<String, Object?> json) => _$DashboardTilesPageFromJson(json);
}
