// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'tiles_device_preview_plugin_update_device_preview_tile.freezed.dart';
part 'tiles_device_preview_plugin_update_device_preview_tile.g.dart';

/// Schema for updating a device tile in the dashboard.
@Freezed()
class TilesDevicePreviewPluginUpdateDevicePreviewTile with _$TilesDevicePreviewPluginUpdateDevicePreviewTile {
  const factory TilesDevicePreviewPluginUpdateDevicePreviewTile({
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

    /// The unique identifier of the associated device.
    required String device,

    /// The icon representing the tile.
    String? icon,

    /// Mark the tile as hidden and will not be displayed on the display application.
    @Default(false)
    bool hidden,
  }) = _TilesDevicePreviewPluginUpdateDevicePreviewTile;
  
  factory TilesDevicePreviewPluginUpdateDevicePreviewTile.fromJson(Map<String, Object?> json) => _$TilesDevicePreviewPluginUpdateDevicePreviewTileFromJson(json);
}
