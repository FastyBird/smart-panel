// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_module_update_tile.freezed.dart';
part 'dashboard_module_update_tile.g.dart';

/// Base schema for updating a tile in the dashboard.
@Freezed()
class DashboardModuleUpdateTile with _$DashboardModuleUpdateTile {
  const factory DashboardModuleUpdateTile({
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

    /// Mark the tile as hidden and will not be displayed on the display application.
    @Default(false)
    bool hidden,
  }) = _DashboardModuleUpdateTile;
  
  factory DashboardModuleUpdateTile.fromJson(Map<String, Object?> json) => _$DashboardModuleUpdateTileFromJson(json);
}
