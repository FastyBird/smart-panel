// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_req_update_tile_data_union.freezed.dart';
part 'dashboard_req_update_tile_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardReqUpdateTileDataUnion with _$DashboardReqUpdateTileDataUnion {
  @FreezedUnionValue('device')
  const factory DashboardReqUpdateTileDataUnion.device({
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
  }) = DashboardUpdateDeviceTile;

  @FreezedUnionValue('clock')
  const factory DashboardReqUpdateTileDataUnion.clock({
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

    /// Specifies the type of tile as a clock.
    @Default('clock')
    String type,
  }) = DashboardUpdateTimeTile;

  @FreezedUnionValue('weather-day')
  const factory DashboardReqUpdateTileDataUnion.weatherDay({
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

    /// Specifies the type of tile as a day weather tile.
    @Default('weather-day')
    String type,
  }) = DashboardUpdateDayWeatherTile;

  @FreezedUnionValue('weather-forecast')
  const factory DashboardReqUpdateTileDataUnion.weatherForecast({
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

    /// Specifies the type of tile as a weather forecast tile.
    @Default('weather-forecast')
    String type,
  }) = DashboardUpdateForecastWeatherTile;

  
  factory DashboardReqUpdateTileDataUnion.fromJson(Map<String, Object?> json) => _$DashboardReqUpdateTileDataUnionFromJson(json);
}
