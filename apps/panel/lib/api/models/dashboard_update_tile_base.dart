// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_tile_base.freezed.dart';
part 'dashboard_update_tile_base.g.dart';

/// Base schema for updating a tile in the dashboard.
@Freezed()
class DashboardUpdateTileBase with _$DashboardUpdateTileBase {
  const factory DashboardUpdateTileBase({
    /// Discriminator for the tile type
    required String type,

    /// The row position of the tile in the grid.
    required int row,

    /// The column position of the tile in the grid.
    required int col,

    /// The number of rows the tile spans in the grid.
    @JsonKey(name: 'row_span')
    required int rowSpan,

    /// The number of columns the tile spans in the grid.
    @JsonKey(name: 'col_span')
    required int colSpan,
  }) = _DashboardUpdateTileBase;
  
  factory DashboardUpdateTileBase.fromJson(Map<String, Object?> json) => _$DashboardUpdateTileBaseFromJson(json);
}
