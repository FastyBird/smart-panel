// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_create_data_source.dart';

part 'tiles_time_plugin_create_time_tile.freezed.dart';
part 'tiles_time_plugin_create_time_tile.g.dart';

/// Schema for creating a dashboard tile representing a clock.
@Freezed()
class TilesTimePluginCreateTimeTile with _$TilesTimePluginCreateTimeTile {
  const factory TilesTimePluginCreateTimeTile({
    /// Unique identifier for the dashboard tile (optional during creation).
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardModuleCreateDataSource> dataSource,

    /// The number of rows the tile spans in the grid.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans in the grid.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,

    /// Mark the tile as hidden and will not be displayed on the display application.
    @Default(false)
    bool hidden,
  }) = _TilesTimePluginCreateTimeTile;
  
  factory TilesTimePluginCreateTimeTile.fromJson(Map<String, Object?> json) => _$TilesTimePluginCreateTimeTileFromJson(json);
}
