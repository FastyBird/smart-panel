// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_create_tile_base_data_source_union.dart';

part 'dashboard_req_create_page_tile_data_union.freezed.dart';
part 'dashboard_req_create_page_tile_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardReqCreatePageTileDataUnion with _$DashboardReqCreatePageTileDataUnion {
  @FreezedUnionValue('device-preview')
  const factory DashboardReqCreatePageTileDataUnion.devicePreview({
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

    /// The unique identifier of the associated device.
    required String device,

    /// The icon representing the tile.
    String? icon,

    /// The number of rows the tile spans in the grid.
    @JsonKey(name: 'row_span')
    @Default(0)
    int rowSpan,

    /// The number of columns the tile spans in the grid.
    @JsonKey(name: 'col_span')
    @Default(0)
    int colSpan,
  }) = DashboardReqCreatePageTileDataUnionDevicePreview;

  @FreezedUnionValue('clock')
  const factory DashboardReqCreatePageTileDataUnion.clock({
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
  }) = DashboardReqCreatePageTileDataUnionClock;

  @FreezedUnionValue('weather-day')
  const factory DashboardReqCreatePageTileDataUnion.weatherDay({
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
  }) = DashboardReqCreatePageTileDataUnionWeatherDay;

  @FreezedUnionValue('weather-forecast')
  const factory DashboardReqCreatePageTileDataUnion.weatherForecast({
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
  }) = DashboardReqCreatePageTileDataUnionWeatherForecast;

  
  factory DashboardReqCreatePageTileDataUnion.fromJson(Map<String, Object?> json) => _$DashboardReqCreatePageTileDataUnionFromJson(json);
}
