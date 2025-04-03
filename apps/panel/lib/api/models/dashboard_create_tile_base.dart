// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_tile_base_data_source_union.dart';

part 'dashboard_create_tile_base.freezed.dart';
part 'dashboard_create_tile_base.g.dart';

/// Base schema for creating a dashboard tile, containing shared attributes such as position and size.
@Freezed()
class DashboardCreateTileBase with _$DashboardCreateTileBase {
  const factory DashboardCreateTileBase({
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
    required List<DashboardCreateTileBaseDataSourceUnion> dataSource,

    /// The number of rows the tile spans in the grid.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans in the grid.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = _DashboardCreateTileBase;
  
  factory DashboardCreateTileBase.fromJson(Map<String, Object?> json) => _$DashboardCreateTileBaseFromJson(json);
}
