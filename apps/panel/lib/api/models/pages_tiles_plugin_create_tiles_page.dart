// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_create_data_source.dart';
import 'dashboard_module_create_tile.dart';

part 'pages_tiles_plugin_create_tiles_page.freezed.dart';
part 'pages_tiles_plugin_create_tiles_page.g.dart';

/// The schema for creating a tiles dashboard page.
@Freezed()
class PagesTilesPluginCreateTilesPage with _$PagesTilesPluginCreateTilesPage {
  const factory PagesTilesPluginCreateTilesPage({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page.
    required String title,

    /// A list of data sources used by the page, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardModuleCreateDataSource> dataSource,

    /// A list of tiles associated with the tiles page.
    required List<DashboardModuleCreateTile> tiles,

    /// The position of the page in the dashboard’s list.
    @Default(0)
    int order,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = _PagesTilesPluginCreateTilesPage;
  
  factory PagesTilesPluginCreateTilesPage.fromJson(Map<String, Object?> json) => _$PagesTilesPluginCreateTilesPageFromJson(json);
}
