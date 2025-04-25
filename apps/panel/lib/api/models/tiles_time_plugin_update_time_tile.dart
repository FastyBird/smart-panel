// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'tiles_time_plugin_update_time_tile.freezed.dart';
part 'tiles_time_plugin_update_time_tile.g.dart';

/// Schema for updating a time tile (clock) in the dashboard.
@Freezed()
class TilesTimePluginUpdateTimeTile with _$TilesTimePluginUpdateTimeTile {
  const factory TilesTimePluginUpdateTimeTile({
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
  }) = _TilesTimePluginUpdateTimeTile;
  
  factory TilesTimePluginUpdateTimeTile.fromJson(Map<String, Object?> json) => _$TilesTimePluginUpdateTimeTileFromJson(json);
}
