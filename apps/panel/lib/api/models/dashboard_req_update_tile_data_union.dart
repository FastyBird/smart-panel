// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_req_update_tile_data_union.freezed.dart';
part 'dashboard_req_update_tile_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardReqUpdateTileDataUnion with _$DashboardReqUpdateTileDataUnion {
  @FreezedUnionValue('device-preview')
  const factory DashboardReqUpdateTileDataUnion.devicePreview({
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
  }) = DashboardReqUpdateTileDataUnionDevicePreview;

  @FreezedUnionValue('clock')
  const factory DashboardReqUpdateTileDataUnion.clock({
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
  }) = DashboardReqUpdateTileDataUnionClock;

  @FreezedUnionValue('weather-day')
  const factory DashboardReqUpdateTileDataUnion.weatherDay({
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
  }) = DashboardReqUpdateTileDataUnionWeatherDay;

  @FreezedUnionValue('weather-forecast')
  const factory DashboardReqUpdateTileDataUnion.weatherForecast({
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
  }) = DashboardReqUpdateTileDataUnionWeatherForecast;

  
  factory DashboardReqUpdateTileDataUnion.fromJson(Map<String, Object?> json) => _$DashboardReqUpdateTileDataUnionFromJson(json);
}
