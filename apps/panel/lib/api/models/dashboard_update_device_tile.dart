// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_device_tile.freezed.dart';
part 'dashboard_update_device_tile.g.dart';

/// Schema for updating a device tile in the dashboard.
@Freezed()
class DashboardUpdateDeviceTile with _$DashboardUpdateDeviceTile {
  const factory DashboardUpdateDeviceTile({
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

    /// Indicates that this is a device-specific dashboard tile.
    @Default('device')
    String type,
  }) = _DashboardUpdateDeviceTile;
  
  factory DashboardUpdateDeviceTile.fromJson(Map<String, Object?> json) => _$DashboardUpdateDeviceTileFromJson(json);
}
