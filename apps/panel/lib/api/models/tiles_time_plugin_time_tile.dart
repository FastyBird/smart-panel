// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_data_source.dart';
import 'parent.dart';

part 'tiles_time_plugin_time_tile.freezed.dart';
part 'tiles_time_plugin_time_tile.g.dart';

/// A dashboard tile displaying a clock.
@Freezed()
class TilesTimePluginTimeTile with _$TilesTimePluginTimeTile {
  const factory TilesTimePluginTimeTile({
    /// A unique identifier for the dashboard tile.
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// Discriminator for the data source type
    required Parent parent,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardModuleDataSource> dataSource,

    /// The timestamp when the dashboard tile was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard tile was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The number of rows the tile spans.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,

    /// Informing that this tile is not displayed on the display application.
    @Default(false)
    bool hidden,
  }) = _TilesTimePluginTimeTile;
  
  factory TilesTimePluginTimeTile.fromJson(Map<String, Object?> json) => _$TilesTimePluginTimeTileFromJson(json);
}
