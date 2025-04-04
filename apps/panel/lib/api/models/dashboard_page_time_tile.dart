// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_tile_base_data_source_union.dart';

part 'dashboard_page_time_tile.freezed.dart';
part 'dashboard_page_time_tile.g.dart';

/// A dashboard tile associated with a specific device.
@Freezed()
class DashboardPageTimeTile with _$DashboardPageTimeTile {
  const factory DashboardPageTimeTile({
    /// A unique identifier for the dashboard tile.
    required String id,

    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// A list of data sources used by the tile, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardTileBaseDataSourceUnion> dataSource,

    /// The timestamp when the dashboard tile was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard tile was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The unique identifier of the associated page.
    required String page,

    /// The number of rows the tile spans.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = _DashboardPageTimeTile;
  
  factory DashboardPageTimeTile.fromJson(Map<String, Object?> json) => _$DashboardPageTimeTileFromJson(json);
}
